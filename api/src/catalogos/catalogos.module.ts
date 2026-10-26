import { Module } from '@nestjs/common';
import { BitacoraModule } from '../bitacora/bitacora.module';
import { CatalogosController, PuestosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';

@Module({
  imports: [BitacoraModule],
  controllers: [CatalogosController, PuestosController],
  providers: [CatalogosService],
  exports: [CatalogosService],
})
export class CatalogosModule {}
