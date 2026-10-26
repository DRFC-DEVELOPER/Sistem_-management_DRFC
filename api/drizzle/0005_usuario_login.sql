ALTER TABLE "usuarios_sistema" ALTER COLUMN "correo" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios_sistema" ADD COLUMN "usuario" varchar(60);--> statement-breakpoint
-- Los usuarios existentes entraban con "correo": ese valor (sin el dominio) pasa a ser su nombre de usuario.
UPDATE "usuarios_sistema" SET "usuario" = left(split_part("correo", '@', 1), 50) || CASE WHEN EXISTS (
  SELECT 1 FROM "usuarios_sistema" o WHERE o."id" < "usuarios_sistema"."id" AND split_part(o."correo", '@', 1) = split_part("usuarios_sistema"."correo", '@', 1)
) THEN '.' || "id" ELSE '' END;--> statement-breakpoint
UPDATE "usuarios_sistema" SET "correo" = NULL WHERE "correo" NOT LIKE '%@%';--> statement-breakpoint
ALTER TABLE "usuarios_sistema" ALTER COLUMN "usuario" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios_sistema" ADD CONSTRAINT "usuarios_sistema_usuario_unique" UNIQUE("usuario");
