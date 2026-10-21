import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, getTableColumns, ilike, isNull, ne, or, SQL, sql } from 'drizzle-orm';
import { DB, DbOTx, InjectDb } from '../db/db.module';
import { asignaciones, departamentos, empleados, EstatusEquipo, estatusEquipo, equipos, reparaciones } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { AsignacionesService, nombreEquipo } from '../asignaciones/asignaciones.service';
import { hoy, limpiar, paginar, patron } from '../common/utiles';
import { ActualizarEquipoDto, CambiarEstatusDto, CrearEquipoDto, FiltroEquiposDto } from './dto/equipo.dto';

@Injectable()
export class EquiposService {
  constructor(@InjectDb() private db: DB, private bitacora: BitacoraService, private asignaciones: AsignacionesService) {}

  async listar(f: FiltroEquiposDto) {
    const { offset, limit, pagina, limite } = paginar(f.pagina, f.limite);
    const c: SQL[] = [];
    if (f.tipo) c.push(eq(equipos.tipo, f.tipo));
    if (f.empleadoId) c.push(eq(equipos.empleadoId, f.empleadoId));
    if (f.estatus) c.push(eq(equipos.estatus, f.estatus));
    else if (!f.incluirBajas) c.push(ne(equipos.estatus, 'BAJA'));
    if (f.departamentoId) c.push(eq(empleados.departamentoId, f.departamentoId));
    if (f.q) {
      const p = patron(f.q);
      c.push(
        or(
          ...[equipos.marca, equipos.modelo, equipos.serie, equipos.codigoBarras, equipos.descripcion, equipos.ipGestion, equipos.procesador].map((col) => ilike(col, p)),
          ilike(empleados.nombre, p),
        )!,
      );
    }
    const where = c.length ? and(...c) : undefined;
    const [[{ total }], filas] = await Promise.all([
      this.db.select({ total: count() }).from(equipos).leftJoin(empleados, eq(equipos.empleadoId, empleados.id)).where(where),
      this.db
        .select({
          ...getTableColumns(equipos),
          empleado: { id: empleados.id, nombre: empleados.nombre, numero: empleados.numero },
          departamento: { id: departamentos.id, nombre: departamentos.nombre },
        })
        .from(equipos)
        .leftJoin(empleados, eq(equipos.empleadoId, empleados.id))
        .leftJoin(departamentos, eq(empleados.departamentoId, departamentos.id))
        .where(where)
        .orderBy(asc(equipos.tipo), asc(equipos.marca), asc(equipos.id))
        .offset(offset)
        .limit(limit),
    ]);
    return { total, pagina, limite, datos: filas };
  }

  /** Conteos para el tablero: por estatus y por tipo. */
  async resumen() {
    const filas = await this.db
      .select({ tipo: equipos.tipo, estatus: equipos.estatus, n: count() })
      .from(equipos)
      .groupBy(equipos.tipo, equipos.estatus);
    const porEstatus = Object.fromEntries(estatusEquipo.enumValues.map((s) => [s, 0])) as Record<EstatusEquipo, number>;
    const porTipo: Record<string, { total: number; disponibles: number }> = {};
    for (const r of filas) {
      porEstatus[r.estatus] += r.n;
      if (r.estatus === 'BAJA') continue;
      porTipo[r.tipo] ??= { total: 0, disponibles: 0 };
      porTipo[r.tipo].total += r.n;
      if (r.estatus === 'DISPONIBLE') porTipo[r.tipo].disponibles += r.n;
    }
    return { porEstatus, porTipo };
  }

  private conEmpleado(where: SQL) {
    return this.db.query.equipos.findFirst({
      where,
      with: { empleado: { columns: { id: true, nombre: true, numero: true }, with: { departamento: { columns: { id: true, nombre: true } } } } },
    });
  }

  /** Busca por código de barras o número de serie (para el escáner). */
  async porCodigo(codigo: string) {
    const c = codigo.trim();
    const e =
      (await this.conEmpleado(sql`lower(${equipos.codigoBarras}) = lower(${c})`)) ??
      (await this.conEmpleado(sql`lower(${equipos.serie}) = lower(${c})`));
    if (!e) throw new NotFoundException(`No hay ningún equipo con el código o serie ${c}.`);
    return e;
  }

