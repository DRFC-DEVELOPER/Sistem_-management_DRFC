import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';
/** Marca una ruta como accesible sin iniciar sesión. */
export const Publico = () => SetMetadata(ES_PUBLICO, true);
