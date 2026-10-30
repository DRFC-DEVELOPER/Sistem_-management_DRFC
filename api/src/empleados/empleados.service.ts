import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, ilike, isNull, ne, or, SQL, sql } from 'drizzle-orm';
import { DB, DbOTx, InjectDb } from '../db/db.module';
import { asignaciones, departamentos, empleados, equipos, puestos, usuariosSistema } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { DepartamentosService } from '../departamentos/departamentos.service';
import { AsignacionesService, nombreEquipo, sigueLigado } from '../asignaciones/asignaciones.service';
import { hoy, limpiar, patron } from '../common/utiles';
import { ActualizarEmpleadoDto, CrearEmpleadoDto, FiltroEmpleadosDto } from './dto/empleado.dto';

@Injectable()
export class EmpleadosService {
  constructor(
    @InjectDb() private db: DB,
    private bitacora: BitacoraService,
    private deptos: DepartamentosService,
    private asignaciones: AsignacionesService,
  ) {}

  listar(f: FiltroEmpleadosDto) {
    const c: SQL[] = [];
    if (!f.incluirInactivos) c.push(eq(empleados.activo, true));
    if (f.departamentoId) c.push(eq(empleados.departamentoId, f.departamentoId));
    if (f.q) c.push(or(ilike(empleados.nombre, patron(f.q)), ilike(empleados.numero, patron(f.q)), ilike(empleados.correo, patron(f.q)))!);
    return this.db
      .select({
        ...getTableColumns(empleados),
        departamento: { id: departamentos.id, nombre: departamentos.nombre },
        puesto: { id: puestos.id, nombre: puestos.nombre },
        equiposAsignados: sql<number>`(select count(*)::int from equipos q where q.empleado_id = "empleados"."id")`,
      })
      .from(empleados)
      .leftJoin(departamentos, eq(empleados.departamentoId, departamentos.id))
      .leftJoin(puestos, eq(empleados.puestoId, puestos.id))
      .where(c.length ? and(...c) : undefined)
      .orderBy(asc(empleados.nombre));
  }

  async obtener(id: number) {
    const e = await this.db.query.empleados.findFirst({
      where: eq(empleados.id, id),
      with: {
        departamento: true,
        puesto: true,
        equiposActuales: { orderBy: [asc(equipos.tipo)] },
        asignaciones: {
          orderBy: [sql`${asignaciones.fechaEntrega} desc nulls last`, desc(asignaciones.id)],
          with: {
            equipo: {
              columns: {
                id: true, tipo: true, marca: true, modelo: true, serie: true, color: true,
                descripcion: true, codigoBarras: true, tipoAdaptador: true, estatus: true, empleadoId: true,
              },
            },
            puestoDestinatario: { columns: { id: true, nombre: true } },
          },
        },
      },
    });
    if (!e) throw new NotFoundException('El empleado no existe.');
    return e;
  }

  private async verificarDuplicado(nombre: string, departamentoId: number | null, excluirId?: number) {
    const otro = await this.db.query.empleados.findFirst({
      where: and(
        sql`lower(${empleados.nombre}) = lower(${nombre})`,
        departamentoId === null ? isNull(empleados.departamentoId) : eq(empleados.departamentoId, departamentoId),
        excluirId ? ne(empleados.id, excluirId) : undefined,
      ),
    });
    if (otro) throw new ConflictException('Ya existe un empleado con ese nombre en ese departamento.');
  }

  private async verificarPuesto(puestoId: number | null | undefined, departamentoId: number | null) {
    if (puestoId == null) return;
    const puesto = await this.db.query.puestos.findFirst({ where: eq(puestos.id, puestoId) });
    if (!puesto || puesto.departamentoId !== departamentoId) {
      throw new BadRequestException('El puesto seleccionado no pertenece al departamento elegido.');
    }
  }

  private async verificarJefeDisponible(
    puestoId: number | null | undefined,
    departamentoId: number | null,
    excluirId: number | undefined,
    tx: DbOTx,
  ) {
    if (puestoId == null || departamentoId == null) return;
    const puesto = await tx.query.puestos.findFirst({ where: eq(puestos.id, puestoId) });
    const esJefeArea = (nombre?: string | null) =>
      nombre?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() === 'jefe de area';
    if (!esJefeArea(puesto?.nombre)) return;

    await tx.execute(sql`select id from ${departamentos} where ${departamentos.id} = ${departamentoId} for update`);
    const responsables = await tx
      .select({ id: empleados.id, puesto: puestos.nombre })
      .from(empleados)
      .innerJoin(puestos, eq(empleados.puestoId, puestos.id))
      .where(and(
        eq(empleados.departamentoId, departamentoId),
        eq(empleados.activo, true),
        excluirId ? ne(empleados.id, excluirId) : undefined,
      ));
    if (responsables.some((responsable) => esJefeArea(responsable.puesto))) {
      throw new ConflictException('Este departamento ya tiene un Jefe de área asignado. Solo puede haber uno por departamento.');
    }
  }

  async crear(dto: CrearEmpleadoDto, usuarioId: number) {
    const d = limpiar(dto);
    const departamentoId = await this.deptos.obtenerOCrear(d.departamento);
    await this.verificarPuesto(d.puestoId, departamentoId);
    await this.verificarDuplicado(d.nombre, departamentoId);
    return this.db.transaction(async (tx) => {
      await this.verificarJefeDisponible(d.puestoId, departamentoId, undefined, tx);
      const [e] = await tx
        .insert(empleados)
        .values({ nombre: d.nombre, numero: d.numero, correo: d.correo?.toLowerCase() ?? null, notas: d.notas, departamentoId, puestoId: d.puestoId ?? null })
        .returning();
      await this.bitacora.registrar({ usuarioId, accion: `Dio de alta a ${e.nombre}`, entidad: 'empleado', entidadId: e.id }, tx);
      return e;
    });
  }

