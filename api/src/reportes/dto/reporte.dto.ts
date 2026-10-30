import { IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { estadoReporte, EstadoReporte } from '../../db/esquema';

export class CrearReporteDto {
  /** Uno de los equipos que el empleado tiene. */
  @Type(() => Number) @IsInt()
  equipoId: number;

  @IsString() @MinLength(5, { message: 'Describe la falla (al menos 5 caracteres).' }) @MaxLength(1000)
  descripcion: string;
}

export class FiltroReportesDto {
  @IsOptional() @IsIn(estadoReporte.enumValues)
  estado?: EstadoReporte;
}

export class AtenderReporteDto {
  /** Mensaje para el empleado (por ejemplo, "Pasa a soporte a las 4"). */
  @IsOptional() @IsString() @MaxLength(1000)
  respuesta?: string;
}

export class ReporteAReparacionDto {
  /** Por defecto se usa la falla que describió el empleado. */
  @IsOptional() @IsString() @MinLength(3) @MaxLength(1000)
  motivo?: string;

  @IsOptional() @IsString() @MaxLength(150)
  proveedor?: string;

  /** AAAA-MM-DD. Por defecto hoy. */
  @IsOptional() @IsDateString()
  fechaEnvio?: string;
}

export class CerrarReporteDto {
  @IsString() @MinLength(3, { message: 'Escribe cómo se resolvió.' }) @MaxLength(1000)
  respuesta: string;
}
