CREATE TYPE "public"."ambito_equipo" AS ENUM('USUARIO', 'INFRAESTRUCTURA');--> statement-breakpoint
ALTER TABLE "equipos" ADD COLUMN "ambito" "ambito_equipo" DEFAULT 'USUARIO' NOT NULL;