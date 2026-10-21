import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { BitacoraService } from './bitacora.service';

export class FiltroBitacoraDto {
  @IsOptional() @IsIn(['equipo', 'empleado', 'asignacion', 'reparacion', 'usuario', 'departamento']) entidad?: string;
  @IsOptional() @Type(() => Number) @IsInt() entidadId?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limite?: number;
}

@ApiTags('Bitácora')
@ApiBearerAuth()
@Controller('bitacora')
export class BitacoraController {
  constructor(private bitacora: BitacoraService) {}

  /** Historial de cambios en el sistema (solo administradores). */
  @Get()
  @Roles('ADMIN')
  listar(@Query() f: FiltroBitacoraDto) {
    return this.bitacora.listar(f);
  }
}
