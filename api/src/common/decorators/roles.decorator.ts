import { SetMetadata } from '@nestjs/common';
import { Rol } from '../../db/esquema';

export const ROLES = 'roles';
/**
 * Roles que pueden usar la ruta. Sin este decorador:
 * las consultas (GET) están abiertas a todos los roles y
 * los cambios requieren ADMIN o TECNICO.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);
