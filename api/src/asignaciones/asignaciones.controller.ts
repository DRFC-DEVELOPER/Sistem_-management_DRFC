import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { AsignacionesService } from './asignaciones.service';
import { AsignarDto, DevolverDto, FiltroAsignacionesDto } from './dto/asignacion.dto';

@ApiTags('Asignaciones')
@ApiBearerAuth()
@Controller('asignaciones')
export class AsignacionesController {
  constructor(private servicio: AsignacionesService) {}

  /** Historial de entregas y devoluciones. */
  @Get()
  listar(@Query() f: FiltroAsignacionesDto) {
    return this.servicio.listar(f);
  }

  /** Entrega un equipo disponible a un empleado. */
  @Post()
  asignar(@Body() dto: AsignarDto, @Usuario() u: UsuarioActual) {
    return this.servicio.asignar(dto, u.id);
  }

  /** Registra la devolución; el equipo queda disponible. */
  @Post('devolucion')
  @HttpCode(200)
  devolver(@Body() dto: DevolverDto, @Usuario() u: UsuarioActual) {
    return this.servicio.devolver(dto, u.id);
  }
}
