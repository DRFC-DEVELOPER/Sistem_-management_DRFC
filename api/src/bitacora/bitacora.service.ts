import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, SQL } from 'drizzle-orm';
import { DB, DbOTx, InjectDb } from '../db/db.module';
import { bitacora } from '../db/esquema';
import { paginar } from '../common/utiles';

export interface Registro {
  usuarioId?: number | null;
  accion: string;
  entidad: 'equipo' | 'empleado' | 'asignacion' | 'reparacion' | 'usuario' | 'departamento' | 'tipo_equipo' | 'marca_equipo' | 'puesto';
  entidadId?: number | null;
  detalle?: unknown;
}

@Injectable()
export class BitacoraService {
  constructor(@InjectDb() private db: DB) {}

  async registrar(r: Registro, tx: DbOTx = this.db) {
    await tx.insert(bitacora).values(r);
  }

  async listar(f: { entidad?: string; entidadId?: number; orden?: string; pagina?: number; limite?: number }) {
    const { offset, limit, pagina, limite } = paginar(f.pagina, f.limite);
    const c: SQL[] = [];
    if (f.entidad) c.push(eq(bitacora.entidad, f.entidad));
    if (f.entidadId) c.push(eq(bitacora.entidadId, f.entidadId));
    const where = c.length ? and(...c) : undefined;
    const [total, datos] = await Promise.all([
      this.db.$count(bitacora, where),
      this.db.query.bitacora.findMany({
        where, offset, limit, orderBy: f.orden === 'antiguos' ? [asc(bitacora.fecha), asc(bitacora.id)] : [desc(bitacora.fecha), desc(bitacora.id)],
        with: { usuario: { columns: { id: true, nombre: true } } },
      }),
    ]);
    return { total, pagina, limite, datos };
  }
}
