import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import { api, qs } from './api';
import { EquipoListado, nombreEquipo, Pagina } from './tipos';

// Medidas en milímetros sobre hoja carta.
const MARGEN = 12;
const ALTO_TARJETA = 40;
const SEPARACION = 4;
const ENCABEZADO = 14;

export type OrdenEtiquetas = 'usuario' | 'departamento' | 'recientes';

export interface OpcionesEtiquetas {
  empleadoId?: number;
  departamentoId?: number;
  /** Solo equipos dados de alta desde esta fecha (AAAA-MM-DD). */
  desde?: string;
  orden: OrdenEtiquetas;
  /** Texto bajo el título que dice qué equipos incluye el PDF. */
  descripcion?: string;
  /** Parte del nombre del archivo que identifica el filtro. */
  archivo?: string;
}

async function buscarEquipos(o: OpcionesEtiquetas) {
  const equipos: EquipoListado[] = [];
  for (let pagina = 1; ; pagina++) {
    const r = await api<Pagina<EquipoListado>>(`/equipos${qs({ pagina, limite: 500, empleadoId: o.empleadoId, departamentoId: o.departamentoId })}`);
    equipos.push(...r.datos);
    if (equipos.length >= r.total || !r.datos.length) return equipos;
  }
}

/** Código de barras como PNG; devuelve también su proporción para no deformarlo en el PDF. */
function barrasPng(valor: string) {
  const lienzo = document.createElement('canvas');
  JsBarcode(lienzo, valor, { format: 'CODE128', width: 3, height: 110, margin: 10, fontSize: 26, background: '#ffffff', lineColor: '#000000' });
  return { url: lienzo.toDataURL('image/png'), proporcion: lienzo.height / lienzo.width };
}

// Compara textos dejando los vacíos (sin asignar, sin departamento) al final.
const alFinal = (a: string | undefined, b: string | undefined) => (!a !== !b ? (a ? -1 : 1) : (a ?? '').localeCompare(b ?? '', 'es'));

const ORDEN: Record<OrdenEtiquetas, (a: EquipoListado, b: EquipoListado) => number> = {
  usuario: (a, b) => alFinal(a.empleado?.nombre, b.empleado?.nombre) || a.tipo.localeCompare(b.tipo) || a.id - b.id,
  departamento: (a, b) => alFinal(a.departamento?.nombre, b.departamento?.nombre) || ORDEN.usuario(a, b),
  recientes: (a, b) => b.creadoEn.localeCompare(a.creadoEn) || b.id - a.id,
};

/** Genera y descarga un PDF con el código de barras y el QR de cada equipo, indicando a quién está asignado. */
export async function descargarEtiquetasPdf(o: OpcionesEtiquetas) {
  const [{ jsPDF }, equipos] = await Promise.all([import('jspdf'), buscarEquipos(o)]);
  const desde = o.desde ? new Date(`${o.desde}T00:00:00`) : null;
  const lista = equipos
    .filter((e) => e.codigoBarras && (!desde || new Date(e.creadoEn) >= desde))
    .sort(ORDEN[o.orden]);
  if (!lista.length) throw new Error('No hay equipos que coincidan con lo que elegiste.');

  const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
  const ancho = pdf.internal.pageSize.getWidth();
  const alto = pdf.internal.pageSize.getHeight();
  const porPagina = Math.floor((alto - MARGEN * 2 - ENCABEZADO + SEPARACION) / (ALTO_TARJETA + SEPARACION));
  const hoy = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const anchoTexto = 72;
  const ladoQr = ALTO_TARJETA - 8;

  for (let i = 0; i < lista.length; i++) {
    const e = lista[i];
    const posicion = i % porPagina;
    if (posicion === 0) {
      if (i > 0) pdf.addPage();
      pdf.setFont('helvetica', 'bold').setFontSize(13).setTextColor(0);
      pdf.text('Códigos de barras y QR de equipos', MARGEN, MARGEN + 5);
      pdf.setFont('helvetica', 'normal').setFontSize(9).setTextColor(90);
      pdf.text(`${lista.length} equipos | ${hoy}`, ancho - MARGEN, MARGEN + 5, { align: 'right' });
      if (o.descripcion) pdf.text(pdf.splitTextToSize(o.descripcion, ancho - MARGEN * 2)[0], MARGEN, MARGEN + 10);
    }
    const y = MARGEN + ENCABEZADO + posicion * (ALTO_TARJETA + SEPARACION);
    pdf.setDrawColor(190).setLineWidth(0.3).roundedRect(MARGEN, y, ancho - MARGEN * 2, ALTO_TARJETA, 2, 2);

    // Datos: a quién pertenece y qué equipo es.
    const x = MARGEN + 4;
    const linea = (texto: string, dy: number) => pdf.text(pdf.splitTextToSize(texto, anchoTexto)[0] ?? '', x, y + dy);
    pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(110);
    linea('USUARIO', 6);
    pdf.setFont('helvetica', 'bold').setFontSize(11).setTextColor(0);
    linea(e.empleado?.nombre ?? 'Sin asignar', 11.5);
    pdf.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(60);
    if (e.departamento) linea(e.departamento.nombre, 16.5);
    pdf.setTextColor(0);
    linea(nombreEquipo(e), 24);
    if (e.serie) linea(`Serie: ${e.serie}`, 29);
    pdf.setFont('courier', 'bold');
    linea(`Código: ${e.codigoBarras}`, 34.5);
    if (o.orden === 'recientes') {
      pdf.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(110);
      pdf.text(`Alta: ${new Date(e.creadoEn).toLocaleDateString('es-MX')}`, MARGEN + 4 + anchoTexto, y + 6, { align: 'right' });
    }

    // Código de barras en el centro y QR a la derecha.
    const xQr = ancho - MARGEN - 4 - ladoQr;
    const xBarras = x + anchoTexto + 4;
    const anchoBarras = xQr - 6 - xBarras;
    try {
      const b = barrasPng(e.codigoBarras!);
      const w = Math.min(anchoBarras, (ALTO_TARJETA - 10) / b.proporcion);
      const h = w * b.proporcion;
      pdf.addImage(b.url, 'PNG', xBarras + (anchoBarras - w) / 2, y + (ALTO_TARJETA - h) / 2, w, h);
    } catch {
      pdf.setFont('courier', 'normal').setFontSize(10).text(e.codigoBarras!, xBarras, y + ALTO_TARJETA / 2);
    }
    const qr = await QRCode.toDataURL(e.codigoBarras!, { errorCorrectionLevel: 'M', margin: 1, width: 400 });
    pdf.addImage(qr, 'PNG', xQr, y + 4, ladoQr, ladoQr);
  }

  const paginas = pdf.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120);
    pdf.text(`Página ${p} de ${paginas}`, ancho / 2, alto - 6, { align: 'center' });
  }
  pdf.save(`codigos-${o.archivo ?? 'equipos'}-${new Date().toISOString().slice(0, 10)}.pdf`);
  return lista.length;
}
