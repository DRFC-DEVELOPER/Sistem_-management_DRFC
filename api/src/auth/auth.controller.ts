import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Publico } from '../common/decorators/publico.decorator';
import { ConClaveTemporal } from '../common/decorators/clave-temporal.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { AuthService } from './auth.service';
import { CambiarPasswordDto, LoginDto } from './dto/auth.dto';

@ApiTags('Acceso')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /** Inicia sesión y devuelve el token para las demás peticiones. Máximo 5 intentos por minuto. */
  @Post('login')
  @Publico()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.usuario, dto.password);
  }

  /** Datos del usuario con la sesión iniciada. */
  @Get('yo')
  @ApiBearerAuth()
  @ConClaveTemporal()
  @Roles('ADMIN', 'TECNICO', 'CONSULTA', 'EMPLEADO')
  yo(@Usuario() u: UsuarioActual) {
    return u;
  }

  /** Cambia la contraseña propia. */
  @Patch('password')
  @ApiBearerAuth()
  @ConClaveTemporal()
  @Roles('ADMIN', 'TECNICO', 'CONSULTA', 'EMPLEADO')
  cambiarPassword(@Usuario() u: UsuarioActual, @Body() dto: CambiarPasswordDto) {
    return this.auth.cambiarPassword(u.id, dto.actual, dto.nueva);
  }
}
