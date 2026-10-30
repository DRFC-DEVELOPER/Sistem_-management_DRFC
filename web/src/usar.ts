import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

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

const CAMBIO_SOPORTE = 'soporte-cambio';
/** Avisa al contador del menú que cambió algún reporte de falla, para que se actualice sin esperar. */
export const avisarCambioSoporte = () => window.dispatchEvent(new Event(CAMBIO_SOPORTE));

/** Reportes de falla sin cerrar, para el contador del menú. Se consulta cada minuto. */
export function useResumenSoporte(activo: boolean) {
  const [resumen, setResumen] = useState({ pendientes: 0, enAtencion: 0 });
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const leer = () => api<{ pendientes: number; enAtencion: number }>('/reportes-falla/resumen').then((r) => vivo && setResumen(r)).catch(() => {});
    leer();
    const t = setInterval(leer, 60_000);
    window.addEventListener(CAMBIO_SOPORTE, leer);
    return () => { vivo = false; clearInterval(t); window.removeEventListener(CAMBIO_SOPORTE, leer); };
  }, [activo]);
  return resumen;
}
