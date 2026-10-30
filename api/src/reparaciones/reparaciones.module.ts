import { Module } from '@nestjs/common';
import { ReparacionesController } from './reparaciones.controller';
import { ReparacionesService } from './reparaciones.service';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';

@Module({ imports: [AsignacionesModule], controllers: [ReparacionesController], providers: [ReparacionesService], exports: [ReparacionesService] })
export class ReparacionesModule {}
