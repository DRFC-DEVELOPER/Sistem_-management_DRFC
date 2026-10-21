import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';

/** Carga datos de la API y vuelve a cargarlos cuando cambian las dependencias. */
export function useCarga<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const turno = useRef(0);

  const recargar = useCallback(() => {
    const mio = ++turno.current;
    setCargando(true);
    fn()
      .then((d) => { if (mio === turno.current) { setDatos(d); setError(null); } })
      .catch((e: Error) => { if (mio === turno.current) setError(e.message); })
      .finally(() => { if (mio === turno.current) setCargando(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { recargar(); }, [recargar]);
  return { datos, error, cargando, recargar };
}

/** Devuelve el valor después de una pausa sin cambios (para búsquedas al escribir). */
export function useRetraso<T>(valor: T, ms = 250) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}
