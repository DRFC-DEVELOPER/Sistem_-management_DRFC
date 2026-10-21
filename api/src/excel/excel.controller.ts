import { BadRequestException, Controller, Get, HttpCode, Post, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Usuario, UsuarioActual } from '../common/decorators/usuario-actual.decorator';
import { hoy } from '../common/utiles';
import { ExcelService } from './excel.service';

const subida = FileInterceptor('archivo', { limits: { fileSize: 10 * 1024 * 1024 } });
const cuerpoArchivo = { schema: { type: 'object', properties: { archivo: { type: 'string', format: 'binary' } } } };

function revisar(f?: Express.Multer.File) {
  if (!f) throw new BadRequestException('Adjunta el archivo en el campo «archivo».');
  if (!/\.xlsx$/i.test(f.originalname)) throw new BadRequestException('El archivo debe ser .xlsx. Si es .xls, ábrelo en Excel y guárdalo como .xlsx.');
  return f.buffer;
}

@ApiTags('Excel')
@ApiBearerAuth()
@Controller('excel')
export class ExcelController {
  constructor(private excel: ExcelService) {}

  /** Descarga el inventario en Excel (formato original + hoja con todos los equipos). */
  @Get('exportar')
  async exportar() {
    const buf = await this.excel.exportar();
    return new StreamableFile(buf, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="inventario-equipos-${hoy()}.xlsx"`,
    });
  }

  /** Revisa el archivo y muestra qué se importaría, sin guardar nada. */
  @Post('analizar')
  @HttpCode(200)
  @UseInterceptors(subida)
  @ApiConsumes('multipart/form-data')
  @ApiBody(cuerpoArchivo)
  async analizar(@UploadedFile() archivo?: Express.Multer.File) {
    return this.excel.resumen(await this.excel.analizar(revisar(archivo)));
  }

  /** Importa el archivo: crea empleados nuevos y equipos (asignados si la fila tiene usuario). */
  @Post('importar')
  @HttpCode(200)
  @UseInterceptors(subida)
  @ApiConsumes('multipart/form-data')
  @ApiBody(cuerpoArchivo)
  importar(@UploadedFile() archivo: Express.Multer.File | undefined, @Usuario() u: UsuarioActual) {
    return this.excel.importar(revisar(archivo), u.id);
  }
}
