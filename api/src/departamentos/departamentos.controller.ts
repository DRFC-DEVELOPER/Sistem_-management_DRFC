import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  crear(@Body() dto: DepartamentoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.crear(dto.nombre, u.id);
  }

  @Patch(':id')
  renombrar(@Param('id', ParseIntPipe) id: number, @Body() dto: DepartamentoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.renombrar(id, dto.nombre, u.id);
  }
}
