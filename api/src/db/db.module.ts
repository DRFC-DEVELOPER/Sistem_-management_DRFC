import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as esquema from './esquema';

export type DB = NodePgDatabase<typeof esquema>;
/** Cliente dentro de una transacción (misma API que DB). */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
export type DbOTx = DB | Tx;

export const DB_TOKEN = Symbol('DB');
export const InjectDb = () => Inject(DB_TOKEN);
const POOL = Symbol('POOL');

export function crearPool() {
  if (!process.env.DATABASE_URL) throw new Error('Define DATABASE_URL en el archivo .env.');
  return new Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
}

@Global()
@Module({
  providers: [
    { provide: POOL, useFactory: crearPool },
    { provide: DB_TOKEN, inject: [POOL], useFactory: (pool: Pool) => drizzle(pool, { schema: esquema }) },
  ],
  exports: [DB_TOKEN],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private pool: Pool) {}
  async onApplicationShutdown() {
    await this.pool.end();
  }
}
