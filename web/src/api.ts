const CLAVE = 'inventario.token';
const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export class ErrorApi extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje);
  }
}

export const token = {
  leer: () => { try { return localStorage.getItem(CLAVE); } catch { return null; } },
  guardar: (t: string) => { try { localStorage.setItem(CLAVE, t); } catch { /* sin almacenamiento */ } },
  borrar: () => { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } },
};

interface Opciones { metodo?: string; cuerpo?: unknown; formulario?: FormData }

async function peticion(ruta: string, o: Opciones = {}) {
  const headers: Record<string, string> = {};
  const t = token.leer();
  if (t) headers.Authorization = `Bearer ${t}`;
  if (o.cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${ruta}`, {
      method: o.metodo ?? (o.cuerpo !== undefined || o.formulario ? 'POST' : 'GET'),
      headers,
      body: o.formulario ?? (o.cuerpo !== undefined ? JSON.stringify(o.cuerpo) : undefined),
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Revisa que la API esté corriendo.');
  }
  if (res.status === 401 && t) {
    token.borrar();
    window.dispatchEvent(new Event('sesion-expirada'));
  }
  if (!res.ok) {
    let mensaje = `Error ${res.status}`;
    try {
      const j = await res.json();
      mensaje = Array.isArray(j.message) ? j.message.join(' ') : j.message || mensaje;
    } catch { /* respuesta sin JSON */ }
    throw new ErrorApi(res.status, mensaje);
  }
  return res;
}

export async function api<T>(ruta: string, o: Opciones = {}): Promise<T> {
  const res = await peticion(ruta, o);
  if (res.status === 204) return undefined as T;
  // Nest manda el cuerpo vacío cuando la ruta devuelve null (por ejemplo, un empleado sin acceso a la app).
  const texto = await res.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

/** Descarga un archivo de la API y lo guarda en la computadora. */
export async function descargar(ruta: string, nombrePorDefecto: string) {
  const res = await peticion(ruta);
  const nombre = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? nombrePorDefecto;
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const qs = (p: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '' && v !== false) s.set(k, String(v)); });
  const t = s.toString();
  return t ? `?${t}` : '';
};
