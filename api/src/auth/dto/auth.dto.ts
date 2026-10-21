import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Escribe un correo válido.' })
  correo: string;

  @IsString()
  @MinLength(1, { message: 'Escribe tu contraseña.' })
  password: string;
}

export class CambiarPasswordDto {
  @IsString()
  actual: string;

  /** Mínimo 10 caracteres. */
  @IsString()
  @MinLength(10, { message: 'La contraseña nueva debe tener al menos 10 caracteres.' })
  @MaxLength(100)
  nueva: string;
}
