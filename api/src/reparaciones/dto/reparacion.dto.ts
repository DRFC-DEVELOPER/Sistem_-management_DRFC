import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';


export class EnviarReparacionDto {
  @IsInt()
  equipoId: number;

  /** AAAA-MM-DD. Por defecto hoy. */
  @IsOptional() @IsDateString()
  fechaEnvio?: string;

  @IsString() @MinLength(3, { message: 'Describe la falla.' }) @MaxLength(1000)
  motivo: string;

  @IsOptional() @IsString() @MaxLength(150)
  proveedor?: string;
}

export class RecibirReparacionDto {
  /** AAAA-MM-DD. Por defecto hoy. */
  @IsOptional() @IsDateString()
  fechaRecepcion?: string;

  @IsString() @MinLength(3, { message: 'Describe la solución.' }) @MaxLength(1000)
  solucion: string;

  /** Cómo queda el equipo después de la reparación. */
  @IsIn(['DISPONIBLE', 'DANADO', 'BAJA'])
  resultado: 'DISPONIBLE' | 'DANADO' | 'BAJA';

  /** Con resultado DISPONIBLE: true = se le regresa al empleado al que está ligado. */
  @IsOptional() @IsBoolean()
  regresarAEmpleado?: boolean;
}

export class FiltroReparacionesDto {
  @IsOptional() @Type(() => Number) @IsInt()
  equipoId?: number;

  /** true = solo las que no se han recibido. */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  abiertas?: boolean;
}
