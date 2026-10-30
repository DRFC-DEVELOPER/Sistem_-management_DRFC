import { DependencyList, useCallback, useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { api } from './api';

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

const alCambiarSoporte = new Set<() => void>();
/** Avisa al contador de la barra que cambió algún reporte de falla, para que se actualice sin esperar. */
export const avisarCambioSoporte = () => alCambiarSoporte.forEach((f) => f());

/** Reportes de falla sin cerrar, para el contador de la barra. Se consulta cada minuto y al llegar un aviso. */
export function useResumenSoporte() {
  const [resumen, setResumen] = useState({ pendientes: 0, enAtencion: 0 });
  useEffect(() => {
    let vivo = true;
    const leer = () => { api<{ pendientes: number; enAtencion: number }>('/reportes-falla/resumen').then((r) => vivo && setResumen(r)).catch(() => {}); };
    leer();
    const t = setInterval(leer, 60_000);
    alCambiarSoporte.add(leer);
    const aviso = Notifications.addNotificationReceivedListener(leer);
    return () => { vivo = false; clearInterval(t); alCambiarSoporte.delete(leer); aviso.remove(); };
  }, []);
  return resumen;
}