  async obtener(id: number) {
    const e = await this.db.query.equipos.findFirst({
      where: eq(equipos.id, id),
      with: {
        empleado: { columns: { id: true, nombre: true, numero: true }, with: { departamento: { columns: { id: true, nombre: true } } } },
        asignaciones: {
          orderBy: [sql`${asignaciones.fechaEntrega} desc nulls last`, desc(asignaciones.id)],
          with: {
            empleado: { columns: { id: true, nombre: true } },
            entregadoPor: { columns: { nombre: true } },
            recibidoPor: { columns: { nombre: true } },
          },
        },
        reparaciones: { orderBy: [desc(reparaciones.fechaEnvio)] },
      },
    });
    if (!e) throw new NotFoundException('El equipo no existe.');
    return e;
  }

  private async validarUnicos(d: { serie?: string | null; codigoBarras?: string | null }, excluirId?: number, tx: DbOTx = this.db) {
    const no = excluirId ? ne(equipos.id, excluirId) : undefined;
    if (d.serie) {
      const otro = await tx.query.equipos.findFirst({ where: and(sql`lower(${equipos.serie}) = lower(${d.serie})`, no) });
      if (otro) throw new ConflictException(`Ya existe un equipo con el número de serie ${d.serie} (id ${otro.id}).`);
    }
    if (d.codigoBarras) {
      const otro = await tx.query.equipos.findFirst({ where: and(sql`lower(${equipos.codigoBarras}) = lower(${d.codigoBarras})`, no) });
      if (otro) throw new ConflictException(`El código de barras ${d.codigoBarras} ya pertenece a otro equipo (id ${otro.id}).`);
    }
  }

  async crear(dto: CrearEquipoDto, usuarioId: number) {
    const { estatusInicial, empleadoId, fechaEntrega, ...resto } = dto;
    const d = limpiar(resto);
    if (!d.marca && !d.modelo && !d.serie && !d.descripcion) {
      throw new BadRequestException('Escribe al menos la marca, el modelo, la serie o una descripción.');
    }
    if (empleadoId && estatusInicial === 'DANADO') throw new BadRequestException('Un equipo dañado no se puede asignar.');
    const id = await this.db.transaction(async (tx) => {
      await this.validarUnicos(d, undefined, tx);
      const [e] = await tx.insert(equipos).values({ ...d, estatus: estatusInicial ?? 'DISPONIBLE' }).returning();
      await this.bitacora.registrar({ usuarioId, accion: `Registró ${nombreEquipo(e)}`, entidad: 'equipo', entidadId: e.id }, tx);
      if (empleadoId) await this.asignaciones.asignarEn(tx, { equipoId: e.id, empleadoId, fechaEntrega }, usuarioId);
      return e.id;
    });
    return this.obtener(id);
  }

  async actualizar(id: number, dto: ActualizarEquipoDto, usuarioId: number) {
    const actual = await this.db.query.equipos.findFirst({ where: eq(equipos.id, id) });
    if (!actual) throw new NotFoundException('El equipo no existe.');
    const d = limpiar(dto);
    if (!Object.keys(d).length) throw new BadRequestException('No enviaste cambios.');
    // La serie solo se valida si cambió, para no bloquear equipos importados con series repetidas.
    await this.validarUnicos(
      {
        serie: d.serie && d.serie.toLowerCase() !== (actual.serie ?? '').toLowerCase() ? d.serie : null,
        codigoBarras: d.codigoBarras,
      },
      id,
    );
    const [e] = await this.db.update(equipos).set(d).where(eq(equipos.id, id)).returning();
    await this.bitacora.registrar({ usuarioId, accion: `Modificó ${nombreEquipo(e)}`, entidad: 'equipo', entidadId: id, detalle: { cambios: Object.keys(d) } });
    return e;
  }

