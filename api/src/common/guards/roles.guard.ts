import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Rol } from '../../db/esquema';
import { CON_CLAVE_TEMPORAL } from '../decorators/clave-temporal.decorator';
import { ES_PUBLICO } from '../decorators/publico.decorator';
import { ROLES } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const destinos = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, destinos)) return true;

    const req = ctx.switchToHttp().getRequest();
    const rol: Rol | undefined = req.user?.rol;
    if (req.user?.debeCambiarPassword && !this.reflector.getAllAndOverride<boolean>(CON_CLAVE_TEMPORAL, destinos)) {
      throw new ForbiddenException('Cambia tu contraseña temporal para continuar.');
    }
    let permitidos = this.reflector.getAllAndOverride<Rol[]>(ROLES, destinos);
    if (!permitidos) {
      permitidos = req.method === 'GET' ? ['ADMIN', 'TECNICO', 'CONSULTA'] : ['ADMIN', 'TECNICO'];
    }
    if (rol && permitidos.includes(rol)) return true;
    throw new ForbiddenException('Tu rol no tiene permiso para esta acción.');
  }
}
