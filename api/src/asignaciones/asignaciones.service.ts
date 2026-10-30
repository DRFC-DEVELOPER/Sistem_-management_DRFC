import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, ne, SQL, sql } from 'drizzle-orm';
import { DB, InjectDb, Tx } from '../db/db.module';
import { asignaciones, empleados, EstatusEquipo, equipos, puestos } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { aFecha, hoy } from '../common/utiles';
import { AsignarDto, DevolverDto, FiltroAsignacionesDto } from './dto/asignacion.dto';

export const nombreEquipo = (e: { tipo: string; marca: string | null; modelo: string | null; serie: string | null }) =>
  [e.tipo, e.marca, e.modelo, e.serie && `(${e.serie})`].filter(Boolean).join(' ');

/** Estatus que conservan el vínculo del equipo con el empleado. */
export const sigueLigado = (estatus: EstatusEquipo) =>
  estatus === 'ASIGNADO' || estatus === 'DANADO' || estatus === 'EN_REPARACION' || estatus === 'RESGUARDO';

const esJefeArea = (nombre?: string | null) =>
  nombre?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() === 'jefe de area';

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
        puestoDestinatario: { columns: { id: true, nombre: true } },
        entregadoPor: { columns: { id: true, nombre: true } },
        recibidoPor: { columns: { id: true, nombre: true } },
      },
    });
  }

  /** Crea la asignación dentro de una transacción ya abierta. */
  async asignarEn(tx: Tx, dto: AsignarDto, usuarioId: number) {
    const empleado = await tx.query.empleados.findFirst({
      where: eq(empleados.id, dto.empleadoId),
      with: { puesto: { columns: { nombre: true } } },
    });
    if (!empleado) throw new NotFoundException('El empleado no existe.');
    if (!empleado.activo) throw new BadRequestException(`${empleado.nombre} está dado de baja; reactívalo para asignarle equipo.`);
    await tx.execute(sql`select id from ${empleados} where ${empleados.id} = ${empleado.id} for update`);
    const puestoDestinatarioId = dto.puestoDestinatarioId ?? null;
    const nombreDestinatario = puestoDestinatarioId ? dto.nombreDestinatario?.replace(/\s+/g, ' ').trim() || null : null;
    if (dto.nombreDestinatario?.trim() && !puestoDestinatarioId) {
      throw new BadRequestException('Para indicar quién usará el equipo, selecciona también su puesto.');
    }
    // Cómo se nombra al destinatario en los mensajes: el empleado mismo, o la persona/puesto a cargo del jefe de área.
    let destinatario = empleado.nombre;
    if (puestoDestinatarioId) {
      if (!esJefeArea(empleado.puesto?.nombre)) {
        throw new BadRequestException('Solo un empleado con el puesto Jefe de área puede recibir equipos para otro puesto.');
      }
      const puesto = await tx.query.puestos.findFirst({ where: eq(puestos.id, puestoDestinatarioId) });
      if (!puesto || puesto.departamentoId !== empleado.departamentoId || esJefeArea(puesto.nombre)) {
        throw new BadRequestException('El puesto destinatario debe pertenecer al mismo departamento y no puede ser Jefe de área.');
      }
      destinatario = nombreDestinatario ? `${nombreDestinatario} (${puesto.nombre})` : `El puesto ${puesto.nombre} (sin nombre de persona)`;
    }

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
    // Las reglas por tipo se aplican a cada destinatario: el propio empleado o cada persona (puesto + nombre) a cargo del jefe de área.
    const mismoDestinatario = sql`exists (
      select 1 from (
        select a.puesto_destinatario_id, a.nombre_destinatario from ${asignaciones} a
        where a.equipo_id = ${equipos.id} and a.empleado_id = ${equipos.empleadoId}
        order by a.id desc limit 1
      ) u
      where u.puesto_destinatario_id is not distinct from ${puestoDestinatarioId}::int
        and lower(u.nombre_destinatario) is not distinct from lower(${nombreDestinatario}::text)
    )`;
    // Solo un equipo en uso por tipo; uno dañado, en reparación o en resguardo admite un sustituto temporal.
    if (equipo.tipo !== 'OTRO') {
      const igual = await tx.query.equipos.findFirst({
        where: and(eq(equipos.empleadoId, empleado.id), eq(equipos.tipo, equipo.tipo), eq(equipos.estatus, 'ASIGNADO'), ne(equipos.id, equipo.id), mismoDestinatario),
      });
      if (igual) {
        throw new ConflictException(
          `${destinatario} ya tiene asignado ${nombreEquipo(igual)}. Solo puede recibir otro del mismo tipo si el anterior está dañado, en reparación, en resguardo o dado de baja.`,
        );
      }
    }
    // Si el destinatario tiene ligado un equipo del mismo tipo dañado, en reparación o en resguardo, este lo sustituye temporalmente.
    const sustituido = await tx.query.equipos.findFirst({
      where: and(
        eq(equipos.empleadoId, empleado.id),
        eq(equipos.tipo, equipo.tipo),
        inArray(equipos.estatus, ['DANADO', 'EN_REPARACION', 'RESGUARDO']),
        mismoDestinatario,
        sql`not exists (select 1 from ${asignaciones} x where x.sustituye_equipo_id = ${equipos.id} and x.fecha_devolucion is null)`,
      ),
      orderBy: [asc(equipos.id)],
    });
    const [a] = await tx
      .insert(asignaciones)
      .values({
        equipoId: equipo.id,
        empleadoId: empleado.id,
        puestoDestinatarioId,
        nombreDestinatario,
        fechaEntrega: aFecha(dto.fechaEntrega) ?? hoy(),
        notas: dto.notas?.trim() || null,
        sustituyeEquipoId: sustituido?.id ?? null,
        entregadoPorId: usuarioId,
      })
      .returning();
    await this.bitacora.registrar(
      {
        usuarioId,
        accion: `Asignó ${nombreEquipo(equipo)} a ${empleado.nombre}${puestoDestinatarioId ? ` para ${destinatario}` : ''}${sustituido ? ` (temporal, en lugar de ${nombreEquipo(sustituido)})` : ''}`,
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
   * Si queda dañado o en reparación sigue ligado al empleado; en los demás estados se desliga.
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
      if (estatus === 'RESGUARDO' && e.empleadoId) {
        await tx.execute(sql`select id from ${empleados} where ${empleados.id} = ${e.empleadoId} for update`);
        const otroEnResguardo = await tx.query.equipos.findFirst({
          where: and(
            eq(equipos.empleadoId, e.empleadoId),
            eq(equipos.tipo, e.tipo),
            eq(equipos.estatus, 'RESGUARDO'),
            ne(equipos.id, e.id),
          ),
        });
        if (otroEnResguardo) {
          throw new ConflictException(
            `Esta persona ya tiene ${nombreEquipo(otroEnResguardo)} en resguardo. Solo se permite un equipo de este tipo; el reemplazo debe quedarse asignado como temporal.`,
          );
        }
      }
      const a = await this.cerrarVigente(tx, e.id, usuarioId, estatus, aFecha(dto.fecha), dto.notas?.trim());
      const [equipo] = await tx.update(equipos).set({ estatus }).where(eq(equipos.id, e.id)).returning();
      await this.bitacora.registrar(
        {
          usuarioId,
          accion: `Recibió ${nombreEquipo(e)} de ${a?.empleado.nombre ?? 'empleado'}${estatus === 'DANADO' ? ' (dañado)' : estatus === 'RESGUARDO' ? ' (en resguardo)' : ''}`,
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
