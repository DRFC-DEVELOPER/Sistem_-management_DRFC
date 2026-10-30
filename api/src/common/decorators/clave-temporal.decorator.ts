import { SetMetadata } from '@nestjs/common';

export const CON_CLAVE_TEMPORAL = 'conClaveTemporal';
/** Ruta que se puede usar aunque la cuenta tenga una contraseña temporal pendiente de cambiar. */
export const ConClaveTemporal = () => SetMetadata(CON_CLAVE_TEMPORAL, true);
