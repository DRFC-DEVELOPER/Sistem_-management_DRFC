import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, ne, sql } from 'drizzle-orm';
import { DB, DbOTx, InjectDb } from '../db/db.module';
import { asignaciones, empleados, equipos, reportesFalla } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { nombreEquipo } from '../asignaciones/asignaciones.service';
import { ReparacionesService } from '../reparaciones/reparaciones.service';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { AtenderReporteDto, CerrarReporteDto, CrearReporteDto, FiltroReportesDto, ReporteAReparacionDto } from './dto/reporte.dto';

const equipoBreve = { columns: { id: true, tipo: true, marca: true, modelo: true, serie: true, codigoBarras: true, estatus: true } } as const;

@Injectable()
export class ReportesService {
  constructor(
    @InjectDb() private db: DB,
    private bitacora: BitacoraService,
    private reparaciones: ReparacionesService,
    private notificaciones: NotificacionesService,
  ) {}

  // Al tocar la notificación, la app abre la lista de sus equipos.
  private avisarEmpleado(r: { id: number; empleadoId: number; equipo: { tipo: string; marca: string | null; modelo: string | null; serie: string | null } }, titulo: string, cuerpo: string) {
    this.notificaciones.aEmpleado(r.empleadoId, { titulo, cuerpo: `${nombreEquipo(r.equipo)}: ${cuerpo}`, datos: { tipo: 'reporte', reporteId: r.id } });
  }

  // ---------- Administración (web) ----------

  listar(f: FiltroReportesDto) {
    return this.db.query.reportesFalla.findMany({
      where: f.estado ? eq(reportesFalla.estado, f.estado) : undefined,
      orderBy: [sql`${reportesFalla.estado} = 'CERRADO'`, desc(reportesFalla.creadoEn)],
      limit: 500,
      with: {
        equipo: equipoBreve,
        empleado: { columns: { id: true, nombre: true }, with: { departamento: { columns: { nombre: true } } } },
        atendidoPor: { columns: { nombre: true } },
        reparacion: { columns: { id: true, fechaEnvio: true, fechaRecepcion: true, proveedor: true } },
      },
    });
  }

  /** Para el contador del menú: reportes que nadie ha atendido y los que siguen en proceso. */
  async resumen() {
    const filas = await this.db.select({ estado: reportesFalla.estado, n: count() }).from(reportesFalla).where(ne(reportesFalla.estado, 'CERRADO')).groupBy(reportesFalla.estado);
    const de = (estado: string) => filas.find((r) => r.estado === estado)?.n ?? 0;
    return { pendientes: de('PENDIENTE'), enAtencion: de('EN_ATENCION') };
  }

  private async abierto(id: number, tx: DbOTx = this.db) {
    const r = await tx.query.reportesFalla.findFirst({ where: eq(reportesFalla.id, id), with: { equipo: true, empleado: { columns: { nombre: true } } } });
    if (!r) throw new NotFoundException('El reporte no existe.');
    if (r.estado === 'CERRADO') throw new ConflictException('El reporte ya está cerrado.');
    return r;
  }

  /** Marca que alguien de soporte ya lo está revisando; el empleado lo ve en la app. */
  async atender(id: number, dto: AtenderReporteDto, usuarioId: number) {
    const r = await this.abierto(id);
    const [a] = await this.db
      .update(reportesFalla)
      .set({ estado: 'EN_ATENCION', respuesta: dto.respuesta?.trim() || r.respuesta, atendidoPorId: usuarioId, atendidoEn: r.atendidoEn ?? new Date() })
      .where(eq(reportesFalla.id, id))
      .returning();
    await this.bitacora.registrar({ usuarioId, accion: `Atendió el reporte de falla de ${nombreEquipo(r.equipo)} (${r.empleado.nombre})`, entidad: 'equipo', entidadId: r.equipoId });
    this.avisarEmpleado(r, 'Soporte está atendiendo tu reporte', a.respuesta ?? 'Ya revisamos tu reporte.');
    return a;
  }

  /** Envía el equipo a reparación con la falla reportada y deja el reporte en atención, ligado a esa reparación. */
  async enviarAReparacion(id: number, dto: ReporteAReparacionDto, usuarioId: number) {
    const a = await this.db.transaction(async (tx) => {
      const r = await this.abierto(id, tx);
      if (r.reparacionId) throw new ConflictException('Este reporte ya se envió a reparación.');
      const reparacion = await this.reparaciones.enviarEn(
        tx,
        { equipoId: r.equipoId, motivo: dto.motivo?.trim() || `Reporte de ${r.empleado.nombre}: ${r.descripcion}`, proveedor: dto.proveedor, fechaEnvio: dto.fechaEnvio },
        usuarioId,
      );
      const [a] = await tx
        .update(reportesFalla)
        .set({ estado: 'EN_ATENCION', reparacionId: reparacion.id, respuesta: r.respuesta ?? 'Tu equipo se envió a reparación.', atendidoPorId: usuarioId, atendidoEn: r.atendidoEn ?? new Date() })
        .where(eq(reportesFalla.id, id))
        .returning();
      return { ...a, equipo: r.equipo };
    });
    // Se avisa hasta que la transacción quedó guardada.
    this.avisarEmpleado(a, 'Tu equipo se envió a reparación', a.respuesta ?? 'Soporte lo envió a reparación.');
    const { equipo: _, ...reporte } = a;
    return reporte;
  }

