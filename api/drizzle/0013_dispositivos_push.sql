CREATE TABLE "dispositivos_push" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer NOT NULL,
	"token" varchar(200) NOT NULL,
	"plataforma" varchar(20),
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dispositivos_push_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "dispositivos_push" ADD CONSTRAINT "dispositivos_push_usuario_id_usuarios_sistema_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios_sistema"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispositivos_push_usuario_idx" ON "dispositivos_push" USING btree ("usuario_id");