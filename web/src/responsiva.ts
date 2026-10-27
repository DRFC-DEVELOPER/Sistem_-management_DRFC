import { descargar } from './api';
import { useEffect, useState } from 'react';

type Confirmar = (opciones: { titulo: string; mensaje: string; boton: string }) => Promise<boolean>;
const CLAVE_COLA = 'inventario.responsivas.cola';
const EVENTO_COLA = 'inventario:responsivas-cola';

export function limpiarNotasResponsiva(notas?: string | null): string {
  return notas
    ?.split('|')
    .map((nota) => nota.trim())
    .filter((nota) => nota.toLocaleLowerCase() !== 'importado del excel')
    .join(' | ') ?? '';
}

export function leerColaResponsivas(): number[] {
  try {
    const datos: unknown = JSON.parse(localStorage.getItem(CLAVE_COLA) ?? '[]');
    return Array.isArray(datos)
      ? [...new Set(datos.filter((id): id is number => Number.isSafeInteger(id) && id > 0))]
      : [];
  } catch {
    return [];
  }
}

function guardarColaResponsivas(ids: number[]) {
  try {
    localStorage.setItem(CLAVE_COLA, JSON.stringify(ids));
    window.dispatchEvent(new Event(EVENTO_COLA));
    return true;
  } catch {
    return false;
  }
}

export function agregarAColaResponsivas(empleadoId: number) {
  const cola = leerColaResponsivas();
  return cola.includes(empleadoId) || guardarColaResponsivas([...cola, empleadoId]);
}

export function quitarDeColaResponsivas(empleadoIds: number[]) {
  const quitar = new Set(empleadoIds);
  return guardarColaResponsivas(leerColaResponsivas().filter((id) => !quitar.has(id)));
}

export function vaciarColaResponsivas() {
  return guardarColaResponsivas([]);
}

export function useColaResponsivas() {
  const [cola, setCola] = useState(leerColaResponsivas);
  useEffect(() => {
    const actualizar = () => setCola(leerColaResponsivas());
    window.addEventListener(EVENTO_COLA, actualizar);
    window.addEventListener('storage', actualizar);
    return () => {
      window.removeEventListener(EVENTO_COLA, actualizar);
      window.removeEventListener('storage', actualizar);
    };
  }, []);
  return cola;
}

export async function ofrecerCartaResponsiva(
  empleadoId: number,
  confirmar: Confirmar,
  avisar: (mensaje: string) => void,
) {
  const generar = await confirmar({
    titulo: 'Generar carta responsiva',
    mensaje: '¿Quieres descargar la carta con los equipos asignados actualmente y el historial de devoluciones?',
    boton: 'Descargar carta',
  });
  if (!generar) return;

  try {
    await descargar(`/excel/responsiva?empleadoId=${empleadoId}`, `carta-responsiva-${empleadoId}.xlsx`);
    avisar('Carta responsiva descargada');
  } catch (error) {
    avisar((error as Error).message);
  }
}
