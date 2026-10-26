import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api, token } from './api';
import { Usuario } from './tipos';

interface Sesion {
  usuario: Usuario | null;
  cargando: boolean;
  entrar: (usuario: string, password: string) => Promise<void>;
  salir: () => void;
  puedeEditar: boolean;
  esAdmin: boolean;
}

const Ctx = createContext<Sesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(!!token.leer());

  useEffect(() => {
    if (!token.leer()) return;
    api<Usuario>('/auth/yo').then(setUsuario).catch(() => token.borrar()).finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    const fin = () => setUsuario(null);
    window.addEventListener('sesion-expirada', fin);
    return () => window.removeEventListener('sesion-expirada', fin);
  }, []);

  const entrar = useCallback(async (usuario: string, password: string) => {
    const r = await api<{ token: string; usuario: Usuario }>('/auth/login', { cuerpo: { usuario, password } });
    token.guardar(r.token);
    setUsuario(r.usuario);
  }, []);

  const salir = useCallback(() => {
    token.borrar();
    setUsuario(null);
  }, []);

  return (
    <Ctx.Provider value={{ usuario, cargando, entrar, salir, puedeEditar: !!usuario && usuario.rol !== 'CONSULTA', esAdmin: usuario?.rol === 'ADMIN' }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSesion = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSesion fuera de ProveedorSesion');
  return s;
};
