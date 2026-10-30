// Esquema de la base de datos del inventario de equipos.
import { relations, sql } from 'drizzle-orm';
import { AnyPgColumn, boolean, date, index, integer, jsonb, pgEnum, pgSequence, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const rol = pgEnum('rol', ['ADMIN', 'TECNICO', 'CONSULTA', 'EMPLEADO']);
export const ambitoEquipo = pgEnum('ambito_equipo', ['USUARIO', 'INFRAESTRUCTURA']);
export const estatusEquipo = pgEnum('estatus_equipo', ['DISPONIBLE', 'ASIGNADO', 'EN_REPARACION', 'DANADO', 'RESGUARDO', 'BAJA']);
export const tipoAdaptador = pgEnum('tipo_adaptador', ['RED', 'MULTIPUERTOS']);
export const estadoReporte = pgEnum('estado_reporte', ['PENDIENTE', 'EN_ATENCION', 'CERRADO']);

export type Rol = (typeof rol.enumValues)[number];
export type TipoEquipo = string;
export type AmbitoEquipo = (typeof ambitoEquipo.enumValues)[number];
export type EstatusEquipo = (typeof estatusEquipo.enumValues)[number];
export type TipoAdaptador = (typeof tipoAdaptador.enumValues)[number];
export type EstadoReporte = (typeof estadoReporte.enumValues)[number];
/** Roles del personal que administra el inventario (los que no son EMPLEADO). */
export const ROLES_PERSONAL = ['ADMIN', 'TECNICO', 'CONSULTA'] as const satisfies readonly Rol[];

const creadoEn = () => timestamp('creado_en', { withTimezone: true }).defaultNow().notNull();
const actualizadoEn = () => timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date());
const fecha = (n: string) => date(n, { mode: 'string' });

export const departamentos = pgTable('departamentos', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 80 }).notNull().unique(),
  creadoEn: creadoEn(),
});

export const puestos = pgTable(
  'puestos',
  {
    id: serial('id').primaryKey(),
    departamentoId: integer('departamento_id').notNull().references(() => departamentos.id, { onDelete: 'cascade' }),
    nombre: varchar('nombre', { length: 80 }).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex('puestos_departamento_nombre_unico').on(t.departamentoId, sql`lower(${t.nombre})`)],
);

export const tiposEquipo = pgTable('tipos_equipo', {
  nombre: varchar('nombre', { length: 80 }).primaryKey(),
  predeterminado: boolean('predeterminado').default(false).notNull(),
  creadoEn: creadoEn(),
});

export const marcasEquipo = pgTable(
  'marcas_equipo',
  {
    id: serial('id').primaryKey(),
    nombre: varchar('nombre', { length: 80 }).notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [uniqueIndex('marcas_equipo_nombre_unico').on(sql`lower(${t.nombre})`)],
);

export const empleados = pgTable(
  'empleados',
  {
    id: serial('id').primaryKey(),
    numero: varchar('numero', { length: 40 }),
    nombre: varchar('nombre', { length: 150 }).notNull(),
    correo: varchar('correo', { length: 150 }),
    notas: text('notas'),
    puestoId: integer('puesto_id').references(() => puestos.id, { onDelete: 'set null' }),
    activo: boolean('activo').default(true).notNull(),
    fechaBaja: fecha('fecha_baja'),
    departamentoId: integer('departamento_id').references(() => departamentos.id),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [index('empleados_nombre_idx').on(t.nombre), index('empleados_departamento_idx').on(t.departamentoId)],
);

export const usuariosSistema = pgTable('usuarios_sistema', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 120 }).notNull(),
  usuario: varchar('usuario', { length: 60 }).notNull().unique(),
  correo: varchar('correo', { length: 150 }).unique(),
  passwordHash: text('password_hash').notNull(),
  rol: rol('rol').default('CONSULTA').notNull(),
  activo: boolean('activo').default(true).notNull(),
  // Solo para el rol EMPLEADO: la ficha del empleado al que pertenece la cuenta de la app.
  empleadoId: integer('empleado_id').unique().references(() => empleados.id, { onDelete: 'cascade' }),
  // Contraseña temporal puesta por el admin: hasta cambiarla solo puede usar las rutas de su sesión.
  debeCambiarPassword: boolean('debe_cambiar_password').default(false).notNull(),
  ultimoAcceso: timestamp('ultimo_acceso', { withTimezone: true }),
  creadoEn: creadoEn(),
  actualizadoEn: actualizadoEn(),
});

// Consecutivo de los códigos de barras automáticos de los equipos.
export const equiposCodigoSeq = pgSequence('equipos_codigo_seq', { startWith: 1 });

