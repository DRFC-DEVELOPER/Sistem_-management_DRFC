import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { eq } from 'drizzle-orm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DB, InjectDb } from '../db/db.module';
import { usuariosSistema } from '../db/esquema';
import { UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { puedeEntrar, sesion } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectDb() private db: DB) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET as string,
      ignoreExpiration: false,
    });
  }

  // Se consulta la base en cada petición para que un usuario desactivado pierda acceso de inmediato.
  async validate(payload: { sub: number }): Promise<UsuarioActual> {
    const u = await this.db.query.usuariosSistema.findFirst({
      where: eq(usuariosSistema.id, payload.sub),
      columns: { id: true, nombre: true, usuario: true, correo: true, rol: true, activo: true, empleadoId: true, debeCambiarPassword: true },
      with: { empleado: { columns: { activo: true } } },
    });
    if (!u || !puedeEntrar(u)) throw new UnauthorizedException('Tu acceso fue desactivado.');
    return sesion(u);
  }
}
