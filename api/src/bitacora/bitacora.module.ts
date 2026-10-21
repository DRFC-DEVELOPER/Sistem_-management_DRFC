import { Global, Module } from '@nestjs/common';
import { BitacoraService } from './bitacora.service';
import { BitacoraController } from './bitacora.controller';

@Global()
@Module({ providers: [BitacoraService], controllers: [BitacoraController], exports: [BitacoraService] })
export class BitacoraModule {}
