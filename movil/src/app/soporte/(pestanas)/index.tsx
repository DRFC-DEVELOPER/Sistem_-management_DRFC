import { Pantalla, Sub, Tarjeta, Titulo } from '@/componentes/ui';
import { useSesion } from '@/lib/sesion';

/** Inicio del personal. El contenido aún está por definirse. */
export default function InicioSoporte() {
  const { usuario } = useSesion();
  return (
    <Pantalla>
      <Tarjeta>
        <Titulo>Hola, {usuario?.nombre.split(' ')[0]}</Titulo>
        <Sub>Esta sección está en diseño. Mientras tanto, usa el escáner o revisa las solicitudes de soporte desde la barra de abajo.</Sub>
      </Tarjeta>
    </Pantalla>
  );
}
