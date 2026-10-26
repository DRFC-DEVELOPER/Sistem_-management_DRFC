CREATE TABLE "marcas_equipo" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "puestos" (
	"id" serial PRIMARY KEY NOT NULL,
	"departamento_id" integer NOT NULL,
	"nombre" varchar(80) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tipos_equipo" (
	"nombre" varchar(80) PRIMARY KEY NOT NULL,
	"predeterminado" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "equipos" ALTER COLUMN "tipo" SET DATA TYPE varchar(80) USING "tipo"::text;--> statement-breakpoint
ALTER TABLE "empleados" ADD COLUMN "puesto_id" integer;--> statement-breakpoint
INSERT INTO "tipos_equipo" ("nombre", "predeterminado") VALUES
	('LAPTOP', true), ('TECLADO', true), ('MOUSE', true), ('MONITOR', true),
	('ADAPTADOR', true), ('MULTIFUNCIONAL', true), ('SOPORTE', true),
	('ACCESS_POINT', true), ('OTRO', true);--> statement-breakpoint
ALTER TABLE "puestos" ADD CONSTRAINT "puestos_departamento_id_departamentos_id_fk" FOREIGN KEY ("departamento_id") REFERENCES "public"."departamentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "marcas_equipo_nombre_unico" ON "marcas_equipo" USING btree (lower("nombre"));--> statement-breakpoint
INSERT INTO "marcas_equipo" ("nombre")
	SELECT DISTINCT trim("marca") FROM "equipos" WHERE "marca" IS NOT NULL AND trim("marca") <> ''
	ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "marcas_equipo" ("nombre") VALUES ('Lenovo'), ('DELL') ON CONFLICT DO NOTHING;--> statement-breakpoint
CREATE UNIQUE INDEX "puestos_departamento_nombre_unico" ON "puestos" USING btree ("departamento_id",lower("nombre"));--> statement-breakpoint
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_puesto_id_puestos_id_fk" FOREIGN KEY ("puesto_id") REFERENCES "public"."puestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_tipo_tipos_equipo_nombre_fk" FOREIGN KEY ("tipo") REFERENCES "public"."tipos_equipo"("nombre") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
DROP TYPE "public"."tipo_equipo";