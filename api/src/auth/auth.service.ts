import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DB, InjectDb } from '../db/db.module';
import { usuariosSistema } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';

// Hash de relleno para que el tiempo de respuesta sea igual exista o no el correo.
const HASH_FALSO = '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5VKe5kUYwYpv6FpIo5Fj6Fvl8Bdv1Wa';

@Injectable()
export class AuthService {
  constructor(@InjectDb() private db: DB, private jwt: JwtService, private bitacora: BitacoraService) {}

  async login(correo: string, password: string) {
    const u = await this.db.query.usuariosSistema.findFirst({ where: eq(usuariosSistema.correo, correo.toLowerCase().trim()) });
    const coincide = await bcrypt.compare(password, u?.passwordHash ?? HASH_FALSO);
    if (!u || !u.activo || !coincide) throw new UnauthorizedException('Correo o contraseña incorrectos.');
    await this.db.update(usuariosSistema).set({ ultimoAcceso: new Date() }).where(eq(usuariosSistema.id, u.id));
    return {
      token: await this.jwt.signAsync({ sub: u.id, rol: u.rol }),
      usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol },
    };
  }

  async cambiarPassword(id: number, actual: string, nueva: string) {
    const u = await this.db.query.usuariosSistema.findFirst({ where: eq(usuariosSistema.id, id) });
    if (!u || !(await bcrypt.compare(actual, u.passwordHash))) throw new BadRequestException('La contraseña actual no es correcta.');
    await this.db.update(usuariosSistema).set({ passwordHash: await bcrypt.hash(nueva, 12) }).where(eq(usuariosSistema.id, id));
    await this.bitacora.registrar({ usuarioId: id, accion: 'Cambió su contraseña', entidad: 'usuario', entidadId: id });
    return { ok: true };
  }
}
