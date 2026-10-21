import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

// Mensajes en español para las validaciones que no traen uno propio.
const TEXTOS: Record<string, (campo: string, c: string) => string> = {
  whitelistValidation: (campo) => `El campo «${campo}» no está permitido.`,
  isIn: (campo, c) => `«${campo}» tiene un valor no válido. ${c.replace(/^.*following values:/, 'Opciones:')}`,
  isInt: (campo) => `«${campo}» debe ser un número entero.`,
  isString: (campo) => `«${campo}» debe ser texto.`,
  isBoolean: (campo) => `«${campo}» debe ser verdadero o falso.`,
  isDateString: (campo) => `«${campo}» debe ser una fecha con formato AAAA-MM-DD.`,
  isEmail: (campo) => `«${campo}» debe ser un correo válido.`,
  maxLength: (campo) => `«${campo}» es demasiado largo.`,
  minLength: (campo) => `«${campo}» es demasiado corto.`,
  min: (campo) => `«${campo}» es menor al mínimo permitido.`,
  max: (campo) => `«${campo}» es mayor al máximo permitido.`,
  isNotEmpty: (campo) => `«${campo}» es obligatorio.`,
};

function mensajes(errores: ValidationError[], prefijo = ''): string[] {
  return errores.flatMap((e) => {
    const campo = prefijo + e.property;
    const propios = Object.entries(e.constraints ?? {}).map(([tipo, texto]) =>
      // Si el validador ya tiene mensaje en español, se respeta.
      /^[A-ZÁÉÍÓÚ¿]|[áéíóúñ]/.test(texto) && !texto.startsWith(e.property) ? texto : (TEXTOS[tipo]?.(campo, texto) ?? texto),
    );
    return [...propios, ...mensajes(e.children ?? [], campo + '.')];
  });
}

export const validacion = () =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errores) => new BadRequestException(mensajes(errores)),
  });
