import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response } from 'express';

const MENSAJES: Record<string, [number, string]> = {
  '23505': [409, 'Ya existe un registro con ese valor.'],
  '23503': [409, 'El registro está relacionado con otros datos y no se puede modificar así.'],
  '22001': [400, 'Uno de los textos es demasiado largo.'],
  '22P02': [400, 'Uno de los datos tiene un formato inválido.'],
  '22007': [400, 'La fecha tiene un formato inválido.'],
  '22008': [400, 'La fecha no es válida.'],
};

/** Convierte errores de PostgreSQL en respuestas claras; lo demás sigue el manejo normal de Nest. */
@Catch()
export class ErroresBdFilter extends BaseExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const e = error as { code?: string; cause?: { code?: string; constraint?: string } } | undefined;
    const pg = (typeof e?.code === 'string' ? e : e?.cause) as { code?: string; constraint?: string } | undefined;
    const m = pg?.code ? MENSAJES[pg.code] : undefined;
    if (m) {
      let mensaje = m[1];
      if (pg?.constraint === 'equipos_codigo_barras_unico') mensaje = 'Ese código de barras ya pertenece a otro equipo.';
      if (pg?.constraint === 'asignaciones_vigente_unica') mensaje = 'El equipo ya tiene una asignación vigente.';
      return host.switchToHttp().getResponse<Response>().status(m[0]).json({ statusCode: m[0], message: mensaje });
    }
    return super.catch(error, host);
  }
}
