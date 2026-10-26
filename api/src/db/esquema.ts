// Esquema de la base de datos del inventario de equipos.
import { relations, sql } from 'drizzle-orm';
import { AnyPgColumn, boolean, date, index, integer, jsonb, pgEnum, pgSequence, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const rol = pgEnum('rol', ['ADMIN', 'TECNICO', 'CONSULTA']);
export const tipoEquipo = pgEnum('tipo_equipo', ['LAPTOP', 'TECLADO', 'MOUSE', 'MONITOR', 'ADAPTADOR', 'MULTIFUNCIONAL', 'SOPORTE', 'ACCESS_POINT', 'OTRO']);
export const estatusEquipo = pgEnum('estatus_equipo', ['DISPONIBLE', 'ASIGNADO', 'EN_REPARACION', 'DANADO', 'BAJA']);
export const tipoAdaptador = pgEnum('tipo_adaptador', ['RED', 'MULTIPUERTOS']);

export type Rol = (typeof rol.enumValues)[number];
export type TipoEquipo = (typeof tipoEquipo.enumValues)[number];
export type EstatusEquipo = (typeof estatusEquipo.enumValues)[number];
export type TipoAdaptador = (typeof tipoAdaptador.enumValues)[number];

const creadoEn = () => timestamp('creado_en', { withTimezone: true }).defaultNow().notNull();
const actualizadoEn = () => timestamp('actualizado_en', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date());
const fecha = (n: string) => date(n, { mode: 'string' });

export const departamentos = pgTable('departamentos', {
  id: serial('id').primaryKey(),
  nombre: varchar('nombre', { length: 80 }).notNull().unique(),
  creadoEn: creadoEn(),
});

export const empleados = pgTable(
  'empleados',
  {
    id: serial('id').primaryKey(),
    numero: varchar('numero', { length: 40 }),
    nombre: varchar('nombre', { length: 150 }).notNull(),
    correo: varchar('correo', { length: 150 }),
    notas: text('notas'),
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
    tipo: tipoEquipo('tipo').notNull(),
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

// ---------- Relaciones (para consultas con `with`) ----------
export const departamentosRel = relations(departamentos, ({ many }) => ({ empleados: many(empleados) }));

export const empleadosRel = relations(empleados, ({ one, many }) => ({
  departamento: one(departamentos, { fields: [empleados.departamentoId], references: [departamentos.id] }),
  equiposActuales: many(equipos),
  asignaciones: many(asignaciones),
}));

export const equiposRel = relations(equipos, ({ one, many }) => ({
  empleado: one(empleados, { fields: [equipos.empleadoId], references: [empleados.id] }),
  asignaciones: many(asignaciones),
  reparaciones: many(reparaciones),
}));

export const asignacionesRel = relations(asignaciones, ({ one }) => ({
  equipo: one(equipos, { fields: [asignaciones.equipoId], references: [equipos.id] }),
  empleado: one(empleados, { fields: [asignaciones.empleadoId], references: [empleados.id] }),
  entregadoPor: one(usuariosSistema, { fields: [asignaciones.entregadoPorId], references: [usuariosSistema.id], relationName: 'entregas' }),
  recibidoPor: one(usuariosSistema, { fields: [asignaciones.recibidoPorId], references: [usuariosSistema.id], relationName: 'recepciones' }),
}));

export const reparacionesRel = relations(reparaciones, ({ one }) => ({
  equipo: one(equipos, { fields: [reparaciones.equipoId], references: [equipos.id] }),
  creadoPor: one(usuariosSistema, { fields: [reparaciones.creadoPorId], references: [usuariosSistema.id] }),
}));

export const usuariosSistemaRel = relations(usuariosSistema, ({ many }) => ({
  entregas: many(asignaciones, { relationName: 'entregas' }),
  recepciones: many(asignaciones, { relationName: 'recepciones' }),
}));

export const bitacoraRel = relations(bitacora, ({ one }) => ({
  usuario: one(usuariosSistema, { fields: [bitacora.usuarioId], references: [usuariosSistema.id] }),
}));

export type Equipo = typeof equipos.$inferSelect;
export type Empleado = typeof empleados.$inferSelect;
