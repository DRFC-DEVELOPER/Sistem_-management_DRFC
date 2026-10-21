import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { estatusEquipo, EstatusEquipo, tipoAdaptador, TipoAdaptador, tipoEquipo, TipoEquipo } from '../../db/esquema';

export class CrearEquipoDto {
  @IsIn(tipoEquipo.enumValues)
  tipo: TipoEquipo;

  /** Nombre libre, por ejemplo “Impresora piso 2”. */
  @IsOptional() @IsString() @MaxLength(200) descripcion?: string;
  @IsOptional() @IsString() @MaxLength(80) marca?: string;
  @IsOptional() @IsString() @MaxLength(120) modelo?: string;
  @IsOptional() @IsString() @MaxLength(120) serie?: string;
  /** Opcional. Debe ser único. */
  @IsOptional() @IsString() @MaxLength(120) codigoBarras?: string;
  @IsOptional() @IsString() @MaxLength(60) color?: string;
  @IsOptional() @IsString() @MaxLength(20) memoriaGb?: string;
  @IsOptional() @IsString() @MaxLength(120) procesador?: string;
  @IsOptional() @IsString() @MaxLength(40) disco?: string;
  @IsOptional() @IsString() @MaxLength(120) sistemaOperativo?: string;
  @IsOptional() @IsString() @MaxLength(60) ipGestion?: string;
  @IsOptional() @IsIn(tipoAdaptador.enumValues) tipoAdaptador?: TipoAdaptador;
  @IsOptional() @IsString() @MaxLength(2000) notas?: string;

  /** Estatus al registrar. Por defecto DISPONIBLE. */
  @IsOptional() @IsIn(['DISPONIBLE', 'DANADO'])
  estatusInicial?: 'DISPONIBLE' | 'DANADO';

  /** Si se envía, el equipo se registra ya asignado a este empleado. */
  @IsOptional() @IsInt()
  empleadoId?: number;

  /** AAAA-MM-DD. Solo se usa junto con empleadoId. */
  @IsOptional() @IsDateString()
  fechaEntrega?: string;
}

export class ActualizarEquipoDto extends PartialType(OmitType(CrearEquipoDto, ['estatusInicial', 'empleadoId', 'fechaEntrega'] as const)) {}

export class CambiarEstatusDto {
  @IsIn(['DISPONIBLE', 'DANADO'], { message: 'Solo se puede cambiar a DISPONIBLE o DANADO desde aquí.' })
  estatus: 'DISPONIBLE' | 'DANADO';

  @IsOptional() @IsString() @MaxLength(500)
  notas?: string;
}

export class BajaEquipoDto {
  @IsString() @MinLength(3, { message: 'Escribe el motivo de la baja.' }) @MaxLength(500)
  motivo: string;
}

export class FiltroEquiposDto {
  /** Busca en marca, modelo, serie, código, descripción, IP y nombre del empleado. */
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(tipoEquipo.enumValues) tipo?: TipoEquipo;
  @IsOptional() @IsIn(estatusEquipo.enumValues) estatus?: EstatusEquipo;
  @IsOptional() @Type(() => Number) @IsInt() empleadoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() departamentoId?: number;
  /** Por defecto se ocultan los dados de baja. */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() incluirBajas?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limite?: number;
}
