import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { asc, desc, eq, isNotNull } from 'drizzle-orm';
import { join } from 'path';
import ExcelJS from 'exceljs';
import { DB, InjectDb } from '../db/db.module';
import { asignaciones, departamentos, empleados, equipos, TipoAdaptador, TipoEquipo } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { normalizarDepto } from '../departamentos/departamentos.service';
import { hoy } from '../common/utiles';
import { color, dato, disco, esPropio, fecha, marca, memoria, NO_ES_USUARIO, sistema, texto, tipoMultifuncional } from './limpieza';

interface EquipoLeido {
  tipo: TipoEquipo;
  descripcion?: string;
  marca?: string;
  modelo?: string;
  serie?: string;
  color?: string;
  memoriaGb?: string;
  procesador?: string;
  disco?: string;
  sistemaOperativo?: string;
  ipGestion?: string;
  tipoAdaptador?: TipoAdaptador;
  notas: string[];
  empleadoClave: string | null;
  fechaEntrega: string | null;
}

interface Analisis {
  filas: number;
  empleadosNuevos: { clave: string; nombre: string; departamento: string; numero: string; notas: string[] }[];
  empleadosExistentes: Map<string, number>;
  equipos: EquipoLeido[];
  omitidos: string[];
  avisos: string[];
}

const TIPOS_ES: Record<TipoEquipo, string> = {
  LAPTOP: 'Laptop', TECLADO: 'Teclado', MOUSE: 'Mouse', MONITOR: 'Monitor', ADAPTADOR: 'Adaptador',
  MULTIFUNCIONAL: 'Multifuncional', SOPORTE: 'Soporte', ACCESS_POINT: 'Access Point', OTRO: 'Otro',
};
const clave = (nombre: string, depto: string) => `${nombre.toLowerCase()}|${normalizarDepto(depto)}`;
const slugSeguro = (nombre: string) => nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

@Injectable()
export class ExcelService {
  constructor(@InjectDb() private db: DB, private bitacora: BitacoraService) {}

  private buscarEmpleadoResponsiva(empleadoId: number) {
    return this.db.query.empleados.findFirst({
      where: eq(empleados.id, empleadoId),
      with: {
        departamento: true,
        puesto: true,
        equiposActuales: { orderBy: [asc(equipos.tipo), asc(equipos.id)] },
        asignaciones: {
          orderBy: [desc(asignaciones.fechaDevolucion), desc(asignaciones.id)],
          with: { equipo: true },
        },
      },
    });
  }

  async generarResponsiva(empleadoId: number): Promise<{ buffer: Buffer; nombre: string }> {
    return this.generarResponsivas([empleadoId]);
  }

