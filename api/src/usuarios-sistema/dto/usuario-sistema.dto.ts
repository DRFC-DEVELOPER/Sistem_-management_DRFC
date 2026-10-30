import { PartialType } from '@nestjs/swagger';
import { ROLES_PERSONAL } from '../../db/esquema';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class CrearUsuarioSistemaDto {
  @IsString() @MinLength(2) @MaxLength(120)
  nombre: string;

  /** Nombre de usuario con el que inicia sesión. */
  @IsString() @MaxLength(60)
  @Matches(/^[a-z0-9._-]{3,}$/i, { message: 'El usuario debe tener al menos 3 caracteres, sin espacios (letras, números, punto o guion).' })
  usuario: string;

  /** Correo de contacto (opcional, no se usa para entrar). */
  @IsOptional() @ValidateIf((o) => !!o.correo) @IsEmail({}, { message: 'Escribe un correo válido.' }) @MaxLength(150)
  correo?: string | null;

  /** Mínimo 10 caracteres. */
  @IsString() @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres.' }) @MaxLength(100)
  password: string;

  /** Las cuentas de empleados (rol EMPLEADO) se crean desde la ficha del empleado. */
  @IsIn(ROLES_PERSONAL, { message: 'El rol debe ser ADMIN, TECNICO o CONSULTA.' })
  rol: (typeof ROLES_PERSONAL)[number];
}

export class ActualizarUsuarioSistemaDto extends PartialType(CrearUsuarioSistemaDto) {
  @IsOptional() @IsBoolean()
  activo?: boolean;
}

export class CrearAccesoEmpleadoDto {
  /** Usuario para la app. Si no se envía, se usa el número de empleado. */
  @IsOptional() @IsString() @MaxLength(60)
  @Matches(/^[a-z0-9._-]{3,}$/i, { message: 'El usuario debe tener al menos 3 caracteres, sin espacios (letras, números, punto o guion).' })
  usuario?: string;
}

export class ActualizarAccesoEmpleadoDto {
  @IsOptional() @IsBoolean()
  activo?: boolean;

  /** true genera una contraseña temporal nueva (se muestra una sola vez). */
  @IsOptional() @IsBoolean()
  restablecerPassword?: boolean;
}
