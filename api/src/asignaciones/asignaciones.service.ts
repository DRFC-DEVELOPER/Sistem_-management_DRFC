import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, ne, SQL, sql } from 'drizzle-orm';
import { DB, InjectDb, Tx } from '../db/db.module';
import { asignaciones, empleados, EstatusEquipo, equipos } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { aFecha, hoy } from '../common/utiles';
import { AsignarDto, DevolverDto, FiltroAsignacionesDto } from './dto/asignacion.dto';

export const nombreEquipo = (e: { tipo: string; marca: string | null; modelo: string | null; serie: string | null }) =>
  [e.tipo, e.marca, e.modelo, e.serie && `(${e.serie})`].filter(Boolean).join(' ');

/** Estatus en los que el equipo conserva al empleado que lo tenía. */
export const sigueLigado = (estatus: EstatusEquipo) => estatus === 'DANADO' || estatus === 'EN_REPARACION';

const equipoBreve = { columns: { id: true, tipo: true, marca: true, modelo: true, serie: true, estatus: true } } as const;

@Injectable()
export class AsignacionesService {
  constructor(@InjectDb() private db: DB, private bitacora: BitacoraService) {}

  listar(f: FiltroAsignacionesDto) {
    const c: SQL[] = [];
    if (f.empleadoId) c.push(eq(asignaciones.empleadoId, f.empleadoId));
    if (f.equipoId) c.push(eq(asignaciones.equipoId, f.equipoId));
    if (f.abiertas) c.push(isNull(asignaciones.fechaDevolucion));
    return this.db.query.asignaciones.findMany({
      where: c.length ? and(...c) : undefined,
      orderBy: [sql`${asignaciones.fechaEntrega} desc nulls last`, desc(asignaciones.id)],
      limit: 500,
      with: {
        equipo: equipoBreve,
        empleado: { columns: { id: true, nombre: true }, with: { departamento: { columns: { nombre: true } } } },
        entregadoPor: { columns: { id: true, nombre: true } },
        recibidoPor: { columns: { id: true, nombre: true } },
      },
    });
  }

  /** Crea la asignación dentro de una transacción ya abierta. */
  async asignarEn(tx: Tx, dto: AsignarDto, usuarioId: number) {
    const empleado = await tx.query.empleados.findFirst({ where: eq(empleados.id, dto.empleadoId) });
    if (!empleado) throw new NotFoundException('El empleado no existe.');
    if (!empleado.activo) throw new BadRequestException(`${empleado.nombre} está dado de baja; reactívalo para asignarle equipo.`);

    // La condición de estatus en el UPDATE evita que dos personas asignen el mismo equipo a la vez.
    const [equipo] = await tx
      .update(equipos)
      .set({ estatus: 'ASIGNADO', empleadoId: empleado.id })
      .where(and(eq(equipos.id, dto.equipoId), eq(equipos.estatus, 'DISPONIBLE')))
      .returning();
    if (!equipo) {
      const e = await tx.query.equipos.findFirst({ where: eq(equipos.id, dto.equipoId) });
      if (!e) throw new NotFoundException('El equipo no existe.');
      throw new ConflictException(`El equipo no está disponible (estatus actual: ${e.estatus}).`);
    }
    if (equipo.ambito !== 'USUARIO') throw new BadRequestException('Los equipos de infraestructura no se asignan a empleados.');
    // Solo un equipo en uso por tipo; uno dañado o en reparación sí admite otro (que queda como temporal).
    if (equipo.tipo !== 'OTRO') {
      const igual = await tx.query.equipos.findFirst({
        where: and(eq(equipos.empleadoId, empleado.id), eq(equipos.tipo, equipo.tipo), eq(equipos.estatus, 'ASIGNADO'), ne(equipos.id, equipo.id)),
      });
      if (igual) {
        throw new ConflictException(
          `${empleado.nombre} ya tiene asignado ${nombreEquipo(igual)}. Solo puede recibir otro del mismo tipo si ese está dañado, en reparación o dado de baja.`,
        );
      }
    }
    // Si el empleado tiene ligado un equipo del mismo tipo dañado o en reparación, este lo sustituye temporalmente.
    const sustituido = await tx.query.equipos.findFirst({
      where: and(
        eq(equipos.empleadoId, empleado.id),
        eq(equipos.tipo, equipo.tipo),
        inArray(equipos.estatus, ['DANADO', 'EN_REPARACION']),
        sql`not exists (select 1 from ${asignaciones} x where x.sustituye_equipo_id = ${equipos.id} and x.fecha_devolucion is null)`,
      ),
      orderBy: [asc(equipos.id)],
    });
    const [a] = await tx
      .insert(asignaciones)
      .values({
        equipoId: equipo.id,
        empleadoId: empleado.id,
        fechaEntrega: aFecha(dto.fechaEntrega) ?? hoy(),
        notas: dto.notas?.trim() || null,
        sustituyeEquipoId: sustituido?.id ?? null,
        entregadoPorId: usuarioId,
      })
      .returning();
    await this.bitacora.registrar(
      {
        usuarioId,
        accion: `Asignó ${nombreEquipo(equipo)} a ${empleado.nombre}${sustituido ? ` (temporal, en lugar de ${nombreEquipo(sustituido)})` : ''}`,
        entidad: 'equipo',
        entidadId: equipo.id,
        detalle: { asignacionId: a.id, ...(sustituido ? { sustituyeEquipoId: sustituido.id } : {}) },
      },
      tx,
    );
    return { ...a, equipo, empleado: { id: empleado.id, nombre: empleado.nombre } };
  }

  asignar(dto: AsignarDto, usuarioId: number) {
    return this.db.transaction((tx) => this.asignarEn(tx, dto, usuarioId));
  }

