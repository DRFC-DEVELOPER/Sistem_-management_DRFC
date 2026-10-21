import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../common/decorators/roles.decorator';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { EquiposService } from './equipos.service';
import { ActualizarEquipoDto, BajaEquipoDto, CambiarEstatusDto, CrearEquipoDto, FiltroEquiposDto } from './dto/equipo.dto';

@ApiTags('Equipos')
@ApiBearerAuth()
@Controller('equipos')
export class EquiposController {
  constructor(private servicio: EquiposService) {}

  /** Lista paginada con búsqueda y filtros. */
  @Get()
  listar(@Query() f: FiltroEquiposDto) {
    return this.servicio.listar(f);
  }

  /** Conteos por estatus y por tipo. */
  @Get('resumen')
  resumen() {
    return this.servicio.resumen();
  }

  /** Busca un equipo por código de barras o número de serie. */
  @Get('codigo/:codigo')
  porCodigo(@Param('codigo') codigo: string) {
    return this.servicio.porCodigo(codigo);
  }

  /** Ficha completa con historial de asignaciones y reparaciones. */
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Post()
  crear(@Body() dto: CrearEquipoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.crear(dto, u.id);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarEquipoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.actualizar(id, dto, u.id);
  }

  /** Marca el equipo como DISPONIBLE o DANADO. */
  @Post(':id/estatus')
  @HttpCode(200)
  cambiarEstatus(@Param('id', ParseIntPipe) id: number, @Body() dto: CambiarEstatusDto, @Usuario() u: UsuarioActual) {
    return this.servicio.cambiarEstatus(id, dto, u.id);
  }

  @Post(':id/baja')
  @HttpCode(200)
  baja(@Param('id', ParseIntPipe) id: number, @Body() dto: BajaEquipoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.baja(id, dto.motivo, u.id);
  }

  @Post(':id/reactivar')
  @HttpCode(200)
  reactivar(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) {
    return this.servicio.reactivar(id, u.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  eliminar(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) {
    return this.servicio.eliminar(id, u.id);
  }
}
