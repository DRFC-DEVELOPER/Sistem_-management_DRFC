import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, ne, or } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { DB, InjectDb } from '../db/db.module';
import { empleados, usuariosSistema } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { ActualizarAccesoEmpleadoDto, ActualizarUsuarioSistemaDto, CrearAccesoEmpleadoDto, CrearUsuarioSistemaDto } from './dto/usuario-sistema.dto';

const publico = {
  id: usuariosSistema.id, nombre: usuariosSistema.nombre, usuario: usuariosSistema.usuario, correo: usuariosSistema.correo, rol: usuariosSistema.rol,
  activo: usuariosSistema.activo, ultimoAcceso: usuariosSistema.ultimoAcceso, creadoEn: usuariosSistema.creadoEn,
};
const acceso = { ...publico, debeCambiarPassword: usuariosSistema.debeCambiarPassword };

// Sin caracteres que se confunden al dictarlos o leerlos (0/O, 1/l/I).
const ALFABETO_CLAVE = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const claveTemporal = () => Array.from({ length: 10 }, () => ALFABETO_CLAVE[randomInt(ALFABETO_CLAVE.length)]).join('');
// Las cuentas de empleados no se listan ni se editan como usuarios del sistema.
const esPersonal = ne(usuariosSistema.rol, 'EMPLEADO');

@Injectable()
export class UsuariosSistemaService {
  constructor(@InjectDb() private db: DB, private bitacora: BitacoraService) {}

  listar() {
    return this.db.select(publico).from(usuariosSistema).where(esPersonal).orderBy(asc(usuariosSistema.nombre));
  }

  // Revisa que el usuario y el correo no los tenga otra cuenta.
  private async validarUnicos(usuario: string | undefined, correo: string | null | undefined, excepto?: number) {
    const condiciones = [usuario && eq(usuariosSistema.usuario, usuario), correo && eq(usuariosSistema.correo, correo)].filter((c) => !!c);
    if (!condiciones.length) return;
    const otro = await this.db.query.usuariosSistema.findFirst({
      where: and(or(...condiciones), excepto ? ne(usuariosSistema.id, excepto) : undefined),
    });
    if (otro) throw new ConflictException(otro.usuario === usuario ? 'Ya existe una cuenta con ese usuario.' : 'Ya existe una cuenta con ese correo.');
  }