export const equipos = pgTable(
  'equipos',
  {
    id: serial('id').primaryKey(),
    tipo: varchar('tipo', { length: 80 }).notNull().references(() => tiposEquipo.nombre, { onUpdate: 'cascade' }),
    ambito: ambitoEquipo('ambito').default('USUARIO').notNull(),
    descripcion: varchar('descripcion', { length: 200 }),
    marca: varchar('marca', { length: 80 }),
    modelo: varchar('modelo', { length: 120 }),
    serie: varchar('serie', { length: 120 }),
    // Si no se captura uno, se genera el siguiente consecutivo: DRFC000001, DRFC000002...
    codigoBarras: varchar('codigo_barras', { length: 120 }).default(sql`'DRFC' || lpad(nextval('equipos_codigo_seq')::text, 6, '0')`),
    color: varchar('color', { length: 60 }),
    memoriaGb: varchar('memoria_gb', { length: 20 }),
    procesador: varchar('procesador', { length: 120 }),
    disco: varchar('disco', { length: 40 }),
    sistemaOperativo: varchar('sistema_operativo', { length: 120 }),
    ipGestion: varchar('ip_gestion', { length: 60 }),
    tipoAdaptador: tipoAdaptador('tipo_adaptador'),
    estatus: estatusEquipo('estatus').default('DISPONIBLE').notNull(),
    notas: text('notas'),
    fechaBaja: fecha('fecha_baja'),
    motivoBaja: text('motivo_baja'),
    // Empleado que tiene el equipo ahora mismo (null si no está asignado).
    empleadoId: integer('empleado_id').references(() => empleados.id),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    index('equipos_serie_idx').on(sql`lower(${t.serie})`),
    uniqueIndex('equipos_codigo_barras_unico').on(sql`lower(${t.codigoBarras})`),
    index('equipos_estatus_idx').on(t.estatus),
    index('equipos_tipo_idx').on(t.tipo),
    index('equipos_empleado_idx').on(t.empleadoId),
  ],
);

// Historial de entregas y devoluciones. Una asignación vigente tiene fecha_devolucion = null.
export const asignaciones = pgTable(
  'asignaciones',
  {
    id: serial('id').primaryKey(),
    equipoId: integer('equipo_id').notNull().references(() => equipos.id, { onDelete: 'cascade' }),
    empleadoId: integer('empleado_id').notNull().references(() => empleados.id),
    fechaEntrega: fecha('fecha_entrega'),
    fechaDevolucion: fecha('fecha_devolucion'),
    notas: text('notas'),
    // Cuando un jefe de área recibe el equipo para alguien de su departamento: puesto y nombre (opcional) de quien lo usa.
    puestoDestinatarioId: integer('puesto_destinatario_id').references(() => puestos.id, { onDelete: 'set null' }),
    nombreDestinatario: varchar('nombre_destinatario', { length: 150 }),
    // Estatus en que quedó el equipo al cerrar la asignación (devuelto, dañado, a reparación o baja).
    resultado: estatusEquipo('resultado'),
    // Equipo dañado o en reparación al que sustituye mientras la asignación es temporal.
    sustituyeEquipoId: integer('sustituye_equipo_id').references((): AnyPgColumn => equipos.id, { onDelete: 'set null' }),
    entregadoPorId: integer('entregado_por_id').references(() => usuariosSistema.id, { onDelete: 'set null' }),
    recibidoPorId: integer('recibido_por_id').references(() => usuariosSistema.id, { onDelete: 'set null' }),
    creadoEn: creadoEn(),
  },
  (t) => [
    index('asignaciones_equipo_idx').on(t.equipoId),
    index('asignaciones_empleado_idx').on(t.empleadoId),
    // Garantiza en la base que un equipo no tenga dos asignaciones vigentes.
    uniqueIndex('asignaciones_vigente_unica').on(t.equipoId).where(sql`${t.fechaDevolucion} is null`),
  ],
);

export const reparaciones = pgTable(
  'reparaciones',
  {
    id: serial('id').primaryKey(),
    equipoId: integer('equipo_id').notNull().references(() => equipos.id, { onDelete: 'cascade' }),
    fechaEnvio: fecha('fecha_envio').notNull(),
    motivo: text('motivo').notNull(),
    proveedor: varchar('proveedor', { length: 150 }),
    fechaRecepcion: fecha('fecha_recepcion'),
    solucion: text('solucion'),
    resultado: estatusEquipo('resultado'),
    creadoPorId: integer('creado_por_id').references(() => usuariosSistema.id, { onDelete: 'set null' }),
    creadoEn: creadoEn(),
  },
  (t) => [index('reparaciones_equipo_idx').on(t.equipoId)],
);

