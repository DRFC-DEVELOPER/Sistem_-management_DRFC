import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { DB, DbOTx, InjectDb } from '../db/db.module';
import { departamentos } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';

export const normalizarDepto = (n: string) => n.replace(/\s+/g, ' ').trim().toUpperCase();

@Injectable()
export class DepartamentosService {
  constructor(@InjectDb() private db: DB, private bitacora: BitacoraService) {}

  listar() {
    return this.db
      .select({
        id: departamentos.id,
        nombre: departamentos.nombre,
        empleadosActivos: sql<number>`(select count(*)::int from empleados e where e.departamento_id = "departamentos"."id" and e.activo)`,
      })
      .from(departamentos)
      .orderBy(asc(departamentos.nombre));
  }

  /** Devuelve el id del departamento con ese nombre, creándolo si no existe. */
  async obtenerOCrear(nombre: string | null | undefined, tx: DbOTx = this.db): Promise<number | null> {
    if (!nombre || !nombre.trim()) return null;
    const n = normalizarDepto(nombre);
    await tx.insert(departamentos).values({ nombre: n }).onConflictDoNothing();
    const d = await tx.query.departamentos.findFirst({ where: eq(departamentos.nombre, n) });
    return d!.id;
  }

  async crear(nombre: string, autorId: number) {
    const n = normalizarDepto(nombre);
    if (await this.db.query.departamentos.findFirst({ where: eq(departamentos.nombre, n) })) throw new ConflictException('Ese departamento ya existe.');
    const [d] = await this.db.insert(departamentos).values({ nombre: n }).returning();
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Creó el departamento ${n}`, entidad: 'departamento', entidadId: d.id });
    return d;
  }

  async renombrar(id: number, nombre: string, autorId: number) {
    const n = normalizarDepto(nombre);
    const antes = await this.db.query.departamentos.findFirst({ where: eq(departamentos.id, id) });
    if (!antes) throw new NotFoundException('El departamento no existe.');
    const [d] = await this.db.update(departamentos).set({ nombre: n }).where(eq(departamentos.id, id)).returning();
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Renombró el departamento ${antes.nombre} a ${n}`, entidad: 'departamento', entidadId: id });
    return d;
  }
}
