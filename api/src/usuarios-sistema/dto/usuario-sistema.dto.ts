import { PartialType } from '@nestjs/swagger';
import { rol, Rol } from '../../db/esquema';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CrearUsuarioSistemaDto {
  @IsString() @MinLength(2) @MaxLength(120)
  nombre: string;

  @IsEmail({}, { message: 'Escribe un correo válido.' })
  correo: string;

  /** Mínimo 10 caracteres. */
  @IsString() @MinLength(10, { message: 'La contraseña debe tener al menos 10 caracteres.' }) @MaxLength(100)
  password: string;

  @IsIn(rol.enumValues)
  rol: Rol;
}

export class ActualizarUsuarioSistemaDto extends PartialType(CrearUsuarioSistemaDto) {
  @IsOptional() @IsBoolean()
  activo?: boolean;
}