export const bitacora = pgTable(
  'bitacora',
  {
    id: serial('id').primaryKey(),
    usuarioId: integer('usuario_id').references(() => usuariosSistema.id, { onDelete: 'set null' }),
    accion: text('accion').notNull(),
    entidad: varchar('entidad', { length: 30 }).notNull(),
    entidadId: integer('entidad_id'),
    detalle: jsonb('detalle'),
    fecha: timestamp('fecha', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('bitacora_entidad_idx').on(t.entidad, t.entidadId), index('bitacora_fecha_idx').on(t.fecha)],
);

// Fallas que un empleado reporta desde la app sobre un equipo que tiene. No cambian el estatus del equipo.
export const reportesFalla = pgTable(
  'reportes_falla',
  {
    id: serial('id').primaryKey(),
    equipoId: integer('equipo_id').notNull().references(() => equipos.id, { onDelete: 'cascade' }),
    empleadoId: integer('empleado_id').notNull().references(() => empleados.id, { onDelete: 'cascade' }),
    descripcion: text('descripcion').notNull(),
    estado: estadoReporte('estado').default('PENDIENTE').notNull(),
    // Lo que el admin le responde al empleado al atender o cerrar el reporte.
    respuesta: text('respuesta'),
    reparacionId: integer('reparacion_id').references(() => reparaciones.id, { onDelete: 'set null' }),
    atendidoPorId: integer('atendido_por_id').references(() => usuariosSistema.id, { onDelete: 'set null' }),
    atendidoEn: timestamp('atendido_en', { withTimezone: true }),
    cerradoEn: timestamp('cerrado_en', { withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [
    index('reportes_falla_estado_idx').on(t.estado),
    index('reportes_falla_empleado_idx').on(t.empleadoId),
    // Un solo reporte abierto por equipo, para no duplicar avisos al admin.
    uniqueIndex('reportes_falla_abierto_unico').on(t.equipoId).where(sql`${t.estado} <> 'CERRADO'`),
  ],
);

// Celulares con la app que reciben notificaciones push (token de Expo). Un celular pertenece a quien inició sesión en él.
export const dispositivosPush = pgTable(
  'dispositivos_push',
  {
    id: serial('id').primaryKey(),
    usuarioId: integer('usuario_id').notNull().references(() => usuariosSistema.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 200 }).notNull().unique(),
    plataforma: varchar('plataforma', { length: 20 }),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [index('dispositivos_push_usuario_idx').on(t.usuarioId)],
);

// ---------- Relaciones (para consultas con `with`) ----------
export const departamentosRel = relations(departamentos, ({ many }) => ({ empleados: many(empleados), puestos: many(puestos) }));

export const puestosRel = relations(puestos, ({ one, many }) => ({
  departamento: one(departamentos, { fields: [puestos.departamentoId], references: [departamentos.id] }),
  empleados: many(empleados),
}));

export const tiposEquipoRel = relations(tiposEquipo, ({ many }) => ({ equipos: many(equipos) }));

export const empleadosRel = relations(empleados, ({ one, many }) => ({
  departamento: one(departamentos, { fields: [empleados.departamentoId], references: [departamentos.id] }),
  puesto: one(puestos, { fields: [empleados.puestoId], references: [puestos.id] }),
  equiposActuales: many(equipos),
  asignaciones: many(asignaciones),
}));

export const equiposRel = relations(equipos, ({ one, many }) => ({
  empleado: one(empleados, { fields: [equipos.empleadoId], references: [empleados.id] }),
  tipoCatalogo: one(tiposEquipo, { fields: [equipos.tipo], references: [tiposEquipo.nombre] }),
  asignaciones: many(asignaciones),
  reparaciones: many(reparaciones),
  reportesFalla: many(reportesFalla),
}));

export const asignacionesRel = relations(asignaciones, ({ one }) => ({
  equipo: one(equipos, { fields: [asignaciones.equipoId], references: [equipos.id] }),
  empleado: one(empleados, { fields: [asignaciones.empleadoId], references: [empleados.id] }),
  puestoDestinatario: one(puestos, { fields: [asignaciones.puestoDestinatarioId], references: [puestos.id] }),
  entregadoPor: one(usuariosSistema, { fields: [asignaciones.entregadoPorId], references: [usuariosSistema.id], relationName: 'entregas' }),
  recibidoPor: one(usuariosSistema, { fields: [asignaciones.recibidoPorId], references: [usuariosSistema.id], relationName: 'recepciones' }),
}));

export const reparacionesRel = relations(reparaciones, ({ one }) => ({
  equipo: one(equipos, { fields: [reparaciones.equipoId], references: [equipos.id] }),
  creadoPor: one(usuariosSistema, { fields: [reparaciones.creadoPorId], references: [usuariosSistema.id] }),
}));

export const reportesFallaRel = relations(reportesFalla, ({ one }) => ({
  equipo: one(equipos, { fields: [reportesFalla.equipoId], references: [equipos.id] }),
  empleado: one(empleados, { fields: [reportesFalla.empleadoId], references: [empleados.id] }),
  reparacion: one(reparaciones, { fields: [reportesFalla.reparacionId], references: [reparaciones.id] }),
  atendidoPor: one(usuariosSistema, { fields: [reportesFalla.atendidoPorId], references: [usuariosSistema.id] }),
}));

export const usuariosSistemaRel = relations(usuariosSistema, ({ one, many }) => ({
  empleado: one(empleados, { fields: [usuariosSistema.empleadoId], references: [empleados.id] }),
  entregas: many(asignaciones, { relationName: 'entregas' }),
  recepciones: many(asignaciones, { relationName: 'recepciones' }),
}));

export const bitacoraRel = relations(bitacora, ({ one }) => ({
  usuario: one(usuariosSistema, { fields: [bitacora.usuarioId], references: [usuariosSistema.id] }),
}));

export type Equipo = typeof equipos.$inferSelect;
export type Empleado = typeof empleados.$inferSelect;
