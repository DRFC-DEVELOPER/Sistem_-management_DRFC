ALTER TABLE "asignaciones" ADD COLUMN "puesto_destinatario_id" integer;--> statement-breakpoint
ALTER TABLE "asignaciones" ADD CONSTRAINT "asignaciones_puesto_destinatario_id_puestos_id_fk" FOREIGN KEY ("puesto_destinatario_id") REFERENCES "public"."puestos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
INSERT INTO "puestos" ("departamento_id", "nombre")
SELECT d."id", 'Jefe de área'
FROM "departamentos" d
WHERE NOT EXISTS (
  SELECT 1 FROM "puestos" p
  WHERE p."departamento_id" = d."id"
    AND translate(lower(p."nombre"), 'áéíóúüñ', 'aeiouun') = 'jefe de area'
)
ON CONFLICT DO NOTHING;