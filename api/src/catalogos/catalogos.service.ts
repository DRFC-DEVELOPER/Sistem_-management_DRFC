import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { asc, count, eq, sql } from 'drizzle-orm';
import { BitacoraService } from '../bitacora/bitacora.service';
import { DB, InjectDb } from '../db/db.module';
import { asignaciones, departamentos, empleados, equipos, marcasEquipo, puestos, tiposEquipo } from '../db/esquema';

const nombreLimpio = (nombre: string) => nombre.replace(/\s+/g, ' ').trim();
const esPuestoJefeArea = (nombre: string) =>
  nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() === 'jefe de area';

@Injectable()
export class CatalogosService {
  constructor(@InjectDb() private db: DB, private bitacora: BitacoraService) {}

  listarTiposEquipo() {
    return this.db.select().from(tiposEquipo).orderBy(asc(tiposEquipo.nombre));
  }

  async crearTipoEquipo(nombre: string, autorId: number) {
    const n = nombreLimpio(nombre);
    if (n.length < 2) throw new BadRequestException('El nombre del tipo debe tener al menos 2 caracteres.');
    const existe = await this.db.query.tiposEquipo.findFirst({ where: sql`lower(${tiposEquipo.nombre}) = lower(${n})` });
    if (existe) throw new ConflictException('Ese tipo de equipo ya existe.');
    const [tipo] = await this.db.insert(tiposEquipo).values({ nombre: n }).returning();
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Agregó el tipo de equipo ${n}`, entidad: 'tipo_equipo' });
    return tipo;
  }

  async renombrarTipoEquipo(antes: string, nombre: string, autorId: number) {
    const actual = await this.db.query.tiposEquipo.findFirst({ where: eq(tiposEquipo.nombre, antes) });
    if (!actual) throw new NotFoundException('El tipo de equipo no existe.');
    if (actual.predeterminado) throw new BadRequestException('Los tipos originales del sistema no se pueden renombrar.');
    const n = nombreLimpio(nombre);
    if (n.length < 2) throw new BadRequestException('El nombre del tipo debe tener al menos 2 caracteres.');
    const duplicado = await this.db.query.tiposEquipo.findFirst({ where: sql`lower(${tiposEquipo.nombre}) = lower(${n})` });
    if (duplicado && duplicado.nombre !== antes) throw new ConflictException('Ese tipo de equipo ya existe.');
    const [tipo] = await this.db.update(tiposEquipo).set({ nombre: n }).where(eq(tiposEquipo.nombre, antes)).returning();
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Renombró el tipo de equipo ${antes} a ${n}`, entidad: 'tipo_equipo' });
    return tipo;
  }

  async eliminarTipoEquipo(nombre: string, autorId: number) {
    const tipo = await this.db.query.tiposEquipo.findFirst({ where: eq(tiposEquipo.nombre, nombre) });
    if (!tipo) throw new NotFoundException('El tipo de equipo no existe.');
    if (tipo.predeterminado) throw new BadRequestException('Los tipos originales del sistema no se pueden eliminar.');
    const [{ total }] = await this.db.select({ total: count() }).from(equipos).where(eq(equipos.tipo, nombre));
    if (total) throw new ConflictException(`No se puede eliminar ${nombre}: hay ${total} equipo${total === 1 ? '' : 's'} de ese tipo.`);
    await this.db.delete(tiposEquipo).where(eq(tiposEquipo.nombre, nombre));
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Eliminó el tipo de equipo ${nombre}`, entidad: 'tipo_equipo' });
    return { ok: true };
  }

  listarMarcas() {
    return this.db.select().from(marcasEquipo).orderBy(asc(marcasEquipo.nombre));
  }

  async crearMarca(nombre: string, autorId: number) {
    const n = nombreLimpio(nombre);
    if (n.length < 2) throw new BadRequestException('El nombre de la marca debe tener al menos 2 caracteres.');
    const existe = await this.db.query.marcasEquipo.findFirst({ where: sql`lower(${marcasEquipo.nombre}) = lower(${n})` });
    if (existe) throw new ConflictException('Esa marca ya existe.');
    const [marca] = await this.db.insert(marcasEquipo).values({ nombre: n }).returning();
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Agregó la marca ${n}`, entidad: 'marca_equipo', entidadId: marca.id });
    return marca;
  }

  async renombrarMarca(id: number, nombre: string, autorId: number) {
    const actual = await this.db.query.marcasEquipo.findFirst({ where: eq(marcasEquipo.id, id) });
    if (!actual) throw new NotFoundException('La marca no existe.');
    const n = nombreLimpio(nombre);
    if (n.length < 2) throw new BadRequestException('El nombre de la marca debe tener al menos 2 caracteres.');
    const duplicada = await this.db.query.marcasEquipo.findFirst({ where: sql`lower(${marcasEquipo.nombre}) = lower(${n})` });
    if (duplicada && duplicada.id !== id) throw new ConflictException('Esa marca ya existe.');
    const marca = await this.db.transaction(async (tx) => {
      const [actualizada] = await tx.update(marcasEquipo).set({ nombre: n }).where(eq(marcasEquipo.id, id)).returning();
      await tx.update(equipos).set({ marca: n }).where(sql`lower(trim(${equipos.marca})) = lower(${actual.nombre})`);
      return actualizada;
    });
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Renombró la marca ${actual.nombre} a ${n}`, entidad: 'marca_equipo', entidadId: id });
    return marca;
  }

  async eliminarMarca(id: number, autorId: number) {
    const marca = await this.db.query.marcasEquipo.findFirst({ where: eq(marcasEquipo.id, id) });
    if (!marca) throw new NotFoundException('La marca no existe.');
    const [{ total }] = await this.db.select({ total: count() }).from(equipos).where(sql`lower(trim(${equipos.marca})) = lower(${marca.nombre})`);
    if (total) throw new ConflictException(`No se puede eliminar ${marca.nombre}: está registrada en ${total} equipo${total === 1 ? '' : 's'}.`);
    await this.db.delete(marcasEquipo).where(eq(marcasEquipo.id, id));
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Eliminó la marca ${marca.nombre}`, entidad: 'marca_equipo', entidadId: id });
    return { ok: true };
  }

  async listarPuestos(departamentoId: number) {
    await this.verificarDepartamento(departamentoId);
    return this.db.select().from(puestos).where(eq(puestos.departamentoId, departamentoId)).orderBy(asc(puestos.nombre));
  }

  async crearPuesto(departamentoId: number, nombre: string, autorId: number) {
    await this.verificarDepartamento(departamentoId);
    const n = nombreLimpio(nombre);
    if (n.length < 2) throw new BadRequestException('El nombre del puesto debe tener al menos 2 caracteres.');
    if (esPuestoJefeArea(n)) throw new ConflictException('El puesto Jefe de área se crea automáticamente con cada departamento.');
    const existe = await this.db.query.puestos.findFirst({
      where: sql`${puestos.departamentoId} = ${departamentoId} and lower(${puestos.nombre}) = lower(${n})`,
    });
    if (existe) throw new ConflictException('Ese puesto ya existe en el departamento.');
    const [puesto] = await this.db.insert(puestos).values({ departamentoId, nombre: n }).returning();
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Agregó el puesto ${n}`, entidad: 'puesto', entidadId: puesto.id });
    return puesto;
  }

  async renombrarPuesto(departamentoId: number, id: number, nombre: string, autorId: number) {
    const actual = await this.db.query.puestos.findFirst({ where: eq(puestos.id, id) });
    if (!actual || actual.departamentoId !== departamentoId) throw new NotFoundException('El puesto no existe en ese departamento.');
    if (esPuestoJefeArea(actual.nombre)) throw new BadRequestException('El puesto Jefe de área es necesario para las asignaciones del departamento y no se puede renombrar.');
    const n = nombreLimpio(nombre);
    if (n.length < 2) throw new BadRequestException('El nombre del puesto debe tener al menos 2 caracteres.');
    const duplicado = await this.db.query.puestos.findFirst({
      where: sql`${puestos.departamentoId} = ${departamentoId} and lower(${puestos.nombre}) = lower(${n})`,
    });
    if (duplicado && duplicado.id !== id) throw new ConflictException('Ese puesto ya existe en el departamento.');
    const [puesto] = await this.db.update(puestos).set({ nombre: n }).where(eq(puestos.id, id)).returning();
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Renombró el puesto ${actual.nombre} a ${n}`, entidad: 'puesto', entidadId: id });
    return puesto;
  }

  async eliminarPuesto(departamentoId: number, id: number, autorId: number) {
    const puesto = await this.db.query.puestos.findFirst({ where: eq(puestos.id, id) });
    if (!puesto || puesto.departamentoId !== departamentoId) throw new NotFoundException('El puesto no existe en ese departamento.');
    if (esPuestoJefeArea(puesto.nombre)) throw new BadRequestException('El puesto Jefe de área es necesario para las asignaciones del departamento y no se puede eliminar.');
    const [{ total }] = await this.db.select({ total: count() }).from(empleados).where(eq(empleados.puestoId, id));
    if (total) throw new ConflictException(`No se puede eliminar ${puesto.nombre}: hay ${total} empleado${total === 1 ? '' : 's'} con ese puesto.`);
    const [{ asignacionesTotal }] = await this.db.select({ asignacionesTotal: count() }).from(asignaciones).where(eq(asignaciones.puestoDestinatarioId, id));
    if (asignacionesTotal) throw new ConflictException(`No se puede eliminar ${puesto.nombre}: aparece en ${asignacionesTotal} asignación${asignacionesTotal === 1 ? '' : 'es'} del historial.`);
    await this.db.delete(puestos).where(eq(puestos.id, id));
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Eliminó el puesto ${puesto.nombre}`, entidad: 'puesto', entidadId: id });
    return { ok: true };
  }

  private async verificarDepartamento(id: number) {
    const existe = await this.db.query.departamentos.findFirst({ where: eq(departamentos.id, id) });
    if (!existe) throw new NotFoundException('El departamento no existe.');
  }
}
