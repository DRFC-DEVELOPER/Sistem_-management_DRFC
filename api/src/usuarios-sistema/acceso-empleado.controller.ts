import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../common/decorators/roles.decorator';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { UsuariosSistemaService } from './usuarios-sistema.service';
import { ActualizarAccesoEmpleadoDto, CrearAccesoEmpleadoDto } from './dto/usuario-sistema.dto';

/** Cuenta con la que el empleado entra a la app móvil (rol EMPLEADO). */
@ApiTags('Acceso de empleados a la app')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('empleados/:empleadoId/acceso')
export class AccesoEmpleadoController {
  constructor(private servicio: UsuariosSistemaService) {}

  @Get()
  obtener(@Param('empleadoId', ParseIntPipe) empleadoId: number) {
    return this.servicio.accesoDe(empleadoId);
  }

  /** Devuelve la contraseña temporal una sola vez; dásela al empleado. */
  @Post()
  crear(@Param('empleadoId', ParseIntPipe) empleadoId: number, @Body() dto: CrearAccesoEmpleadoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.crearAcceso(empleadoId, dto, u.id);
  }

  @Patch()
  actualizar(@Param('empleadoId', ParseIntPipe) empleadoId: number, @Body() dto: ActualizarAccesoEmpleadoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.actualizarAcceso(empleadoId, dto, u.id);
  }
}
