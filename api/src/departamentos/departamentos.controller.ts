import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { DepartamentosService } from './departamentos.service';
import { DepartamentoDto } from './dto/departamento.dto';

@ApiTags('Departamentos')
@ApiBearerAuth()
@Controller('departamentos')
export class DepartamentosController {
  constructor(private servicio: DepartamentosService) {}

  @Get()
  listar() {
    return this.servicio.listar();
  }

  @Post()
  @Roles('ADMIN')
  crear(@Body() dto: DepartamentoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.crear(dto.nombre, u.id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  renombrar(@Param('id', ParseIntPipe) id: number, @Body() dto: DepartamentoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.renombrar(id, dto.nombre, u.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  eliminar(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) {
    return this.servicio.eliminar(id, u.id);
  }
}
