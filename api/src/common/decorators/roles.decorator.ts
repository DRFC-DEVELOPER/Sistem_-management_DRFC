import { SetMetadata } from '@nestjs/common';
import { Rol } from '../../db/esquema';

export const ROLES = 'roles';
/**
 * Roles que pueden usar la ruta. Sin este decorador:
 * las consultas (GET) están abiertas a ADMIN, TECNICO y CONSULTA y
 * los cambios requieren ADMIN o TECNICO. El rol EMPLEADO solo entra a las rutas que lo nombran.
 */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES, roles);
