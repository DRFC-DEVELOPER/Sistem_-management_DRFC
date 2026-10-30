import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { ReportesService } from './reportes.service';
import { AtenderReporteDto, CerrarReporteDto, FiltroReportesDto, ReporteAReparacionDto } from './dto/reporte.dto';

/** Solicitudes de soporte que los empleados mandan desde la app. */
@ApiTags('Reportes de falla')
@ApiBearerAuth()
@Controller('reportes-falla')
export class ReportesController {
  constructor(private servicio: ReportesService) {}

  @Get()
  listar(@Query() f: FiltroReportesDto) {
    return this.servicio.listar(f);
  }

  /** Cuántos reportes hay sin atender y en atención (para el contador del menú). */
  @Get('resumen')
  resumen() {
    return this.servicio.resumen();
  }

  @Post(':id/atender')
  @HttpCode(200)
  atender(@Param('id', ParseIntPipe) id: number, @Body() dto: AtenderReporteDto, @Usuario() u: UsuarioActual) {
    return this.servicio.atender(id, dto, u.id);
  }

  @Post(':id/reparacion')
  @HttpCode(200)
  enviarAReparacion(@Param('id', ParseIntPipe) id: number, @Body() dto: ReporteAReparacionDto, @Usuario() u: UsuarioActual) {
    return this.servicio.enviarAReparacion(id, dto, u.id);
  }

  @Post(':id/cerrar')
  @HttpCode(200)
  cerrar(@Param('id', ParseIntPipe) id: number, @Body() dto: CerrarReporteDto, @Usuario() u: UsuarioActual) {
    return this.servicio.cerrar(id, dto, u.id);
  }
}
