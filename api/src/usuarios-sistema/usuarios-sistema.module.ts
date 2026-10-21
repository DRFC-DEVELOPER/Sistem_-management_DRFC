import { Module } from '@nestjs/common';
import { UsuariosSistemaController } from './usuarios-sistema.controller';
import { UsuariosSistemaService } from './usuarios-sistema.service';

@Module({ controllers: [UsuariosSistemaController], providers: [UsuariosSistemaService] })
export class UsuariosSistemaModule {}
