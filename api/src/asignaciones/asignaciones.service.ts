import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, SQL, sql } from 'drizzle-orm';
import { DB, InjectDb, Tx } from '../db/db.module';
import { asignaciones, empleados, equipos } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { aFecha, hoy } from '../common/utiles';
import { AsignarDto, DevolverDto, FiltroAsignacionesDto } from './dto/asignacion.dto';

export const nombreEquipo = (e: { tipo: string; marca: string | null; modelo: string | null; serie: string | null }) =>
  [e.tipo, e.marca, e.modelo, e.serie && `(${e.serie})`].filter(Boolean).join(' ');

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
    const [a] = await tx
      .insert(asignaciones)
      .values({
        equipoId: equipo.id,
        empleadoId: empleado.id,
        fechaEntrega: aFecha(dto.fechaEntrega) ?? hoy(),
        notas: dto.notas?.trim() || null,
        entregadoPorId: usuarioId,
      })
      .returning();
    await this.bitacora.registrar(
      { usuarioId, accion: `Asignó ${nombreEquipo(equipo)} a ${empleado.nombre}`, entidad: 'equipo', entidadId: equipo.id, detalle: { asignacionId: a.id } },
      tx,
    );
    return { ...a, equipo, empleado: { id: empleado.id, nombre: empleado.nombre } };
  }

  asignar(dto: AsignarDto, usuarioId: number) {
    return this.db.transaction((tx) => this.asignarEn(tx, dto, usuarioId));
  }

  /**
   * Cierra la asignación vigente del equipo y lo deja sin empleado.
   * No cambia el estatus: quien llama decide el nuevo (disponible, reparación, baja...).
   */
  async cerrarVigente(tx: Tx, equipoId: number, usuarioId: number, fecha?: string, nota?: string) {
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
          notas: [abierta.notas, nota].filter(Boolean).join(' | ') || null,
        })
        .where(eq(asignaciones.id, abierta.id));
    }
    await tx.update(equipos).set({ empleadoId: null }).where(eq(equipos.id, equipoId));
    return abierta;
  }

  devolver(dto: DevolverDto, usuarioId: number) {
    return this.db.transaction(async (tx) => {
      const e = await tx.query.equipos.findFirst({ where: eq(equipos.id, dto.equipoId) });
      if (!e) throw new NotFoundException('El equipo no existe.');
      if (e.estatus !== 'ASIGNADO') throw new ConflictException('El equipo no está asignado.');
      const a = await this.cerrarVigente(tx, e.id, usuarioId, aFecha(dto.fecha), dto.notas?.trim());
      const [equipo] = await tx.update(equipos).set({ estatus: 'DISPONIBLE' }).where(eq(equipos.id, e.id)).returning();
      await this.bitacora.registrar(
        { usuarioId, accion: `Recibió ${nombreEquipo(e)} de ${a?.empleado.nombre ?? 'empleado'}`, entidad: 'equipo', entidadId: e.id },
        tx,
      );
      return equipo;
    });
  }
}
