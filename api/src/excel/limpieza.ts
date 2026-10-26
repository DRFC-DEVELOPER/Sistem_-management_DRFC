// Reglas para limpiar los datos que vienen del Excel de inventario.
import { TipoEquipo } from '../db/esquema';

const VACIOS = new Set(['', 'NA', 'N/A', 'NO', 'NO TIENE', 'NIO TIENE', 'SN', 'S/N', '-', '0', 'NONE']);
export const NO_ES_USUARIO = new Set(['SIN USUARIO', 'QUIEN LA TIENE', 'STOCK', 'STPCK POR FER PERALTA']);
const PROPIO = /^(PERSONAL|PROPIO)$/i;
const MARCAS: Record<string, string> = {
  ACTEK: 'ACTECK', ACTEVK: 'ACTECK', ACTC: 'ACTECK', 'ACTC USB': 'ACTECK', HACER: 'ACER', 'LENOV O': 'LENOVO',
  THINKPAD: 'LENOVO', THINKVISION: 'LENOVO', 'LENOVO THINKPAD': 'LENOVO', PERFECTCHOISE: 'PERFECT CHOICE',
};
const COLORES: Record<string, string> = { NEGRI: 'NEGRO', NOGRO: 'NEGRO', NRGRO: 'NEGRO', NEGR: 'NEGRO', NEGRO0: 'NEGRO', NEGRA: 'NEGRO' };

export const texto = (v: unknown): string => {
  if (v === null || v === undefined || v instanceof Date) return '';
  if (typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (o.richText) return texto(o.richText.map((r) => r.text).join(''));
    if ('result' in o) return texto(o.result);
    if (o.text) return texto(o.text);
    return '';
  }
  return String(v).replace(/\s+/g, ' ').trim();
};
export const dato = (v: unknown) => {
  const t = texto(v);
  return VACIOS.has(t.toUpperCase()) ? '' : t;
};
export const esPropio = (v: unknown) => PROPIO.test(dato(v));
export const marca = (v: unknown) => {
  const t = dato(v).toUpperCase();
  return MARCAS[t] ?? t;
};
export const color = (v: unknown) => {
  const t = dato(v).toUpperCase();
  return COLORES[t] ?? t;
};
export const memoria = (v: unknown) => {
  const t = dato(v);
  const m = t.match(/^([\d.]+)\s*(GB?)?$/i);
  if (!m) return t;
  const n = parseFloat(m[1]);
  return Number.isInteger(n) ? String(n) : String(n);
};
export const disco = (v: unknown) => {
  if (typeof v === 'number') return v <= 4 ? `${v} TB` : `${v} GB`;
  const t = dato(v).toUpperCase();
  const m = t.match(/^([\d.]+)\s*(GB|TB)?$/);
  return m ? `${m[1]} ${m[2] ?? 'GB'}` : t;
};
export const sistema = (v: unknown) => dato(v).toUpperCase().replace('WINDOS 10 LTCS', 'WINDOWS 10 LTSC').replace('WINDOWS10', 'WINDOWS 10');

export function fecha(v: unknown): string | null {
  const dos = (n: number) => String(n).padStart(2, '0');
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getUTCFullYear()}-${dos(v.getUTCMonth() + 1)}-${dos(v.getUTCDate())}`;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    return fecha(d);
  }
  const t = texto(v);
  let m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${dos(+m[2])}-${dos(+m[1])}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[0] : null;
}

export const tipoMultifuncional = (equipo: string): TipoEquipo =>
  /SOPORTE/i.test(equipo) ? 'SOPORTE' : /\bAP\b|ACCESS|WIFI/i.test(equipo) ? 'ACCESS_POINT' : 'MULTIFUNCIONAL';
