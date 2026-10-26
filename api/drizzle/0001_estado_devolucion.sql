ALTER TABLE "asignaciones" ADD COLUMN "resultado" "estatus_equipo";--> statement-breakpoint
-- Asignaciones cerradas antes de este cambio: se deduce el resultado de las notas automáticas.
UPDATE "asignaciones" SET "resultado" = (CASE
  WHEN "notas" LIKE '%Enviado a reparación%' THEN 'EN_REPARACION'
  WHEN "notas" LIKE '%Retirado por baja:%' THEN 'BAJA'
  ELSE 'DISPONIBLE'
END)::"estatus_equipo"
WHERE "fecha_devolucion" IS NOT NULL;
