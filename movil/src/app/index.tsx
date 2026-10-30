import { Redirect } from 'expo-router';
import { useSesion } from '@/lib/sesion';

/** Manda a cada quien a su pantalla de inicio. */
export default function Inicio() {
  const { usuario } = useSesion();
  if (!usuario) return <Redirect href="/entrar" />;
  if (usuario.debeCambiarPassword) return <Redirect href="/cambiar-clave" />;
  return <Redirect href={usuario.rol === 'EMPLEADO' ? '/empleado' : '/soporte'} />;
}
