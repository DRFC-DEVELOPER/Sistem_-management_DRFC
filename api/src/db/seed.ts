// Carga inicial: crea el primer administrador y, si la base está vacía, importa el inventario del Excel.
// Uso: npm run seed   (dentro del contenedor: docker compose exec api npm run seed)
import { drizzle } from 'drizzle-orm/node-postgres';
import { count } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { crearPool } from './db.module';
import * as esquema from './esquema';
import { asignaciones, bitacora, departamentos, empleados, equipos, reparaciones, usuariosSistema } from './esquema';

interface Datos {
  empleados: { clave: string; nombre: string; departamento: string | null; numero: string | null; notas: string | null }[];
  equipos: (Partial<typeof equipos.$inferInsert> & {
    tipo: esquema.TipoEquipo;
    estatus: esquema.EstatusEquipo;
    empleado?: string;
    fechaEntrega?: string | null;
    reparacion?: { fechaEnvio: string; motivo: string; solucion: string | null };
  })[];
}

async function main() {
  const pool = crearPool();
  const db = drizzle(pool, { schema: esquema });

  const [{ n: usuarios }] = await db.select({ n: count() }).from(usuariosSistema);
  let adminId: number | null = null;
  if (usuarios === 0) {
    const correo = process.env.ADMIN_CORREO?.toLowerCase().trim();
    const password = process.env.ADMIN_PASSWORD;
    if (!correo || !password || password.length < 10) {
      throw new Error('Define ADMIN_CORREO y ADMIN_PASSWORD (mínimo 10 caracteres) en el archivo .env.');
    }
    const [a] = await db
      .insert(usuariosSistema)
      .values({ nombre: process.env.ADMIN_NOMBRE || 'Administrador', correo, rol: 'ADMIN', passwordHash: await bcrypt.hash(password, 12) })
      .returning();
    adminId = a.id;
    console.log(`Administrador creado: ${correo}`);
  } else {
    console.log('Ya hay usuarios del sistema; no se crea el administrador.');
  }

  const [{ n: hayEquipos }] = await db.select({ n: count() }).from(equipos);
  const archivo = join(__dirname, '..', '..', 'datos', 'inventario-inicial.json');
  if (hayEquipos > 0) {
    console.log('La base ya tiene equipos; no se importa el inventario inicial.');
  } else if (!existsSync(archivo)) {
    console.log('No se encontró datos/inventario-inicial.json; se omite la importación.');
  } else {
    const datos: Datos = JSON.parse(readFileSync(archivo, 'utf8'));
    await db.transaction(async (tx) => {
      const deptos = new Map<string, number>();
      for (const nombre of new Set(datos.empleados.map((e) => e.departamento).filter((d): d is string => !!d))) {
        const [d] = await tx.insert(departamentos).values({ nombre: nombre.toUpperCase() }).onConflictDoNothing().returning();
        if (d) deptos.set(nombre, d.id);
      }
      const ids = new Map<string, number>();
      for (const e of datos.empleados) {
        const [r] = await tx
          .insert(empleados)
          .values({ nombre: e.nombre, numero: e.numero, notas: e.notas, departamentoId: e.departamento ? deptos.get(e.departamento) : null })
          .returning({ id: empleados.id });
        ids.set(e.clave, r.id);
      }
      for (const { empleado, fechaEntrega, reparacion, ...eq } of datos.equipos) {
        const empleadoId = empleado ? ids.get(empleado) ?? null : null;
        const [r] = await tx.insert(equipos).values({ ...eq, empleadoId }).returning({ id: equipos.id });
        if (empleadoId) {
          await tx.insert(asignaciones).values({ equipoId: r.id, empleadoId, fechaEntrega: fechaEntrega ?? null, notas: 'Importado del Excel' });
        }
        if (reparacion) {
          await tx.insert(reparaciones).values({ equipoId: r.id, fechaEnvio: reparacion.fechaEnvio, motivo: reparacion.motivo, solucion: reparacion.solucion });
        }
      }
      await tx.insert(bitacora).values({
        usuarioId: adminId,
        accion: `Importación inicial: ${datos.empleados.length} empleados y ${datos.equipos.length} equipos`,
        entidad: 'equipo',
      });
    });
    console.log(`Importados ${datos.empleados.length} empleados y ${datos.equipos.length} equipos.`);
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
