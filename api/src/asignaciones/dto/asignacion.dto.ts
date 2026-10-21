import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class AsignarDto {
  @IsInt()
  equipoId: number;

  @IsInt()
  empleadoId: number;

  /** AAAA-MM-DD. Si no se envía, se usa la fecha de hoy. */
  @IsOptional() @IsDateString()
  fechaEntrega?: string;

  @IsOptional() @IsString() @MaxLength(500)
  notas?: string;
}

export class DevolverDto {
  @IsInt()
  equipoId: number;

  /** AAAA-MM-DD. Si no se envía, se usa la fecha de hoy. */
  @IsOptional() @IsDateString()
  fecha?: string;

  @IsOptional() @IsString() @MaxLength(500)
  notas?: string;
}

export class FiltroAsignacionesDto {
  @IsOptional() @Type(() => Number) @IsInt()
  empleadoId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  equipoId?: number;

  /** true = solo las que siguen vigentes. */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  abiertas?: boolean;
}