  async crear(dto: CrearUsuarioSistemaDto, autorId: number) {
    const usuario = dto.usuario.toLowerCase().trim();
    const correo = dto.correo?.toLowerCase().trim() || null;
    await this.validarUnicos(usuario, correo);
    const [u] = await this.db
      .insert(usuariosSistema)
      .values({ nombre: dto.nombre.trim(), usuario, correo, rol: dto.rol, passwordHash: await bcrypt.hash(dto.password, 12) })
      .returning(publico);
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Creó el usuario ${u.usuario} (${u.rol})`, entidad: 'usuario', entidadId: u.id });
    return u;
  }

  async actualizar(id: number, dto: ActualizarUsuarioSistemaDto, autorId: number) {
    if (id === autorId && (dto.activo === false || (dto.rol && dto.rol !== 'ADMIN'))) {
      throw new BadRequestException('No puedes desactivarte ni quitarte el rol de administrador.');
    }
    const data: Partial<typeof usuariosSistema.$inferInsert> = {};
    if (dto.nombre) data.nombre = dto.nombre.trim();
    if (dto.usuario) data.usuario = dto.usuario.toLowerCase().trim();
    if (dto.correo !== undefined) data.correo = dto.correo?.toLowerCase().trim() || null;
    if (dto.rol) data.rol = dto.rol;
    if (dto.activo !== undefined) data.activo = dto.activo;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
    if (!Object.keys(data).length) throw new BadRequestException('No enviaste cambios.');
    await this.validarUnicos(data.usuario, data.correo, id);
    const [u] = await this.db.update(usuariosSistema).set(data).where(and(eq(usuariosSistema.id, id), esPersonal)).returning(publico);
    if (!u) throw new NotFoundException('El usuario no existe.');
    const cambios = Object.keys(data).map((k) => (k === 'passwordHash' ? 'password' : k));
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Modificó el usuario ${u.usuario}`, entidad: 'usuario', entidadId: id, detalle: { cambios } });
    return u;
  }

  // ---------- Acceso de empleados a la app ----------

  private async empleado(empleadoId: number) {
    const e = await this.db.query.empleados.findFirst({ where: eq(empleados.id, empleadoId), columns: { id: true, nombre: true, numero: true, activo: true } });
    if (!e) throw new NotFoundException('El empleado no existe.');
    return e;
  }

  /** Cuenta de la app del empleado, o null si todavía no tiene. */
  async accesoDe(empleadoId: number) {
    await this.empleado(empleadoId);
    const [u] = await this.db.select(acceso).from(usuariosSistema).where(eq(usuariosSistema.empleadoId, empleadoId));
    return u ?? null;
  }

  /** Crea la cuenta con una contraseña temporal; el empleado la cambia al entrar por primera vez. */
  async crearAcceso(empleadoId: number, dto: CrearAccesoEmpleadoDto, autorId: number) {
    const e = await this.empleado(empleadoId);
    if (!e.activo) throw new BadRequestException(`${e.nombre} está dado de baja; reactívalo para darle acceso.`);
    if (await this.accesoDe(empleadoId)) throw new ConflictException(`${e.nombre} ya tiene acceso a la app.`);
    const usuario = (dto.usuario ?? e.numero ?? '').toLowerCase().trim();
    if (!/^[a-z0-9._-]{3,}$/.test(usuario)) {
      throw new BadRequestException('El empleado no tiene un número válido para usarlo como usuario; escribe uno (al menos 3 caracteres, sin espacios).');
    }
    await this.validarUnicos(usuario, null);
    const password = claveTemporal();
    const [u] = await this.db
      .insert(usuariosSistema)
      .values({ nombre: e.nombre, usuario, rol: 'EMPLEADO', empleadoId, debeCambiarPassword: true, passwordHash: await bcrypt.hash(password, 12) })
      .returning(acceso);
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Dio acceso a la app a ${e.nombre} (usuario ${usuario})`, entidad: 'empleado', entidadId: empleadoId });
    return { ...u, passwordTemporal: password };
  }

  /** Activa o desactiva la cuenta, o genera una contraseña temporal nueva. */
  async actualizarAcceso(empleadoId: number, dto: ActualizarAccesoEmpleadoDto, autorId: number) {
    const e = await this.empleado(empleadoId);
    const actual = await this.accesoDe(empleadoId);
    if (!actual) throw new NotFoundException(`${e.nombre} no tiene acceso a la app.`);
    if (dto.activo && !e.activo) throw new BadRequestException(`${e.nombre} está dado de baja; reactívalo antes de activar su acceso.`);
    const data: Partial<typeof usuariosSistema.$inferInsert> = {};
    if (dto.activo !== undefined) data.activo = dto.activo;
    const password = dto.restablecerPassword ? claveTemporal() : undefined;
    if (password) Object.assign(data, { passwordHash: await bcrypt.hash(password, 12), debeCambiarPassword: true });
    if (!Object.keys(data).length) throw new BadRequestException('No enviaste cambios.');
    const [u] = await this.db.update(usuariosSistema).set(data).where(eq(usuariosSistema.id, actual.id)).returning(acceso);
    const accion = password ? 'Restableció la contraseña de la app de' : dto.activo ? 'Activó el acceso a la app de' : 'Desactivó el acceso a la app de';
    await this.bitacora.registrar({ usuarioId: autorId, accion: `${accion} ${e.nombre}`, entidad: 'empleado', entidadId: empleadoId });
    return password ? { ...u, passwordTemporal: password } : u;
  }
}
