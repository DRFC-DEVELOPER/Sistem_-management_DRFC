import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { ReparacionesService } from './reparaciones.service';
import { EnviarReparacionDto, FiltroReparacionesDto, RecibirReparacionDto } from './dto/reparacion.dto';

@ApiTags('Reparaciones')
@ApiBearerAuth()
@Controller('reparaciones')
export class ReparacionesController {
  constructor(private servicio: ReparacionesService) {}

  @Get()
  listar(@Query() f: FiltroReparacionesDto) {
    return this.servicio.listar(f);
  }

  @Post()
  enviar(@Body() dto: EnviarReparacionDto, @Usuario() u: UsuarioActual) {
    return this.servicio.enviar(dto, u.id);
  }

  /** Registra que el equipo regresó y cómo quedó. */
  @Post(':id/recepcion')
  @HttpCode(200)
  recibir(@Param('id', ParseIntPipe) id: number, @Body() dto: RecibirReparacionDto, @Usuario() u: UsuarioActual) {
    return this.servicio.recibir(id, dto, u.id);
  }
}
