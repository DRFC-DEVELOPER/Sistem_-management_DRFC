import { Module } from '@nestjs/common';
import { ReparacionesModule } from '../reparaciones/reparaciones.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { MiController } from './mi.controller';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({ imports: [ReparacionesModule, NotificacionesModule], controllers: [ReportesController, MiController], providers: [ReportesService] })
export class ReportesModule {}
