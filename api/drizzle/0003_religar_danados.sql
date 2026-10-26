-- Equipos que quedaron dañados o en reparación antes de que se conservara el vínculo:
-- se vuelven a ligar al empleado de su última asignación si salieron de él en ese estado
-- y desde que se le entregó no se marcaron disponibles.
UPDATE "equipos" e SET "empleado_id" = u."empleado_id"
FROM (
  SELECT DISTINCT ON (a."equipo_id") a."equipo_id", a."empleado_id", a."resultado"
  FROM "asignaciones" a
  ORDER BY a."equipo_id", a."id" DESC
) u
JOIN "empleados" em ON em."id" = u."empleado_id" AND em."activo"
WHERE u."equipo_id" = e."id"
  AND e."empleado_id" IS NULL
  AND e."estatus" IN ('DANADO', 'EN_REPARACION')
  AND u."resultado" IN ('DANADO', 'EN_REPARACION')
  AND NOT EXISTS (
    SELECT 1 FROM "bitacora" b
    WHERE (
        (b."entidad" = 'equipo' AND b."entidad_id" = e."id" AND b."accion" LIKE 'Cambió % a DISPONIBLE')
        OR (b."entidad" = 'reparacion' AND b."detalle"->>'equipoId' = e."id"::text AND b."accion" LIKE '% de reparación como DISPONIBLE')
      )
      AND b."fecha" > coalesce((
        SELECT max(x."fecha") FROM "bitacora" x
        WHERE x."entidad" = 'equipo' AND x."entidad_id" = e."id" AND x."accion" LIKE 'Asignó %'
      ), '-infinity')
  );
