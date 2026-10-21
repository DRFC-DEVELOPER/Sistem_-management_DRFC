import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { Publico } from '../common/decorators/publico.decorator';
import { DB, InjectDb } from '../db/db.module';

@ApiTags('Salud')
@Controller('salud')
export class SaludController {
  constructor(@InjectDb() private db: DB) {}

  /** Comprueba que la API y la base de datos responden. */
  @Get()
  @Publico()
  async estado() {
    await this.db.execute(sql`select 1`);
    return { ok: true, fecha: new Date().toISOString() };
  }
}
