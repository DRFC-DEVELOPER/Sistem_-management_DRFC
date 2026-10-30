import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

/** Carga datos de la API; `recargar` sirve para el gesto de jalar hacia abajo. */
export function useCarga<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const turno = useRef(0);

  const recargar = useCallback(async () => {
    const mio = ++turno.current;
    setCargando(true);
    try {
      const d = await fn();
      if (mio === turno.current) { setDatos(d); setError(null); }
    } catch (e) {
      if (mio === turno.current) setError((e as Error).message);
    } finally {
      if (mio === turno.current) setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { recargar(); }, [recargar]);
  return { datos, error, cargando, recargar };
}