  async actualizar(id: number, dto: ActualizarEmpleadoDto, usuarioId: number) {
    const actual = await this.db.query.empleados.findFirst({ where: eq(empleados.id, id) });
    if (!actual) throw new NotFoundException('El empleado no existe.');
    const d = limpiar(dto);
    const data: Partial<typeof empleados.$inferInsert> = {};
    if (d.nombre !== undefined) data.nombre = d.nombre ?? actual.nombre;
    if (d.numero !== undefined) data.numero = d.numero;
    if (d.correo !== undefined) data.correo = d.correo?.toLowerCase() ?? null;
    if (d.notas !== undefined) data.notas = d.notas;
    if (dto.departamento !== undefined) data.departamentoId = await this.deptos.obtenerOCrear(d.departamento);
    const departamentoId = data.departamentoId !== undefined ? data.departamentoId : actual.departamentoId;
    if (d.puestoId !== undefined) {
      await this.verificarPuesto(d.puestoId, departamentoId);
      data.puestoId = d.puestoId;
    } else if (data.departamentoId !== undefined && data.departamentoId !== actual.departamentoId) {
      data.puestoId = null;
    }
    if (!Object.keys(data).length) throw new BadRequestException('No enviaste cambios.');
    await this.verificarDuplicado(data.nombre ?? actual.nombre, data.departamentoId !== undefined ? data.departamentoId : actual.departamentoId, id);
    const puestoId = data.puestoId !== undefined ? data.puestoId : actual.puestoId;
    return this.db.transaction(async (tx) => {
      await this.verificarJefeDisponible(puestoId, departamentoId, id, tx);
      const [e] = await tx.update(empleados).set(data).where(eq(empleados.id, id)).returning();
      if (data.nombre) await tx.update(usuariosSistema).set({ nombre: e.nombre }).where(eq(usuariosSistema.empleadoId, id));
      await this.bitacora.registrar({ usuarioId, accion: `Modificó los datos de ${e.nombre}`, entidad: 'empleado', entidadId: id, detalle: { cambios: Object.keys(data) } }, tx);
      return e;
    });
  }

  /**
   * Da de baja al empleado y regresa sus equipos asignados al inventario como disponibles.
   * Los equipos dañados, en reparación o en resguardo conservan su vínculo hasta quedar disponibles o de baja.
   */
  baja(id: number, usuarioId: number) {
    return this.db.transaction(async (tx) => {
      const e = await tx.query.empleados.findFirst({ where: eq(empleados.id, id), with: { equiposActuales: true } });
      if (!e) throw new NotFoundException('El empleado no existe.');
      if (!e.activo) throw new BadRequestException('El empleado ya está dado de baja.');
      for (const eq_ of e.equiposActuales) {
        if (eq_.estatus !== 'ASIGNADO') {
          if (!sigueLigado(eq_.estatus)) await tx.update(equipos).set({ empleadoId: null }).where(eq(equipos.id, eq_.id));
          continue;
        }
        await this.asignaciones.cerrarVigente(tx, eq_.id, usuarioId, 'DISPONIBLE', hoy(), `Devuelto por baja de ${e.nombre}`);
        await tx.update(equipos).set({ estatus: 'DISPONIBLE' }).where(eq(equipos.id, eq_.id));
        await this.bitacora.registrar({ usuarioId, accion: `Recibió ${nombreEquipo(eq_)} por baja de ${e.nombre}`, entidad: 'equipo', entidadId: eq_.id }, tx);
      }
      const [r] = await tx.update(empleados).set({ activo: false, fechaBaja: hoy() }).where(eq(empleados.id, id)).returning();
      // Pierde el acceso a la app; si se reactiva, el admin decide si se lo devuelve.
      await tx.update(usuariosSistema).set({ activo: false }).where(eq(usuariosSistema.empleadoId, id));
      await this.bitacora.registrar(
        { usuarioId, accion: `Dio de baja a ${e.nombre}`, entidad: 'empleado', entidadId: id, detalle: { equiposDevueltos: e.equiposActuales.length } },
        tx,
      );
      return { ...r, equiposDevueltos: e.equiposActuales.length };
    });
  }

  async reactivar(id: number, usuarioId: number) {
    const [e] = await this.db.update(empleados).set({ activo: true, fechaBaja: null }).where(eq(empleados.id, id)).returning();
    if (!e) throw new NotFoundException('El empleado no existe.');
    await this.bitacora.registrar({ usuarioId, accion: `Reactivó a ${e.nombre}`, entidad: 'empleado', entidadId: id });
    return e;
  }

  /** Solo para empleados dados de baja y sin historial (por ejemplo, altas por error). */
  async eliminar(id: number, usuarioId: number) {
    const e = await this.db.query.empleados.findFirst({ where: eq(empleados.id, id) });
    if (!e) throw new NotFoundException('El empleado no existe.');
    if (e.activo) throw new BadRequestException('Primero da de baja al empleado.');
    if ((await this.db.$count(asignaciones, eq(asignaciones.empleadoId, id))) > 0) {
      throw new BadRequestException('Tiene historial de asignaciones; mantenlo dado de baja para conservarlo.');
    }
    await this.db.delete(empleados).where(eq(empleados.id, id));
    await this.bitacora.registrar({ usuarioId, accion: `Eliminó a ${e.nombre}`, entidad: 'empleado', entidadId: id });
    return { ok: true };
  }
}