  async cerrar(id: number, dto: CerrarReporteDto, usuarioId: number) {
    const r = await this.abierto(id);
    const [a] = await this.db
      .update(reportesFalla)
      .set({ estado: 'CERRADO', respuesta: dto.respuesta.trim(), atendidoPorId: usuarioId, atendidoEn: r.atendidoEn ?? new Date(), cerradoEn: new Date() })
      .where(eq(reportesFalla.id, id))
      .returning();
    await this.bitacora.registrar({ usuarioId, accion: `Cerró el reporte de falla de ${nombreEquipo(r.equipo)} (${r.empleado.nombre})`, entidad: 'equipo', entidadId: r.equipoId, detalle: { respuesta: a.respuesta } });
    this.avisarEmpleado(r, 'Soporte cerró tu reporte', a.respuesta ?? '');
    return a;
  }

  // ---------- Empleado (app móvil) ----------

  async miPerfil(empleadoId: number) {
    const e = await this.db.query.empleados.findFirst({
      where: eq(empleados.id, empleadoId),
      columns: { id: true, numero: true, nombre: true, correo: true, activo: true },
      with: { departamento: { columns: { id: true, nombre: true } }, puesto: { columns: { id: true, nombre: true } } },
    });
    if (!e) throw new NotFoundException('No se encontró tu ficha de empleado.');
    return e;
  }

  /** Equipos que tiene (asignados, o ligados a él mientras están dañados, en reparación o en resguardo). */
  async misEquipos(empleadoId: number) {
    const lista = await this.db.query.equipos.findMany({
      where: eq(equipos.empleadoId, empleadoId),
      columns: {
        id: true, tipo: true, descripcion: true, marca: true, modelo: true, serie: true, codigoBarras: true, color: true,
        memoriaGb: true, procesador: true, disco: true, sistemaOperativo: true, tipoAdaptador: true, estatus: true,
      },
      with: {
        asignaciones: {
          where: eq(asignaciones.empleadoId, empleadoId),
          orderBy: [desc(asignaciones.id)],
          limit: 1,
          columns: { fechaEntrega: true, fechaDevolucion: true, nombreDestinatario: true, sustituyeEquipoId: true },
          with: { puestoDestinatario: { columns: { id: true, nombre: true } } },
        },
        reportesFalla: {
          where: ne(reportesFalla.estado, 'CERRADO'),
          columns: { id: true, estado: true, descripcion: true, respuesta: true, creadoEn: true },
        },
      },
      orderBy: [equipos.tipo, equipos.id],
    });
    return lista.map(({ asignaciones: [a], reportesFalla: [reporte], ...e }) => ({
      ...e,
      fechaEntrega: a?.fechaEntrega ?? null,
      // Si es un jefe de área, para quién de su departamento es el equipo (null = uso propio).
      paraPuesto: a?.puestoDestinatario ?? null,
      paraPersona: a?.puestoDestinatario ? a.nombreDestinatario : null,
      temporal: !a?.fechaDevolucion && !!a?.sustituyeEquipoId,
      reporteAbierto: reporte ?? null,
    }));
  }

  misReportes(empleadoId: number) {
    return this.db.query.reportesFalla.findMany({
      where: eq(reportesFalla.empleadoId, empleadoId),
      orderBy: [desc(reportesFalla.creadoEn)],
      limit: 100,
      columns: { id: true, equipoId: true, descripcion: true, estado: true, respuesta: true, creadoEn: true, atendidoEn: true, cerradoEn: true },
      with: { equipo: equipoBreve },
    });
  }

  async crear(empleadoId: number, dto: CrearReporteDto, usuarioId: number) {
    const e = await this.db.query.equipos.findFirst({ where: eq(equipos.id, dto.equipoId) });
    // Mismo mensaje si no existe o no es suyo, para no revelar equipos de otros.
    if (!e || e.empleadoId !== empleadoId) throw new NotFoundException('Ese equipo no está entre los que tienes asignados.');
    if (e.estatus === 'BAJA') throw new BadRequestException('El equipo está dado de baja.');
    const abierto = await this.db.query.reportesFalla.findFirst({ where: and(eq(reportesFalla.equipoId, e.id), ne(reportesFalla.estado, 'CERRADO')) });
    if (abierto) throw new ConflictException('Ya hay un reporte abierto para este equipo; soporte ya está enterado.');
    const [r] = await this.db
      .insert(reportesFalla)
      .values({ equipoId: e.id, empleadoId, descripcion: dto.descripcion.trim() })
      .returning()
      .catch((err: { code?: string }) => {
        // Dos envíos al mismo tiempo: el índice único deja pasar solo uno.
        if (err.code === '23505') throw new ConflictException('Ya hay un reporte abierto para este equipo; soporte ya está enterado.');
        throw err;
      });
    await this.bitacora.registrar({ usuarioId, accion: `Reportó una falla en ${nombreEquipo(e)}`, entidad: 'equipo', entidadId: e.id, detalle: { reporteId: r.id, descripcion: r.descripcion } });
    const empleado = await this.db.query.empleados.findFirst({ where: eq(empleados.id, empleadoId), columns: { nombre: true } });
    this.notificaciones.aSoporte({
      titulo: `Solicitud de soporte: ${nombreEquipo(e)}`,
      cuerpo: `${empleado?.nombre ?? 'Un empleado'}: ${r.descripcion}`,
      datos: { tipo: 'reporte', reporteId: r.id, equipoId: e.id },
    });
    return r;
  }
}
