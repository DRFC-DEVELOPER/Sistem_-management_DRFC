import { Module } from '@nestjs/common';
import { EmpleadosController } from './empleados.controller';
import { EmpleadosService } from './empleados.service';
import { DepartamentosModule } from '../departamentos/departamentos.module';
import { AsignacionesModule } from '../asignaciones/asignaciones.module';

@Module({ imports: [DepartamentosModule, AsignacionesModule], controllers: [EmpleadosController], providers: [EmpleadosService] })
export class EmpleadosModule {}
