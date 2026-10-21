import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../common/decorators/roles.decorator';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { EmpleadosService } from './empleados.service';
import { ActualizarEmpleadoDto, CrearEmpleadoDto, FiltroEmpleadosDto } from './dto/empleado.dto';

@ApiTags('Empleados')
@ApiBearerAuth()
@Controller('empleados')
export class EmpleadosController {
  constructor(private servicio: EmpleadosService) {}

  @Get()
  listar(@Query() f: FiltroEmpleadosDto) {
    return this.servicio.listar(f);
  }

  /** Datos del empleado, sus equipos actuales y su historial. */
  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.obtener(id);
  }

  @Post()
  crear(@Body() dto: CrearEmpleadoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.crear(dto, u.id);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarEmpleadoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.actualizar(id, dto, u.id);
  }

  /** Da de baja al empleado; sus equipos vuelven a quedar disponibles. */
  @Post(':id/baja')
  @HttpCode(200)
  baja(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) {
    return this.servicio.baja(id, u.id);
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
