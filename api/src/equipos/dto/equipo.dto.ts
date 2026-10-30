import { OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ambitoEquipo, AmbitoEquipo, estatusEquipo, EstatusEquipo, tipoAdaptador, TipoAdaptador, TipoEquipo } from '../../db/esquema';

export class CrearEquipoDto {
  @IsString() @MaxLength(80)
  tipo: TipoEquipo;

  @IsOptional() @IsIn(ambitoEquipo.enumValues)
  ambito?: AmbitoEquipo;

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

  /** Puesto de la persona destinataria; solo se permite para jefes de área. */
  @IsOptional() @Type(() => Number) @IsInt()
  puestoDestinatarioId?: number;

  /** Nombre de quien usará el equipo (opcional); solo junto con puestoDestinatarioId. */
  @IsOptional() @IsString() @MaxLength(150)
  nombreDestinatario?: string;

  /** AAAA-MM-DD. Solo se usa junto con empleadoId. */
  @IsOptional() @IsDateString()
  fechaEntrega?: string;
}

export class ActualizarEquipoDto extends PartialType(OmitType(CrearEquipoDto, ['estatusInicial', 'empleadoId', 'fechaEntrega', 'puestoDestinatarioId', 'nombreDestinatario'] as const)) {}

export class CambiarEstatusDto {
  @IsIn(['DISPONIBLE', 'DANADO'], { message: 'Solo se puede cambiar a DISPONIBLE o DANADO desde aquí.' })
  estatus: 'DISPONIBLE' | 'DANADO';

  @IsOptional() @IsString() @MaxLength(500)
  notas?: string;

  /** Al marcarlo disponible: true = se le regresa al empleado al que está ligado. */
  @IsOptional() @IsBoolean()
  regresarAEmpleado?: boolean;
}

export class BajaEquipoDto {
  @IsString() @MinLength(3, { message: 'Escribe el motivo de la baja.' }) @MaxLength(500)
  motivo: string;
}

export class FiltroEquiposDto {
  /** Busca en marca, modelo, serie, código, descripción, IP y nombre del empleado. */
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() @MaxLength(80) tipo?: TipoEquipo;
  @IsOptional() @IsIn(ambitoEquipo.enumValues) ambito?: AmbitoEquipo;
  @IsOptional() @IsIn(estatusEquipo.enumValues) estatus?: EstatusEquipo;
  @IsOptional() @Type(() => Number) @IsInt() empleadoId?: number;
  @IsOptional() @Type(() => Number) @IsInt() departamentoId?: number;
  /** Por defecto se ocultan los dados de baja. */
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() incluirBajas?: boolean;
  /** Sin valor: por tipo y marca. */
  @IsOptional() @IsIn(['recientes', 'antiguos']) orden?: 'recientes' | 'antiguos';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limite?: number;
}
