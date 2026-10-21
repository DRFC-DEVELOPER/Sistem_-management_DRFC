CREATE TYPE "public"."estatus_equipo" AS ENUM('DISPONIBLE', 'ASIGNADO', 'EN_REPARACION', 'DANADO', 'BAJA');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('ADMIN', 'TECNICO', 'CONSULTA');--> statement-breakpoint
CREATE TYPE "public"."tipo_adaptador" AS ENUM('RED', 'MULTIPUERTOS');--> statement-breakpoint
CREATE TYPE "public"."tipo_equipo" AS ENUM('LAPTOP', 'TECLADO', 'MOUSE', 'MONITOR', 'ADAPTADOR', 'MULTIFUNCIONAL', 'ACCESS_POINT', 'OTRO');--> statement-breakpoint
CREATE TABLE "asignaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipo_id" integer NOT NULL,
	"empleado_id" integer NOT NULL,
	"fecha_entrega" date,
	"fecha_devolucion" date,
	"notas" text,
	"entregado_por_id" integer,
	"recibido_por_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bitacora" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer,
	"accion" text NOT NULL,
	"entidad" varchar(30) NOT NULL,
	"entidad_id" integer,
	"detalle" jsonb,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departamentos_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "empleados" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" varchar(40),
	"nombre" varchar(150) NOT NULL,
	"correo" varchar(150),
	"notas" text,
	"activo" boolean DEFAULT true NOT NULL,
	"fecha_baja" date,
	"departamento_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" "tipo_equipo" NOT NULL,
	"descripcion" varchar(200),
	"marca" varchar(80),
	"modelo" varchar(120),
	"serie" varchar(120),
	"codigo_barras" varchar(120),
	"color" varchar(60),
	"memoria_gb" varchar(20),
	"procesador" varchar(120),
	"disco" varchar(40),
	"sistema_operativo" varchar(120),
	"ip_gestion" varchar(60),
	"tipo_adaptador" "tipo_adaptador",
	"estatus" "estatus_equipo" DEFAULT 'DISPONIBLE' NOT NULL,
	"notas" text,
	"fecha_baja" date,
	"motivo_baja" text,
	"empleado_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reparaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipo_id" integer NOT NULL,
	"fecha_envio" date NOT NULL,
	"motivo" text NOT NULL,
	"proveedor" varchar(150),
	"fecha_recepcion" date,
	"solucion" text,
	"resultado" "estatus_equipo",
	"creado_por_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios_sistema" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(120) NOT NULL,
	"correo" varchar(150) NOT NULL,
	"password_hash" text NOT NULL,
	"rol" "rol" DEFAULT 'CONSULTA' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"ultimo_acceso" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_sistema_correo_unique" UNIQUE("correo")
);
--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_entregado_por_id_usuarios_sistema_id_fk" FOREIGN KEY ("entregado_por_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_recibido_por_id_usuarios_sistema_id_fk" FOREIGN KEY ("recibido_por_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bitacora" ADD CONSTRAINT "bitacora_usuario_id_usuarios_sistema_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_departamento_id_departamentos_id_fk" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparaciones" ADD CONSTRAINT "reparaciones_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reparaciones" ADD CONSTRAINT "reparaciones_creado_por_id_usuarios_sistema_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "asignaciones_equipo_idx" ON "asignaciones" USING btree ("equipo_id");--> statement-breakpoint
CREATE INDEX "asignaciones_empleado_idx" ON "asignaciones" USING btree ("empleado_id");--> statement-breakpoint
CREATE UNIQUE INDEX "asignaciones_vigente_unica" ON "asignaciones" USING btree ("equipo_id") WHERE "asignaciones"."fecha_devolucion" is null;--> statement-breakpoint
CREATE INDEX "bitacora_entidad_idx" ON "bitacora" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "bitacora_fecha_idx" ON "bitacora" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "empleados_nombre_idx" ON "empleados" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "empleados_departamento_idx" ON "empleados" USING btree ("departamento_id");--> statement-breakpoint
CREATE INDEX "equipos_serie_idx" ON "equipos" USING btree (lower("serie"));--> statement-breakpoint
CREATE UNIQUE INDEX "equipos_codigo_barras_unico" ON "equipos" USING btree (lower("codigo_barras"));--> statement-breakpoint
CREATE INDEX "equipos_estatus_idx" ON "equipos" USING btree ("estatus");--> statement-breakpoint
CREATE INDEX "equipos_tipo_idx" ON "equipos" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "equipos_empleado_idx" ON "equipos" USING btree ("empleado_id");--> statement-breakpoint
CREATE INDEX "reparaciones_equipo_idx" ON "reparaciones" USING btree ("equipo_id");