import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DbModule } from './db/db.module';
import { BitacoraModule } from './bitacora/bitacora.module';
import { AuthModule } from './auth/auth.module';
import { UsuariosSistemaModule } from './usuarios-sistema/usuarios-sistema.module';
import { DepartamentosModule } from './departamentos/departamentos.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { EmpleadosModule } from './empleados/empleados.module';
import { EquiposModule } from './equipos/equipos.module';
import { AsignacionesModule } from './asignaciones/asignaciones.module';
import { ReparacionesModule } from './reparaciones/reparaciones.module';
import { ExcelModule } from './excel/excel.module';
import { SaludController } from './salud/salud.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
      errorMessage: 'Demasiados intentos. Espera un minuto y vuelve a intentarlo.',
    }),
    DbModule,
    BitacoraModule,
    AuthModule,
    UsuariosSistemaModule,
    DepartamentosModule,
    CatalogosModule,
    EmpleadosModule,
    EquiposModule,
    AsignacionesModule,
    ReparacionesModule,
    ExcelModule,
  ],
  controllers: [SaludController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
