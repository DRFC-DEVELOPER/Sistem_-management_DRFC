import { Module } from '@nestjs/common';
import { EquiposController } from './equipos.controller';
import { EquiposService } from './equipos.service';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';

@Module({ imports: [AsignacionesModule], controllers: [EquiposController], providers: [EquiposService] })
export class EquiposModule {}
