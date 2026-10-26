import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { NombreCatalogoDto } from './dto/catalogo.dto';
import { CatalogosService } from './catalogos.service';

@ApiTags('Catálogos')
@ApiBearerAuth()
@Controller('catalogos')
export class CatalogosController {
  constructor(private servicio: CatalogosService) {}

  @Get('tipos-equipo')
  listarTiposEquipo() {
    return this.servicio.listarTiposEquipo();
  }

  @Post('tipos-equipo')
  @Roles('ADMIN')
  crearTipoEquipo(@Body() dto: NombreCatalogoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.crearTipoEquipo(dto.nombre, u.id);
  }

  @Patch('tipos-equipo/:nombre')
  @Roles('ADMIN')
  renombrarTipoEquipo(@Param('nombre') nombre: string, @Body() dto: NombreCatalogoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.renombrarTipoEquipo(nombre, dto.nombre, u.id);
  }

  @Delete('tipos-equipo/:nombre')
  @Roles('ADMIN')
  eliminarTipoEquipo(@Param('nombre') nombre: string, @Usuario() u: UsuarioActual) {
    return this.servicio.eliminarTipoEquipo(nombre, u.id);
  }

  @Get('marcas')
  listarMarcas() {
    return this.servicio.listarMarcas();
  }

  @Post('marcas')
  @Roles('ADMIN')
  crearMarca(@Body() dto: NombreCatalogoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.crearMarca(dto.nombre, u.id);
  }

  @Patch('marcas/:id')
  @Roles('ADMIN')
  renombrarMarca(@Param('id', ParseIntPipe) id: number, @Body() dto: NombreCatalogoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.renombrarMarca(id, dto.nombre, u.id);
  }

  @Delete('marcas/:id')
  @Roles('ADMIN')
  eliminarMarca(@Param('id', ParseIntPipe) id: number, @Usuario() u: UsuarioActual) {
    return this.servicio.eliminarMarca(id, u.id);
  }
}

@ApiTags('Puestos')
@ApiBearerAuth()
@Controller('departamentos/:departamentoId/puestos')
export class PuestosController {
  constructor(private servicio: CatalogosService) {}

  @Get()
  listar(@Param('departamentoId', ParseIntPipe) departamentoId: number) {
    return this.servicio.listarPuestos(departamentoId);
  }

  @Post()
  @Roles('ADMIN')
  crear(@Param('departamentoId', ParseIntPipe) departamentoId: number, @Body() dto: NombreCatalogoDto, @Usuario() u: UsuarioActual) {
    return this.servicio.crearPuesto(departamentoId, dto.nombre, u.id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  renombrar(
    @Param('departamentoId', ParseIntPipe) departamentoId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NombreCatalogoDto,
    @Usuario() u: UsuarioActual,
  ) {
    return this.servicio.renombrarPuesto(departamentoId, id, dto.nombre, u.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  eliminar(
    @Param('departamentoId', ParseIntPipe) departamentoId: number,
    @Param('id', ParseIntPipe) id: number,
    @Usuario() u: UsuarioActual,
  ) {
    return this.servicio.eliminarPuesto(departamentoId, id, u.id);
  }
}
