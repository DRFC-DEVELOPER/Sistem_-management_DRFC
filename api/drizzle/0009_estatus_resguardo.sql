ALTER TYPE "public"."estatus_equipo" ADD VALUE 'RESGUARDO' BEFORE 'BAJA';
--> statement-breakpoint
INSERT INTO "tipos_equipo" ("nombre", "predeterminado")
VALUES ('TELEFONO_MOVIL', true)
ON CONFLICT ("nombre") DO NOTHING;