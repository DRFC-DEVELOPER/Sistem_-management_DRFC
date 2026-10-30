import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, or } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DB, InjectDb } from '../db/db.module';
import { usuariosSistema } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';

// Hash de relleno para que el tiempo de respuesta sea igual exista o no el usuario.
const HASH_FALSO = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5VKe5kUYwYpv6FpIo5Fj6Fvl8Bdv1Wa';

type Cuenta = UsuarioActual & { activo: boolean; empleado?: { activo: boolean } | null };

/** Cuenta activa y, si es de un empleado, que este no esté dado de baja. */
export const puedeEntrar = (u: Cuenta) => u.activo && (u.rol !== 'EMPLEADO' || (!!u.empleadoId && !!u.empleado?.activo));

/** Datos de la sesión que reciben el cliente y las rutas. */
export const sesion = (u: Cuenta): UsuarioActual => ({
  id: u.id, nombre: u.nombre, usuario: u.usuario, correo: u.correo, rol: u.rol, empleadoId: u.empleadoId, debeCambiarPassword: u.debeCambiarPassword,
});

@Injectable()
export class AuthService {
  constructor(@InjectDb() private db: DB, private jwt: JwtService, private bitacora: BitacoraService) {}

  async login(usuario: string, password: string) {
    const identificador = usuario.toLowerCase().trim();
    const u = await this.db.query.usuariosSistema.findFirst({
      where: or(eq(usuariosSistema.usuario, identificador), eq(usuariosSistema.correo, identificador)),
      with: { empleado: { columns: { activo: true } } },
    });
    const coincide = await bcrypt.compare(password, u?.passwordHash ?? HASH_FALSO);
    if (!u || !puedeEntrar(u) || !coincide) throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    await this.db.update(usuariosSistema).set({ ultimoAcceso: new Date() }).where(eq(usuariosSistema.id, u.id));
    return {
      token: await this.jwt.signAsync({ sub: u.id, rol: u.rol }),
      usuario: sesion(u),
    };
  }

  async cambiarPassword(id: number, actual: string, nueva: string) {
    const u = await this.db.query.usuariosSistema.findFirst({ where: eq(usuariosSistema.id, id) });
    if (!u || !(await bcrypt.compare(actual, u.passwordHash))) throw new BadRequestException('La contraseña actual no es correcta.');
    if (actual === nueva) throw new BadRequestException('La contraseña nueva debe ser distinta de la actual.');
    await this.db.update(usuariosSistema).set({ passwordHash: await bcrypt.hash(nueva, 12), debeCambiarPassword: false }).where(eq(usuariosSistema.id, id));
    await this.bitacora.registrar({ usuarioId: id, accion: 'Cambió su contraseña', entidad: 'usuario', entidadId: id });
    return { ok: true };
  }
}
