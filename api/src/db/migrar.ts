// Aplica las migraciones pendientes. Se ejecuta al arrancar el contenedor.
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { crearPool } from './db.module';

async function main() {
  const pool = crearPool();
  await migrate(drizzle(pool), { migrationsFolder: join(__dirname, '..', '..', 'drizzle') });
  await pool.end();
  console.log('Migraciones aplicadas.');
}
main().catch((e) => {
  console.error('Error al migrar:', e);
  process.exit(1);
});
