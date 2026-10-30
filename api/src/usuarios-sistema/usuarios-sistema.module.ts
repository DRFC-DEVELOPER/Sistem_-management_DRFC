import { Module } from '@nestjs/common';
import { AccesoEmpleadoController } from './acceso-empleado.controller';
import { UsuariosSistemaController } from './usuarios-sistema.controller';
import { UsuariosSistemaService } from './usuarios-sistema.service';

@Module({ controllers: [UsuariosSistemaController, AccesoEmpleadoController], providers: [UsuariosSistemaService] })
export class UsuariosSistemaModule {}
