import { BadRequestException, Controller, Get, HttpCode, ParseIntPipe, Post, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
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

  /** Genera la carta responsiva de un empleado con sus entregas y devoluciones. */
  @Get('responsiva')
  async responsiva(@Query('empleadoId', ParseIntPipe) empleadoId: number) {
    const { buffer, nombre } = await this.excel.generarResponsiva(empleadoId);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${nombre}"`,
    });
  }

  /** Genera un solo Excel con una carta por hoja para los empleados seleccionados. */
  @Get('responsivas')
  async responsivas(@Query('empleadoIds') textoIds: string, @Query('equipoIds') textoEquipoIds?: string) {
    if (!textoIds?.trim()) throw new BadRequestException('Selecciona al menos un empleado.');
    const leerId = (valor: string, entidad: string) => {
      if (!/^[1-9]\d*$/.test(valor)) throw new BadRequestException(`La selección contiene un ID de ${entidad} inválido.`);
      const id = Number(valor);
      if (!Number.isSafeInteger(id)) throw new BadRequestException(`La selección contiene un ID de ${entidad} inválido.`);
      return id;
    };
    const empleadoIds = textoIds.split(',').map((valor) => leerId(valor, 'empleado'));
    const seleccionEquipos = textoEquipoIds === undefined ? undefined : textoEquipoIds === ''
      ? []
      : textoEquipoIds.split(',').map((registro) => {
        const [empleadoId, equipoId, ...sobrantes] = registro.split('-');
        if (sobrantes.length || !empleadoId || !equipoId) {
          throw new BadRequestException('La selección contiene un equipo inválido.');
        }
        return {
          empleadoId: leerId(empleadoId, 'empleado'),
          equipoId: leerId(equipoId, 'equipo'),
        };
      });
    const { buffer, nombre } = await this.excel.generarResponsivas(empleadoIds, seleccionEquipos);
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="${nombre}"`,
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
