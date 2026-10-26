import { IsString, MaxLength, MinLength } from 'class-validator';

export class NombreCatalogoDto {
  @IsString() @MinLength(2) @MaxLength(80)
  nombre: string;
}

export class RenombrarTipoEquipoDto extends NombreCatalogoDto {}
