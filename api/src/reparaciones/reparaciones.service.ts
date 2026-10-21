import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, SQL } from 'drizzle-orm';
import { DB, InjectDb } from '../db/db.module';
import { equipos, reparaciones } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { AsignacionesService, nombreEquipo } from '../asignaciones/asignaciones.service';
import { aFecha, hoy } from '../common/utiles';
import { EnviarReparacionDto, FiltroReparacionesDto, RecibirReparacionDto } from './dto/reparacion.dto';

@Injectable()
export class ReparacionesService {
  constructor(@InjectDb() private db: DB, private bitacora: BitacoraService, private asignaciones: AsignacionesService) {}

  listar(f: FiltroReparacionesDto) {
    const c: SQL[] = [];
    if (f.equipoId) c.push(eq(reparaciones.equipoId, f.equipoId));
    if (f.abiertas) c.push(isNull(reparaciones.fechaRecepcion));
    return this.db.query.reparaciones.findMany({
      where: c.length ? and(...c) : undefined,
      orderBy: [desc(reparaciones.fechaEnvio), desc(reparaciones.id)],
      limit: 500,
      with: {
        equipo: { columns: { id: true, tipo: true, marca: true, modelo: true, serie: true, estatus: true } },
        creadoPor: { columns: { nombre: true } },
      },
    });
  }

  /** Envía el equipo a reparación. Si estaba asignado, se registra la devolución automáticamente. */
  enviar(dto: EnviarReparacionDto, usuarioId: number) {
    return this.db.transaction(async (tx) => {
      const e = await tx.query.equipos.findFirst({ where: eq(equipos.id, dto.equipoId) });
      if (!e) throw new NotFoundException('El equipo no existe.');
      if (e.estatus === 'EN_REPARACION') throw new ConflictException('El equipo ya está en reparación.');
      if (e.estatus === 'BAJA') throw new BadRequestException('El equipo está dado de baja.');
      const fecha = aFecha(dto.fechaEnvio) ?? hoy();
      let de: string | undefined;
      if (e.estatus === 'ASIGNADO') {
        const a = await this.asignaciones.cerrarVigente(tx, e.id, usuarioId, fecha, 'Enviado a reparación');
        de = a?.empleado.nombre;
      }
      const [r] = await tx
        .insert(reparaciones)
        .values({ equipoId: e.id, fechaEnvio: fecha, motivo: dto.motivo.trim(), proveedor: dto.proveedor?.trim() || null, creadoPorId: usuarioId })
        .returning();
      await tx.update(equipos).set({ estatus: 'EN_REPARACION' }).where(eq(equipos.id, e.id));
      await this.bitacora.registrar(
        { usuarioId, accion: `Envió ${nombreEquipo(e)} a reparación${de ? ` (lo tenía ${de})` : ''}`, entidad: 'reparacion', entidadId: r.id, detalle: { equipoId: e.id } },
        tx,
      );
      return r;
    });
  }

  recibir(id: number, dto: RecibirReparacionDto, usuarioId: number) {
    return this.db.transaction(async (tx) => {
      const r = await tx.query.reparaciones.findFirst({ where: eq(reparaciones.id, id), with: { equipo: true } });
      if (!r) throw new NotFoundException('La reparación no existe.');
      if (r.fechaRecepcion) throw new ConflictException('Esta reparación ya se recibió.');
      const fecha = aFecha(dto.fechaRecepcion) ?? hoy();
      const [actualizada] = await tx
        .update(reparaciones)
        .set({ fechaRecepcion: fecha, solucion: dto.solucion.trim(), resultado: dto.resultado })
        .where(eq(reparaciones.id, id))
        .returning();
      await tx
        .update(equipos)
        .set({ estatus: dto.resultado, ...(dto.resultado === 'BAJA' ? { fechaBaja: fecha, motivoBaja: dto.solucion.trim() } : {}) })
        .where(eq(equipos.id, r.equipoId));
      await this.bitacora.registrar(
        { usuarioId, accion: `Recibió ${nombreEquipo(r.equipo)} de reparación como ${dto.resultado}`, entidad: 'reparacion', entidadId: id, detalle: { equipoId: r.equipoId } },
        tx,
      );
      return actualizada;
    });
  }
}
