CREATE SEQUENCE "public"."equipos_codigo_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
ALTER TABLE "equipos" ALTER COLUMN "codigo_barras" SET DEFAULT 'DRFC' || lpad(nextval('equipos_codigo_seq')::text, 6, '0');--> statement-breakpoint
-- Equipos existentes sin código: reciben el consecutivo en orden de registro.
UPDATE "equipos" e SET "codigo_barras" = s."codigo"
FROM (
  SELECT "id", 'DRFC' || lpad(nextval('equipos_codigo_seq')::text, 6, '0') AS "codigo"
  FROM (SELECT "id" FROM "equipos" WHERE "codigo_barras" IS NULL ORDER BY "id") o
) s
WHERE e."id" = s."id";