  /** Cambia entre DISPONIBLE y DANADO. Asignaciones, reparaciones y bajas tienen sus propias rutas. */
  async cambiarEstatus(id: number, dto: CambiarEstatusDto, usuarioId: number) {
    const e = await this.db.query.equipos.findFirst({ where: eq(equipos.id, id) });
    if (!e) throw new NotFoundException('El equipo no existe.');
    const bloqueos: Partial<Record<EstatusEquipo, string>> = {
      ASIGNADO: 'Primero registra la devolución del equipo.',
      EN_REPARACION: 'Registra la recepción en la reparación abierta.',
      BAJA: 'Reactiva el equipo antes de cambiar su estatus.',
    };
    const bloqueo = bloqueos[e.estatus];
    if (bloqueo) throw new ConflictException(bloqueo);
    const [r] = await this.db
      .update(equipos)
      .set({ estatus: dto.estatus, ...(dto.notas ? { notas: [e.notas, dto.notas].filter(Boolean).join('\n') } : {}) })
      .where(eq(equipos.id, id))
      .returning();
    await this.bitacora.registrar({ usuarioId, accion: `Cambió ${nombreEquipo(e)} a ${dto.estatus}`, entidad: 'equipo', entidadId: id, detalle: { de: e.estatus, notas: dto.notas } });
    return r;
  }

  /** Da de baja el equipo. Si estaba asignado se le retira al empleado; si estaba en reparación se cierra. */
  baja(id: number, motivo: string, usuarioId: number) {
    return this.db.transaction(async (tx) => {
      const e = await tx.query.equipos.findFirst({ where: eq(equipos.id, id) });
      if (!e) throw new NotFoundException('El equipo no existe.');
      if (e.estatus === 'BAJA') throw new BadRequestException('El equipo ya está dado de baja.');
      let retirado: string | undefined;
      if (e.estatus === 'ASIGNADO') {
        const a = await this.asignaciones.cerrarVigente(tx, id, usuarioId, hoy(), `Retirado por baja: ${motivo}`);
        retirado = a?.empleado.nombre;
      }
      await tx
        .update(reparaciones)
        .set({ fechaRecepcion: hoy(), resultado: 'BAJA', solucion: `Dado de baja: ${motivo}` })
        .where(and(eq(reparaciones.equipoId, id), isNull(reparaciones.fechaRecepcion)));
      const [r] = await tx.update(equipos).set({ estatus: 'BAJA', fechaBaja: hoy(), motivoBaja: motivo.trim() }).where(eq(equipos.id, id)).returning();
      await this.bitacora.registrar(
        { usuarioId, accion: `Dio de baja ${nombreEquipo(e)}${retirado ? ` (retirado a ${retirado})` : ''}`, entidad: 'equipo', entidadId: id, detalle: { motivo } },
        tx,
      );
      return r;
    });
  }

  async reactivar(id: number, usuarioId: number) {
    const e = await this.db.query.equipos.findFirst({ where: eq(equipos.id, id) });
    if (!e) throw new NotFoundException('El equipo no existe.');
    if (e.estatus !== 'BAJA') throw new BadRequestException('El equipo no está dado de baja.');
    const [r] = await this.db.update(equipos).set({ estatus: 'DISPONIBLE', fechaBaja: null, motivoBaja: null }).where(eq(equipos.id, id)).returning();
    await this.bitacora.registrar({ usuarioId, accion: `Reactivó ${nombreEquipo(e)}`, entidad: 'equipo', entidadId: id });
    return r;
  }

  /** Borra el equipo y su historial. Solo para equipos dados de baja. */
  async eliminar(id: number, usuarioId: number) {
    const e = await this.db.query.equipos.findFirst({ where: eq(equipos.id, id) });
    if (!e) throw new NotFoundException('El equipo no existe.');
    if (e.estatus !== 'BAJA') throw new BadRequestException('Solo se pueden eliminar equipos dados de baja.');
    await this.db.delete(equipos).where(eq(equipos.id, id));
    await this.bitacora.registrar({ usuarioId, accion: `Eliminó ${nombreEquipo(e)}`, entidad: 'equipo', entidadId: id, detalle: { equipo: e } });
    return { ok: true };
  }
}
