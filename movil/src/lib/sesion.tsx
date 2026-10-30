import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { alExpirarSesion, api, token } from './api';
import { quitarDispositivo } from './notificaciones';
import { Usuario } from './tipos';

interface Sesion {
  usuario: Usuario | null;
  cargando: boolean;
  /** Contraseña con la que se entró; se usa para no pedirla otra vez al cambiar la temporal. */
  claveIngresada: string | null;
  entrar: (usuario: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
  cambiarPassword: (actual: string, nueva: string) => Promise<void>;
}

const Ctx = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [claveIngresada, setClaveIngresada] = useState<string | null>(null);

  useEffect(() => {
    alExpirarSesion(() => setUsuario(null));
    token.leer()
      .then((t) => (t ? api<Usuario>('/auth/yo').then(setUsuario) : undefined))
      .catch(() => token.borrar())
      .finally(() => setCargando(false));
    return () => alExpirarSesion(null);
  }, []);

  const entrar = useCallback(async (u: string, password: string) => {
    const r = await api<{ token: string; usuario: Usuario }>('/auth/login', { cuerpo: { usuario: u, password } });
    await token.guardar(r.token);
    setClaveIngresada(r.usuario.debeCambiarPassword ? password : null);
    setUsuario(r.usuario);
  }, []);

  const salir = useCallback(async () => {
    // Antes de borrar el token, para que la API sepa de qué cuenta quitar este celular.
    await quitarDispositivo();
    await token.borrar();
    setClaveIngresada(null);
    setUsuario(null);
  }, []);

  const cambiarPassword = useCallback(async (actual: string, nueva: string) => {
    await api('/auth/password', { metodo: 'PATCH', cuerpo: { actual, nueva } });
    setClaveIngresada(null);
    setUsuario((u) => (u ? { ...u, debeCambiarPassword: false } : u));
  }, []);

  return <Ctx.Provider value={{ usuario, cargando, claveIngresada, entrar, salir, cambiarPassword }}>{children}</Ctx.Provider>;
}

export const useSesion = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSesion fuera de ProveedorSesion');
  return s;
};
