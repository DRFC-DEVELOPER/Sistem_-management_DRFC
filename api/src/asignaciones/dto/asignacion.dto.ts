import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class AsignarDto {
  @IsInt()
  equipoId: number;

  @IsInt()
  empleadoId: number;

  /** Puesto de la persona destinataria; solo se permite para jefes de área. */
  @IsOptional() @Type(() => Number) @IsInt()
  puestoDestinatarioId?: number;

  /** Nombre de quien usará el equipo (opcional); solo junto con puestoDestinatarioId. */
  @IsOptional() @IsString() @MaxLength(150)
  nombreDestinatario?: string;

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

  /** Estado en que se recibe el equipo. Por defecto DISPONIBLE. */
  @IsOptional() @IsIn(['DISPONIBLE', 'DANADO', 'RESGUARDO'], { message: 'El equipo solo se puede recibir como DISPONIBLE, DANADO o RESGUARDO.' })
  estatus?: 'DISPONIBLE' | 'DANADO' | 'RESGUARDO';

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
