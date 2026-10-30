import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Rol } from '../../db/esquema';

export interface UsuarioActual {
  id: number;
  nombre: string;
  usuario: string;
  correo: string | null;
  rol: Rol;
  /** Ficha del empleado dueño de la cuenta (solo rol EMPLEADO). */
  empleadoId: number | null;
  debeCambiarPassword: boolean;
}

export const Usuario = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioActual => ctx.switchToHttp().getRequest().user,
);
