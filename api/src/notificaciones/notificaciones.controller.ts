import { Body, Controller, Delete, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { NotificacionesService } from './notificaciones.service';

export class DispositivoDto {
  /** Token que da Expo en el celular, por ejemplo ExponentPushToken[xxxx]. */
  @IsString() @MaxLength(200)
  @Matches(/^Expo(nent)?PushToken\[[^\]]+\]$/, { message: 'El token de notificaciones no es válido.' })
  token: string;

  @IsOptional() @IsIn(['android', 'ios'])
  plataforma?: 'android' | 'ios';
}

/** Celulares de la app que reciben notificaciones push. */
@ApiTags('Notificaciones')
@ApiBearerAuth()
@Roles('ADMIN', 'TECNICO', 'CONSULTA', 'EMPLEADO')
@Controller('dispositivos')
export class NotificacionesController {
  constructor(private servicio: NotificacionesService) {}

  @Post()
  @HttpCode(200)
  registrar(@Usuario() u: UsuarioActual, @Body() dto: DispositivoDto) {
    return this.servicio.registrar(u.id, dto.token, dto.plataforma);
  }

  @Delete()
  quitar(@Usuario() u: UsuarioActual, @Body() dto: DispositivoDto) {
    return this.servicio.quitar(u.id, dto.token);
  }
}
