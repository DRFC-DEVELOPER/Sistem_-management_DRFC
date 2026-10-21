import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '../common/decorators/roles.decorator';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { UsuariosSistemaService } from './usuarios-sistema.service';
import { ActualizarUsuarioSistemaDto, CrearUsuarioSistemaDto } from './dto/usuario-sistema.dto';

@ApiTags('Usuarios del sistema')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('usuarios-sistema')
export class UsuariosSistemaController {
  constructor(private servicio: UsuariosSistemaService) {}

  @Get()
  listar() {
    return this.servicio.listar();
  }

  @Post()
  crear(@Body() dto: CrearUsuarioSistemaDto, @Usuario() u: UsuarioActual) {
    return this.servicio.crear(dto, u.id);
  }

  @Patch(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarUsuarioSistemaDto, @Usuario() u: UsuarioActual) {
    return this.servicio.actualizar(id, dto, u.id);
  }
}
