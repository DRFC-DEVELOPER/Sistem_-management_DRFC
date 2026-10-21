import { Module } from '@nestjs/common';
import { DepartamentosController } from './departamentos.controller';
import { DepartamentosService } from './departamentos.service';

@Module({ controllers: [DepartamentosController], providers: [DepartamentosService], exports: [DepartamentosService] })
export class DepartamentosModule {}
