import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  /** Nombre de usuario o correo electrónico. */
  @IsString()
  @MinLength(1, { message: 'Escribe tu usuario.' })
  @MaxLength(60)
  usuario: string;

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
