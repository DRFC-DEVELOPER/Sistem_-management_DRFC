const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha de hoy 'AAAA-MM-DD' en la zona horaria del servidor (variable TZ). */
export function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Recorta 'AAAA-MM-DD' de una fecha ISO. */
export const aFecha = (v?: string | null) => (v ? v.slice(0, 10) : undefined);

/** Patrón para búsquedas con ILIKE, escapando los comodines. */
export const patron = (q: string) => `%${q.trim().replace(/[\\%_]/g, (m) => '\\' + m)}%`;

/** Quita espacios sobrantes y convierte textos vacíos en null. */
export function limpiar<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() || null : v;
  }
  return out as T;
}

export function paginar(pagina = 1, limite = 50) {
  const l = Math.min(Math.max(limite, 1), 500);
  const p = Math.max(pagina, 1);
  return { offset: (p - 1) * l, limit: l, pagina: p, limite: l };
}
