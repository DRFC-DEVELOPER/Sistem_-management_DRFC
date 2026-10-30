CREATE TYPE "public"."estado_reporte" AS ENUM('PENDIENTE', 'EN_ATENCION', 'CERRADO');--> statement-breakpoint
ALTER TYPE "public"."rol" ADD VALUE 'EMPLEADO';--> statement-breakpoint
CREATE TABLE "reportes_falla" (
	"id" serial PRIMARY KEY NOT NULL,
	"equipo_id" integer NOT NULL,
	"empleado_id" integer NOT NULL,
	"descripcion" text NOT NULL,
	"estado" "estado_reporte" DEFAULT 'PENDIENTE' NOT NULL,
	"respuesta" text,
	"reparacion_id" integer,
	"atendido_por_id" integer,
	"atendido_en" timestamp with time zone,
	"cerrado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usuarios_sistema" ADD COLUMN "empleado_id" integer;--> statement-breakpoint
ALTER TABLE "usuarios_sistema" ADD COLUMN "debe_cambiar_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_equipo_id_equipos_id_fk" FOREIGN KEY ("equipo_id") REFERENCES "public"."equipos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_reparacion_id_reparaciones_id_fk" FOREIGN KEY ("reparacion_id") REFERENCES "public"."reparaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reportes_falla" ADD CONSTRAINT "reportes_falla_atendido_por_id_usuarios_sistema_id_fk" FOREIGN KEY ("atendido_por_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reportes_falla_estado_idx" ON "reportes_falla" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "reportes_falla_empleado_idx" ON "reportes_falla" USING btree ("empleado_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reportes_falla_abierto_unico" ON "reportes_falla" USING btree ("equipo_id") WHERE "reportes_falla"."estado" <> 'CERRADO';--> statement-breakpoint
ALTER TABLE "usuarios_sistema" ADD CONSTRAINT "usuarios_sistema_empleado_id_empleados_id_fk" FOREIGN KEY ("empleado_id") REFERENCES "public"."empleados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_sistema" ADD CONSTRAINT "usuarios_sistema_empleado_id_unique" UNIQUE("empleado_id");