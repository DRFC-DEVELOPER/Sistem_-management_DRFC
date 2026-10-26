import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CrearEmpleadoDto {
  @IsString() @MinLength(2, { message: 'Escribe el nombre del empleado.' }) @MaxLength(150)
  nombre: string;

  /** Nombre del departamento; si no existe se crea. */
  @IsOptional() @IsString() @MaxLength(80)
  departamento?: string;

  @IsOptional() @IsInt()
  puestoId?: number | null;

  /** Número de empleado o extensión. */
  @IsOptional() @IsString() @MaxLength(40)
  numero?: string;

  @IsOptional() @ValidateIf((o) => !!o.correo) @IsEmail({}, { message: 'Escribe un correo válido.' })
  correo?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  notas?: string;
}

export class ActualizarEmpleadoDto extends PartialType(CrearEmpleadoDto) {}

export class FiltroEmpleadosDto {
  /** Busca en nombre, número y correo. */
  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  departamentoId?: number;

  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean()
  incluirInactivos?: boolean;
}
