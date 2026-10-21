import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, getTableColumns, ilike, isNull, ne, or, SQL, sql } from 'drizzle-orm';
import { DB, InjectDb } from '../db/db.module';
import { asignaciones, departamentos, empleados, equipos } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { DepartamentosService } from '../departamentos/departamentos.service';
import { AsignacionesService, nombreEquipo } from '../asignaciones/asignaciones.service';
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
        equiposAsignados: sql<number>`(select count(*)::int from equipos q where q.empleado_id = "empleados"."id")`,
      })
      .from(empleados)
      .leftJoin(departamentos, eq(empleados.departamentoId, departamentos.id))
      .where(c.length ? and(...c) : undefined)
      .orderBy(asc(empleados.nombre));
  }

  async obtener(id: number) {
    const e = await this.db.query.empleados.findFirst({
      where: eq(empleados.id, id),
      with: {
        departamento: true,
        equiposActuales: { orderBy: [asc(equipos.tipo)] },
        asignaciones: {
          orderBy: [desc(asignaciones.fechaEntrega), desc(asignaciones.id)],
          with: { equipo: { columns: { id: true, tipo: true, marca: true, modelo: true, serie: true } } },
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

  async crear(dto: CrearEmpleadoDto, usuarioId: number) {
    const d = limpiar(dto);
    const departamentoId = await this.deptos.obtenerOCrear(d.departamento);
    await this.verificarDuplicado(d.nombre, departamentoId);
    const [e] = await this.db
      .insert(empleados)
      .values({ nombre: d.nombre, numero: d.numero, correo: d.correo?.toLowerCase() ?? null, notas: d.notas, departamentoId })
      .returning();
    await this.bitacora.registrar({ usuarioId, accion: `Dio de alta a ${e.nombre}`, entidad: 'empleado', entidadId: e.id });
    return e;
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
    if (!Object.keys(data).length) throw new BadRequestException('No enviaste cambios.');
    await this.verificarDuplicado(data.nombre ?? actual.nombre, data.departamentoId !== undefined ? data.departamentoId : actual.departamentoId, id);
    const [e] = await this.db.update(empleados).set(data).where(eq(empleados.id, id)).returning();
    await this.bitacora.registrar({ usuarioId, accion: `Modificó los datos de ${e.nombre}`, entidad: 'empleado', entidadId: id, detalle: { cambios: Object.keys(data) } });
    return e;
  }

  /** Da de baja al empleado y regresa todos sus equipos al inventario como disponibles. */
  baja(id: number, usuarioId: number) {
    return this.db.transaction(async (tx) => {
      const e = await tx.query.empleados.findFirst({ where: eq(empleados.id, id), with: { equiposActuales: true } });
      if (!e) throw new NotFoundException('El empleado no existe.');
      if (!e.activo) throw new BadRequestException('El empleado ya está dado de baja.');
      for (const eq_ of e.equiposActuales) {
        await this.asignaciones.cerrarVigente(tx, eq_.id, usuarioId, hoy(), `Devuelto por baja de ${e.nombre}`);
        await tx.update(equipos).set({ estatus: 'DISPONIBLE' }).where(eq(equipos.id, eq_.id));
        await this.bitacora.registrar({ usuarioId, accion: `Recibió ${nombreEquipo(eq_)} por baja de ${e.nombre}`, entidad: 'equipo', entidadId: eq_.id }, tx);
      }
      const [r] = await tx.update(empleados).set({ activo: false, fechaBaja: hoy() }).where(eq(empleados.id, id)).returning();
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