  /**
   * Cierra la asignación vigente del equipo.
   * Si sale dañado o a reparación sigue ligado al empleado; solo se desliga al quedar disponible o de baja.
   * No cambia el estatus del equipo: quien llama lo pone igual a `resultado`.
   */
  async cerrarVigente(tx: Tx, equipoId: number, usuarioId: number, resultado: EstatusEquipo, fecha?: string, nota?: string) {
    const abierta = await tx.query.asignaciones.findFirst({
      where: and(eq(asignaciones.equipoId, equipoId), isNull(asignaciones.fechaDevolucion)),
      with: { empleado: { columns: { id: true, nombre: true } } },
    });
    if (abierta) {
      await tx
        .update(asignaciones)
        .set({
          fechaDevolucion: fecha ?? hoy(),
          recibidoPorId: usuarioId,
          resultado,
          notas: [abierta.notas, nota].filter(Boolean).join(' | ') || null,
        })
        .where(eq(asignaciones.id, abierta.id));
    }
    if (sigueLigado(resultado)) return abierta;
    await tx.update(equipos).set({ empleadoId: null }).where(eq(equipos.id, equipoId));
    return abierta;
  }

  /**
   * Resuelve los equipos que sustituyen temporalmente a `equipoId` cuando este deja de estar dañado o en reparación.
   * Si se le regresa al empleado, los temporales vuelven al inventario; si no, se quedan con él como asignación normal.
   */
  async resolverTemporales(tx: Tx, equipoId: number, regresado: boolean, usuarioId: number, fecha?: string) {
    const temporales = await tx.query.asignaciones.findMany({
      where: and(eq(asignaciones.sustituyeEquipoId, equipoId), isNull(asignaciones.fechaDevolucion)),
      with: { equipo: true, empleado: { columns: { nombre: true } } },
    });
    for (const t of temporales) {
      if (regresado) {
        await this.cerrarVigente(tx, t.equipoId, usuarioId, 'DISPONIBLE', fecha, 'Se le regresó su equipo original');
        await tx.update(equipos).set({ estatus: 'DISPONIBLE' }).where(eq(equipos.id, t.equipoId));
        await this.bitacora.registrar(
          { usuarioId, accion: `Recibió ${nombreEquipo(t.equipo)} de ${t.empleado.nombre} (era temporal; se le regresó su equipo)`, entidad: 'equipo', entidadId: t.equipoId },
          tx,
        );
      } else {
        await tx.update(asignaciones).set({ sustituyeEquipoId: null }).where(eq(asignaciones.id, t.id));
        await this.bitacora.registrar(
          { usuarioId, accion: `${nombreEquipo(t.equipo)} dejó de ser temporal para ${t.empleado.nombre}`, entidad: 'equipo', entidadId: t.equipoId },
          tx,
        );
      }
    }
  }

  /**
   * El equipo ya funciona: se le regresa al empleado al que está ligado o queda disponible.
   * En ambos casos resuelve los equipos que lo sustituían temporalmente.
   */
  async alQuedarDisponible(tx: Tx, equipoId: number, regresar: boolean | undefined, usuarioId: number, fecha?: string): Promise<EstatusEquipo> {
    const e = await tx.query.equipos.findFirst({ where: eq(equipos.id, equipoId), with: { empleado: true } });
    if (!e) throw new NotFoundException('El equipo no existe.');
    if (regresar) {
      if (!e.empleado) throw new BadRequestException('El equipo no está ligado a ningún empleado.');
      if (!e.empleado.activo) throw new BadRequestException(`${e.empleado.nombre} está dado de baja; no se le puede regresar.`);
      await this.resolverTemporales(tx, equipoId, true, usuarioId, fecha);
      await tx.update(equipos).set({ estatus: 'ASIGNADO' }).where(eq(equipos.id, equipoId));
      const [a] = await tx
        .insert(asignaciones)
        .values({ equipoId, empleadoId: e.empleado.id, fechaEntrega: fecha ?? hoy(), notas: 'Se le regresó después de repararse', entregadoPorId: usuarioId })
        .returning();
      await this.bitacora.registrar(
        { usuarioId, accion: `Asignó ${nombreEquipo(e)} a ${e.empleado.nombre} (se le regresó ya reparado)`, entidad: 'equipo', entidadId: equipoId, detalle: { asignacionId: a.id } },
        tx,
      );
      return 'ASIGNADO';
    }
    await this.resolverTemporales(tx, equipoId, false, usuarioId, fecha);
    await tx.update(equipos).set({ estatus: 'DISPONIBLE', empleadoId: null }).where(eq(equipos.id, equipoId));
    return 'DISPONIBLE';
  }

  devolver(dto: DevolverDto, usuarioId: number) {
    return this.db.transaction(async (tx) => {
      const e = await tx.query.equipos.findFirst({ where: eq(equipos.id, dto.equipoId) });
      if (!e) throw new NotFoundException('El equipo no existe.');
      if (e.estatus !== 'ASIGNADO') throw new ConflictException('El equipo no está asignado.');
      const estatus = dto.estatus ?? 'DISPONIBLE';
      const a = await this.cerrarVigente(tx, e.id, usuarioId, estatus, aFecha(dto.fecha), dto.notas?.trim());
      const [equipo] = await tx.update(equipos).set({ estatus }).where(eq(equipos.id, e.id)).returning();
      await this.bitacora.registrar(
        {
          usuarioId,
          accion: `Recibió ${nombreEquipo(e)} de ${a?.empleado.nombre ?? 'empleado'}${estatus === 'DANADO' ? ' (dañado)' : ''}`,
          entidad: 'equipo',
          entidadId: e.id,
          detalle: dto.notas?.trim() ? { notas: dto.notas.trim() } : undefined,
        },
        tx,
      );
      return equipo;
    });
  }
}
