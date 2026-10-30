import * as SecureStore from 'expo-secure-store';

// Se define en movil/.env (ver .env.example). Expo la incrusta al compilar.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

const CLAVE_TOKEN = 'inventario.token';

/** El token se guarda cifrado en el teléfono (Keychain / Keystore). */
export const token = {
  leer: () => SecureStore.getItemAsync(CLAVE_TOKEN),
  guardar: (t: string) => SecureStore.setItemAsync(CLAVE_TOKEN, t),
  borrar: () => SecureStore.deleteItemAsync(CLAVE_TOKEN),
};

export class ErrorApi extends Error {
  constructor(public estatus: number, mensaje: string) {
    super(mensaje);
  }
}

// La sesión avisa aquí cuando el servidor rechaza el token (expiró o se desactivó la cuenta).
let alExpirar: (() => void) | null = null;
export const alExpirarSesion = (fn: (() => void) | null) => { alExpirar = fn; };

export async function api<T>(ruta: string, o: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  if (!API_URL) throw new ErrorApi(0, 'Falta configurar EXPO_PUBLIC_API_URL en movil/.env.');
  const t = await token.leer();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (t) headers.Authorization = `Bearer ${t}`;
  if (o.cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_URL}${ruta}`, {
      method: o.metodo ?? (o.cuerpo !== undefined ? 'POST' : 'GET'),
      headers,
      body: o.cuerpo !== undefined ? JSON.stringify(o.cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Revisa que estés en la misma red y que la API esté encendida.');
  }
  if (res.status === 401 && t) {
    await token.borrar();
    alExpirar?.();
  }
  const texto = await res.text();
  const json = texto ? JSON.parse(texto) : null;
  if (!res.ok) {
    const m = json?.message;
    throw new ErrorApi(res.status, (Array.isArray(m) ? m.join(' ') : m) || `Error ${res.status}`);
  }
  return json as T;
}