  async generarResponsivas(
    empleadoIds: number[],
    seleccionEquipos?: { empleadoId: number; equipoId: number }[],
  ): Promise<{ buffer: Buffer; nombre: string }> {
    if (!empleadoIds.length) throw new BadRequestException('Selecciona al menos un empleado.');
    if (new Set(empleadoIds).size !== empleadoIds.length) {
      throw new BadRequestException('La selección contiene empleados repetidos.');
    }
    const claveEquipo = (empleadoId: number, equipoId: number) => `${empleadoId}:${equipoId}`;
    if (seleccionEquipos && new Set(seleccionEquipos.map(({ empleadoId, equipoId }) => claveEquipo(empleadoId, equipoId))).size !== seleccionEquipos.length) {
      throw new BadRequestException('La selección contiene equipos repetidos.');
    }

    const plantilla = join(__dirname, '..', '..', 'datos', 'plantilla-carta-responsiva.xlsx');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(plantilla);
    const hojaBase = wb.worksheets[0];
    if (!hojaBase) throw new Error('La plantilla de carta responsiva no tiene hojas.');
    const modeloBase = hojaBase.model;
    const estilosBase = Array.from({ length: hojaBase.rowCount }, (_, fila) =>
      Array.from({ length: hojaBase.columnCount }, (_, columna) => {
        const celda = hojaBase.getCell(fila + 1, columna + 1);
        return { direccion: celda.address, estilo: structuredClone(celda.style) };
      }),
    ).flat().filter(({ estilo }) => Object.keys(estilo).length > 0);

    let primerNombre = '';
    let departamentoId: number | null | undefined;
    const equipoIdsValidos = new Set<string>();
    const hojas: { hoja: ExcelJS.Worksheet; empleado: NonNullable<Awaited<ReturnType<ExcelService['buscarEmpleadoResponsiva']>>> }[] = [];
    for (const [indice, empleadoId] of empleadoIds.entries()) {
      const empleado = await this.buscarEmpleadoResponsiva(empleadoId);
      if (!empleado) throw new NotFoundException(`El empleado con ID ${empleadoId} no existe.`);
      if (indice === 0) {
        departamentoId = empleado.departamentoId;
      } else if (empleado.departamentoId !== departamentoId) {
        throw new BadRequestException('Las cartas de un mismo archivo deben ser de empleados del mismo departamento.');
      }
      if (indice === 0) primerNombre = empleado.nombre;

      const hojaNombre = `${slugSeguro(empleado.nombre).slice(0, 22) || 'empleado'}-${empleado.id}`;
      const hoja = indice === 0 ? hojaBase : wb.addWorksheet(hojaNombre);
      if (indice === 0) {
        hoja.name = hojaNombre;
      } else {
        hoja.model = { ...modeloBase, id: hoja.id, name: hojaNombre };
        estilosBase.forEach(({ direccion, estilo }) => { hoja.getCell(direccion).style = structuredClone(estilo); });
        modeloBase.merges.forEach((merge) => hoja.mergeCellsWithoutStyle(merge));
      }

      empleado.equiposActuales.filter((e) => e.estatus === 'ASIGNADO').forEach((e) => equipoIdsValidos.add(claveEquipo(empleado.id, e.id)));
      empleado.asignaciones.filter((a) => a.fechaDevolucion && a.equipo).forEach((a) => {
        if (a.equipo) equipoIdsValidos.add(claveEquipo(empleado.id, a.equipo.id));
      });
      hojas.push({ hoja, empleado });
    }

    if (seleccionEquipos) {
      const noPermitidos = seleccionEquipos.filter(({ empleadoId, equipoId }) => !equipoIdsValidos.has(claveEquipo(empleadoId, equipoId)));
      if (noPermitidos.length) {
        throw new BadRequestException('La selección incluye equipos que no pertenecen a los empleados seleccionados.');
      }
    }
    let seleccionPorEmpleado: Map<number, Set<number>> | undefined;
    if (seleccionEquipos) {
      const selecciones = new Map<number, Set<number>>();
      seleccionEquipos.forEach(({ empleadoId, equipoId }) => {
        const seleccion = selecciones.get(empleadoId) ?? new Set<number>();
        seleccion.add(equipoId);
        selecciones.set(empleadoId, seleccion);
      });
      seleccionPorEmpleado = selecciones;
    }
    hojas.forEach(({ hoja, empleado }) => {
      const seleccion = seleccionPorEmpleado
        ? seleccionPorEmpleado.get(empleado.id) ?? new Set<number>()
        : undefined;
      this.llenarResponsiva(hoja, empleado, seleccion);
    });

    const nombre = empleadoIds.length === 1
      ? `carta-responsiva-${slugSeguro(primerNombre)}-${hoy()}.xlsx`
      : `cartas-responsivas-${hoy()}.xlsx`;
    return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), nombre };
  }

  private llenarResponsiva(
    hoja: ExcelJS.Worksheet,
    empleado: NonNullable<Awaited<ReturnType<ExcelService['buscarEmpleadoResponsiva']>>>,
    equipoIds?: Set<number>,
  ) {

    const entregas = empleado.equiposActuales.filter((e) => e.estatus === 'ASIGNADO' && (!equipoIds || equipoIds.has(e.id)));
    const devoluciones = empleado.asignaciones.filter((a) => a.fechaDevolucion && a.equipo && (!equipoIds || equipoIds.has(a.equipo.id)));
    if (entregas.length > 12 || devoluciones.length > 11) {
      throw new BadRequestException(
        `La plantilla tiene espacio para 12 equipos entregados y 11 devoluciones, dejando un renglón en blanco entre cada registro. ${empleado.nombre} tiene ${entregas.length} entregas vigentes y ${devoluciones.length} devoluciones registradas.`,
      );
    }

    const hoyFormato = new Date(`${hoy()}T12:00:00`);
    const fechaTexto = (fecha?: string | null) => fecha
      ? new Date(`${fecha.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX')
      : '';
    const tipoTexto = (tipo: string) => TIPOS_ES[tipo] ?? tipo;
    const descripcion = (e: typeof equipos.$inferSelect) => {
      const base = e.descripcion || tipoTexto(e.tipo);
      return e.tipo === 'ADAPTADOR' && e.tipoAdaptador ? `${base} (${e.tipoAdaptador === 'RED' ? 'Red' : 'Multipuertos'})` : base;
    };
    const datosEquipo = (e: typeof equipos.$inferSelect, fila: number, observaciones: string) => {
      hoja.getCell(`A${fila}`).value = e.codigoBarras || String(e.id);
      hoja.getCell(`B${fila}`).value = 1;
      hoja.getCell(`C${fila}`).value = descripcion(e);
      hoja.getCell(`E${fila}`).value = e.marca ?? '';
      hoja.getCell(`F${fila}`).value = e.modelo ?? '';
      hoja.getCell(`G${fila}`).value = e.serie ?? '';
      hoja.getCell(`H${fila}`).value = e.color ?? '';
      hoja.getCell(`I${fila}`).value = observaciones;
    };

    hoja.getCell('A7').value = empleado.nombre;
    hoja.getCell('E7').value = empleado.puesto?.nombre ?? '';
    hoja.getCell('H6').value = empleado.departamento?.nombre ?? '';
    hoja.getCell('H7').value = empleado.numero ?? '';
    hoja.getCell('I7').value = hoyFormato;
    hoja.getCell('I4').value = `No. Folio: ${empleado.id}-${hoy().replace(/-/g, '')}`;

    const vigentes = new Map(empleado.asignaciones.filter((a) => !a.fechaDevolucion).map((a) => [a.equipoId, a]));
    entregas.forEach((equipo, i) => {
      const asignacion = vigentes.get(equipo.id);
      const observaciones = [
        asignacion?.fechaEntrega ? `Entregado: ${fechaTexto(asignacion.fechaEntrega)}` : '',
        asignacion?.notas ?? '',
      ].filter(Boolean).join(' | ');
      datosEquipo(equipo, 14 + i * 2, observaciones);
    });

    const resultadoTexto: Record<string, string> = {
      DISPONIBLE: 'Devuelto disponible',
      DANADO: 'Devuelto dañado',
      EN_REPARACION: 'Enviado a reparación',
      BAJA: 'Dado de baja',
    };
    devoluciones.forEach((a, i) => {
      if (!a.equipo) return;
      const e = a.equipo;
      const observaciones = [
        a.fechaDevolucion ? `Devuelto: ${fechaTexto(a.fechaDevolucion)}` : '',
        a.resultado ? resultadoTexto[a.resultado] ?? a.resultado : '',
        a.notas ?? '',
      ].filter(Boolean).join(' | ');
      datosEquipo(e, 38 + i * 2, observaciones);
    });

  }

  private async leerHoja(buffer: Buffer) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('No se pudo leer el archivo. Guárdalo como Excel (.xlsx) e inténtalo de nuevo.');
    }
    const hoja = wb.worksheets[0];
    if (!hoja) throw new BadRequestException('El archivo no tiene hojas.');
    const filas: unknown[][] = [];
    hoja.eachRow({ includeEmpty: false }, (row) => {
      const valores = row.values as unknown[];
      filas.push(valores.slice(1)); // exceljs empieza en el índice 1
    });
    return filas;
  }

  /** Lee el Excel y calcula qué se importaría, sin guardar nada. */
  async analizar(buffer: Buffer): Promise<Analisis> {
    const filas = await this.leerHoja(buffer);
    let inicio = 0;
    let col = 0;
    filas.slice(0, 15).forEach((f, i) => {
      const c = f.findIndex((v) => texto(v).toUpperCase() === 'USUARIO');
      if (c >= 0) { inicio = i + 1; col = c; }
    });
    if (!inicio) throw new BadRequestException('No encontré la columna USUARIO en las primeras filas de la hoja.');

    const existentes = await this.db
      .select({ id: empleados.id, nombre: empleados.nombre, depto: departamentos.nombre, activo: empleados.activo })
      .from(empleados)
      .leftJoin(departamentos, eq(empleados.departamentoId, departamentos.id));
    const empleadosExistentes = new Map(existentes.filter((e) => e.activo).map((e) => [clave(e.nombre, e.depto ?? ''), e.id]));
    // Empleados dados de baja: sus equipos se importan sin asignar, igual que al asignar a mano.
    const inactivos = new Set(existentes.filter((e) => !e.activo).map((e) => clave(e.nombre, e.depto ?? '')));
    const deBaja = new Set<string>();
    const seriesBd = new Set(
      (await this.db.select({ s: equipos.serie }).from(equipos).where(isNotNull(equipos.serie))).map((r) => r.s!.toLowerCase()),
    );

    // Equipos sin serie ya registrados, para no duplicarlos si se sube el mismo archivo otra vez.
    const firma = (empleadoId: number | null | undefined, e: { tipo: string; marca?: string | null; modelo?: string | null; tipoAdaptador?: string | null }) =>
      [empleadoId ?? '-', e.tipo, e.marca ?? '', e.modelo ?? '', e.tipoAdaptador ?? ''].join('|').toLowerCase();
    const sinSerie = new Map<string, number>();
    (await this.db.query.equipos.findMany({ where: (t, { and, isNull, ne }) => and(isNull(t.serie), ne(t.estatus, 'BAJA')) })).forEach((e) => {
      const f = firma(e.empleadoId, e);
      sinSerie.set(f, (sinSerie.get(f) ?? 0) + 1);
    });

    const nuevos = new Map<string, Analisis['empleadosNuevos'][number]>();
    const lista: EquipoLeido[] = [];
    const enArchivo = new Map<string, EquipoLeido>();
    const omitidos: string[] = [];
    let conDatos = 0;

    for (const crudo of filas.slice(inicio)) {
      const r = crudo.slice(col);
      if (!r.some((v) => texto(v) || v instanceof Date)) continue;
      conDatos++;
      const nombreCrudo = texto(r[0]).replace(/\s*-\s*$/, '');
      const depto = dato(r[1]);
      const esUsuario = !!nombreCrudo && !NO_ES_USUARIO.has(nombreCrudo.toUpperCase());
      const kFila = esUsuario ? clave(nombreCrudo, depto) : null;
      const inactivo = !!kFila && !empleadosExistentes.has(kFila) && inactivos.has(kFila);
      if (inactivo) deBaja.add(nombreCrudo);
      const k = inactivo ? null : kFila;
      if (k && !empleadosExistentes.has(k) && !nuevos.has(k)) {
        nuevos.set(k, { clave: k, nombre: nombreCrudo, departamento: depto, numero: col > 0 ? texto(crudo[col - 1]) : '', notas: [] });
      }
      const notaFila = nombreCrudo && !esUsuario
        ? `En el Excel aparecía como “${nombreCrudo}”.`
        : inactivo ? `En el Excel aparecía asignado a ${nombreCrudo}, que está dado de baja.` : '';
      const fechaEntrega = fecha(r[30]);

      const agregar = (e: Omit<EquipoLeido, 'notas' | 'empleadoClave' | 'fechaEntrega'>) => {
        if (!e.marca && !e.modelo && !e.serie && !e.descripcion) return;
        const limpio = Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as typeof e;
        if (limpio.serie && seriesBd.has(limpio.serie.toLowerCase())) {
          omitidos.push(`${TIPOS_ES[e.tipo]} ${limpio.serie} (ya existe)`);
          return;
        }
        if (!limpio.serie) {
          const f = firma(k ? empleadosExistentes.get(k) : null, limpio);
          const n = sinSerie.get(f) ?? 0;
          if (n > 0) {
            sinSerie.set(f, n - 1);
            omitidos.push(`${TIPOS_ES[e.tipo]} ${[limpio.marca, limpio.modelo].filter(Boolean).join(' ') || 'sin serie'} de ${nombreCrudo || 'sin usuario'} (ya existe)`);
            return;
          }
        }
        const item: EquipoLeido = { ...limpio, notas: notaFila ? [notaFila] : [], empleadoClave: k, fechaEntrega };
        if (limpio.serie) {
          const previo = enArchivo.get(limpio.serie.toLowerCase());
          if (previo) {
            const n = 'Serie repetida en el Excel, verificar.';
            if (!previo.notas.includes(n)) previo.notas.push(n);
            item.notas.push(n);
          } else enArchivo.set(limpio.serie.toLowerCase(), item);
        }
        lista.push(item);
      };

      agregar({ tipo: 'LAPTOP', marca: marca(r[2]), modelo: dato(r[3]).toUpperCase(), serie: dato(r[4]).toUpperCase(), memoriaGb: memoria(r[5]), procesador: dato(r[6]), disco: disco(r[7]), sistemaOperativo: sistema(r[8]), color: color(r[9]) });
      ([['TECLADO', 10], ['MOUSE', 14], ['MONITOR', 18]] as const).forEach(([tipo, o]) => {
        if (esPropio(r[o])) {
          const u = k ? nuevos.get(k) : undefined;
          const n = `Usa ${TIPOS_ES[tipo].toLowerCase()} propio.`;
          if (u && !u.notas.includes(n)) u.notas.push(n);
          return;
        }
        agregar({ tipo, marca: marca(r[o]), modelo: dato(r[o + 1]).toUpperCase(), serie: dato(r[o + 2]).toUpperCase(), color: color(r[o + 3]) });
      });
      ([[22, 'RED', 'Adaptador de red'], [23, 'MULTIPUERTOS', 'Adaptador multipuertos']] as const).forEach(([o, t, d]) => {
        const v = dato(r[o]).toUpperCase();
        if (v) agregar({ tipo: 'ADAPTADOR', tipoAdaptador: t, descripcion: d, marca: /^S[IÍ]$/.test(v) ? '' : marca(v) });
      });
      const eqNombre = dato(r[24]);
      if (eqNombre || dato(r[25]) || dato(r[26]) || dato(r[27])) {
        agregar({ tipo: tipoMultifuncional(eqNombre), descripcion: eqNombre, marca: marca(r[25]), modelo: dato(r[26]).toUpperCase(), serie: dato(r[27]).toUpperCase(), ipGestion: dato(r[28]) });
      }
    }

    const avisos: string[] = [];
    const repetidas = lista.filter((e) => e.notas.some((n) => n.startsWith('Serie repetida'))).length;
    if (repetidas) avisos.push(`${repetidas} equipos tienen series repetidas dentro del archivo; se importan con una nota para revisarlos.`);
    if (deBaja.size) avisos.push(`${[...deBaja].join(', ')} ${deBaja.size === 1 ? 'está dado' : 'están dados'} de baja; sus equipos se importan como disponibles. Reactívalos y asígnalos si corresponde.`);
    return { filas: conDatos, empleadosNuevos: [...nuevos.values()], empleadosExistentes, equipos: lista, omitidos, avisos };
  }

  resumen(a: Analisis) {
    const porTipo: Record<string, number> = {};
    a.equipos.forEach((e) => (porTipo[TIPOS_ES[e.tipo]] = (porTipo[TIPOS_ES[e.tipo]] ?? 0) + 1));
    return {
      filas: a.filas,
      empleadosNuevos: a.empleadosNuevos.length,
      equiposNuevos: a.equipos.length,
      asignados: a.equipos.filter((e) => e.empleadoClave).length,
      porTipo,
      omitidos: a.omitidos,
      avisos: a.avisos,
      muestraEmpleados: a.empleadosNuevos.slice(0, 10).map((e) => `${e.nombre}${e.departamento ? ` (${normalizarDepto(e.departamento)})` : ''}`),
    };
  }

  async importar(buffer: Buffer, usuarioId: number) {
    const a = await this.analizar(buffer);
    if (!a.equipos.length && !a.empleadosNuevos.length) throw new BadRequestException('El archivo no tiene datos nuevos para importar.');
    await this.db.transaction(async (tx) => {
      const ids = new Map(a.empleadosExistentes);
      const deptos = new Map<string, number>();
      for (const e of a.empleadosNuevos) {
        let departamentoId: number | null = null;
        if (e.departamento) {
          const n = normalizarDepto(e.departamento);
          if (!deptos.has(n)) {
            await tx.insert(departamentos).values({ nombre: n }).onConflictDoNothing();
            const d = await tx.query.departamentos.findFirst({ where: eq(departamentos.nombre, n) });
            deptos.set(n, d!.id);
          }
          departamentoId = deptos.get(n)!;
        }
        const [r] = await tx
          .insert(empleados)
          .values({ nombre: e.nombre, numero: e.numero || null, notas: e.notas.join(' ') || null, departamentoId })
          .returning({ id: empleados.id });
        ids.set(e.clave, r.id);
      }
      for (const { notas, empleadoClave, fechaEntrega, ...e } of a.equipos) {
        const empleadoId = empleadoClave ? ids.get(empleadoClave) ?? null : null;
        const [r] = await tx
          .insert(equipos)
          .values({ ...e, notas: notas.join(' ') || null, estatus: empleadoId ? 'ASIGNADO' : 'DISPONIBLE', empleadoId })
          .returning({ id: equipos.id });
        if (empleadoId) {
          await tx.insert(asignaciones).values({ equipoId: r.id, empleadoId, fechaEntrega, notas: 'Importado del Excel', entregadoPorId: usuarioId });
        }
      }
      await this.bitacora.registrar(
        { usuarioId, accion: `Importó desde Excel ${a.empleadosNuevos.length} empleados y ${a.equipos.length} equipos`, entidad: 'equipo', detalle: { omitidos: a.omitidos.length } },
        tx,
      );
    });
    return this.resumen(a);
  }

  /** Genera el Excel con el formato original más una hoja con todos los equipos. */
  async exportar(): Promise<Buffer> {
    const emps = await this.db.query.empleados.findMany({
      where: eq(empleados.activo, true),
      orderBy: [asc(empleados.nombre)],
      with: { departamento: true, equiposActuales: true },
    });
    const todos = await this.db.query.equipos.findMany({
      orderBy: [asc(equipos.tipo), asc(equipos.marca)],
      with: { empleado: { with: { departamento: true } } },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Inventario de equipos';
    const h = wb.addWorksheet('Inventario', { views: [{ state: 'frozen', ySplit: 2 }] });
    const grupos: [string, number, number][] = [
      ['USUARIOS', 1, 2], ['CARACTERÍSTICAS DE LAPTOP', 3, 10], ['TECLADO', 11, 14], ['MOUSE', 15, 18],
      ['MONITOR', 19, 22], ['ADAPTADORES', 23, 24], ['MULTIFUNCIONALES Y APS', 25, 29],
    ];
    const columnas = ['USUARIO', 'DEPARTAMENTO', 'MARCA', 'MODELO', 'SERIE', 'MEMORIA GB', 'PROCESADOR', 'TAMAÑO DISCO GB/TB', 'SO', 'COLOR',
      'MARCA', 'MODELO', 'SERIE', 'COLOR', 'MARCA', 'MODELO', 'SERIE', 'COLOR', 'MARCA', 'MODELO', 'SERIE', 'COLOR',
      'RED', 'MULTIPUERTOS', 'EQUIPO', 'MARCA', 'MODELO', 'SERIE', 'IP DE GESTIÓN', 'STATUS', 'FECHA DE ENTREGA'];
    grupos.forEach(([t, a, b]) => { h.mergeCells(1, a, 1, b); h.getCell(1, a).value = t; });
    h.getRow(2).values = columnas;
    [1, 2].forEach((n) => { h.getRow(n).font = { bold: true }; h.getRow(n).alignment = { horizontal: 'center' }; });
    h.columns.forEach((c, i) => (c.width = i < 2 ? 30 : 14));

    const fechaAsig = new Map<number, string | null>();
    (await this.db.query.asignaciones.findMany({ where: (t, { isNull }) => isNull(t.fechaDevolucion) })).forEach((a) => fechaAsig.set(a.equipoId, a.fechaEntrega));
    const v = (s?: string | null) => s ?? '';
    const cuatro = (e?: (typeof todos)[number]) => (e ? [v(e.marca), v(e.modelo), v(e.serie), v(e.color)] : ['', '', '', '']);
    const adap = (e?: (typeof todos)[number]) => (e ? [e.marca, e.modelo, e.serie].filter(Boolean).join(' ') || 'SI' : '');

    for (const emp of emps) {
      const mios = emp.equiposActuales;
      const de = (f: (e: (typeof mios)[number]) => boolean) => mios.filter(f) as (typeof todos)[number][];
      const L = de((e) => e.tipo === 'LAPTOP'), T = de((e) => e.tipo === 'TECLADO'), M = de((e) => e.tipo === 'MOUSE'), Mo = de((e) => e.tipo === 'MONITOR');
      const AR = de((e) => e.tipo === 'ADAPTADOR' && e.tipoAdaptador !== 'MULTIPUERTOS'), AM = de((e) => e.tipo === 'ADAPTADOR' && e.tipoAdaptador === 'MULTIPUERTOS');
      const MF = de((e) => ['MULTIFUNCIONAL', 'SOPORTE', 'ACCESS_POINT', 'OTRO'].includes(e.tipo));
      const n = Math.max(1, L.length, T.length, M.length, Mo.length, AR.length, AM.length, MF.length);
      for (let i = 0; i < n; i++) {
        const l = L[i], mf = MF[i];
        const primero = [l, T[i], M[i], Mo[i], AR[i], AM[i], mf].find(Boolean);
        const f = primero ? fechaAsig.get(primero.id) : null;
        h.addRow([
          emp.nombre, v(emp.departamento?.nombre),
          ...(l ? [v(l.marca), v(l.modelo), v(l.serie), v(l.memoriaGb), v(l.procesador), v(l.disco), v(l.sistemaOperativo), v(l.color)] : Array(8).fill('')),
          ...cuatro(T[i]), ...cuatro(M[i]), ...cuatro(Mo[i]), adap(AR[i]), adap(AM[i]),
          ...(mf ? [mf.descripcion || TIPOS_ES[mf.tipo], v(mf.marca), v(mf.modelo), v(mf.serie), v(mf.ipGestion)] : Array(5).fill('')),
          primero ? primero.estatus : 'SIN EQUIPO',
          f ? new Date(`${f}T12:00:00`) : '',
        ]);
      }
    }
    h.getColumn(31).numFmt = 'dd/mm/yyyy';

    const p = wb.addWorksheet('Equipos', { views: [{ state: 'frozen', ySplit: 1 }] });
    p.columns = [
      ['Id', 'id', 7], ['Tipo', 'tipo', 14], ['Área', 'ambito', 20], ['Descripción', 'descripcion', 24], ['Marca', 'marca', 14], ['Modelo', 'modelo', 20], ['Serie', 'serie', 18],
      ['Código de barras', 'codigo', 18], ['Color', 'color', 10], ['Memoria GB', 'memoria', 11], ['Procesador', 'procesador', 22], ['Disco', 'disco', 10],
      ['SO', 'so', 18], ['Tipo de adaptador', 'adaptador', 14], ['IP de gestión', 'ip', 14], ['Estatus', 'estatus', 14], ['Empleado', 'empleado', 30],
      ['Departamento', 'depto', 18], ['Notas', 'notas', 50],
    ].map(([header, key, width]) => ({ header: header as string, key: key as string, width: width as number }));
    p.getRow(1).font = { bold: true };
    for (const e of todos) {
      p.addRow({
        id: e.id, tipo: TIPOS_ES[e.tipo] ?? e.tipo, ambito: e.ambito === 'USUARIO' ? 'Usuario' : 'Infraestructura',
        descripcion: e.descripcion, marca: e.marca, modelo: e.modelo, serie: e.serie, codigo: e.codigoBarras,
        color: e.color, memoria: e.memoriaGb, procesador: e.procesador, disco: e.disco, so: e.sistemaOperativo, adaptador: e.tipoAdaptador,
        ip: e.ipGestion, estatus: e.estatus, empleado: e.empleado?.nombre, depto: e.empleado?.departamento?.nombre, notas: e.notas,
      });
    }
    p.autoFilter = { from: 'A1', to: 'S1' };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
