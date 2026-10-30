import { Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { ReportesService } from './reportes.service';
import { CrearReporteDto } from './dto/reporte.dto';

const empleadoDe = (u: UsuarioActual) => {
  if (!u.empleadoId) throw new ForbiddenException('Tu cuenta no está ligada a un empleado.');
  return u.empleadoId;
};

/** Lo que ve el empleado en la app: solo sus datos y sus equipos, sin poder editarlos. */
@ApiTags('App del empleado')
@ApiBearerAuth()
@Roles('EMPLEADO')
@Controller('mi')
export class MiController {
  constructor(private servicio: ReportesService) {}

  @Get('perfil')
  perfil(@Usuario() u: UsuarioActual) {
    return this.servicio.miPerfil(empleadoDe(u));
  }

  @Get('equipos')
  equipos(@Usuario() u: UsuarioActual) {
    return this.servicio.misEquipos(empleadoDe(u));
  }

  @Get('reportes')
  reportes(@Usuario() u: UsuarioActual) {
    return this.servicio.misReportes(empleadoDe(u));
  }

  /** Reporta una falla en uno de sus equipos; le llega a soporte. */
  @Post('reportes')
  reportar(@Usuario() u: UsuarioActual, @Body() dto: CrearReporteDto) {
    return this.servicio.crear(empleadoDe(u), dto, u.id);
  }
}
