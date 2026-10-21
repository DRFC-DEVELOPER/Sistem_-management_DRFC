import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useSesion } from './sesion';
import { iniciales, ROLES } from './tipos';
import { Cargando } from './ui';
import Acceso from './paginas/Acceso';
import Resumen from './paginas/Resumen';
import Equipos from './paginas/Equipos';
import EquipoPagina from './paginas/Equipo';
import Empleados from './paginas/Empleados';
import EmpleadoPagina from './paginas/Empleado';
import Reparaciones from './paginas/Reparaciones';
import Excel from './paginas/Excel';
import Usuarios from './paginas/Usuarios';
import Bitacora from './paginas/Bitacora';
import CambiarPassword from './paginas/CambiarPassword';

const LOGO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M2 20h20M7 8v4M10 8v4M13 8v4M16 8v4" />
  </svg>
);
export const Marca = () => <span className="marca">{LOGO}<b>Inventario</b></span>;

function Cuenta() {
  const { usuario, salir } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => { if (!ref.current?.contains(ev.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);
  if (!usuario) return null;
  return (
    <div className="cuenta" ref={ref}>
      <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto}>
        <span className="av">{iniciales(usuario.nombre)}</span>
        <span className="nombre">{usuario.nombre}</span>
      </button>
      {abierto && (
        <div className="menu">
          <p><b>{usuario.nombre}</b><br /><span className="sub">{usuario.correo} | {ROLES[usuario.rol]}</span></p>
          <button onClick={() => { setAbierto(false); setClave(true); }}>Cambiar contraseña</button>
          <button onClick={salir}>Cerrar sesión</button>
        </div>
      )}
      {clave && <CambiarPassword onCerrar={() => setClave(false)} />}
    </div>
  );
}

export default function App() {
  const { usuario, cargando, esAdmin } = useSesion();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  if (cargando) return <main><Cargando /></main>;
  if (!usuario) return <Acceso />;

  return (
    <>
      <header className="cabecera">
        <div className="cabecera-in">
          <Link to="/" style={{ textDecoration: 'none' }}><Marca /></Link>
          <nav className="nav" aria-label="Secciones">
            <NavLink to="/" end>Resumen</NavLink>
            <NavLink to="/equipos">Equipos</NavLink>
            <NavLink to="/empleados">Empleados</NavLink>
            <NavLink to="/reparaciones">Reparaciones</NavLink>
            <NavLink to="/excel">Excel</NavLink>
            {esAdmin && <NavLink to="/usuarios">Usuarios</NavLink>}
            {esAdmin && <NavLink to="/bitacora">Bitácora</NavLink>}
          </nav>
          <Cuenta />
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Resumen />} />
          <Route path="/equipos" element={<Equipos />} />
          <Route path="/equipos/:id" element={<EquipoPagina />} />
          <Route path="/empleados" element={<Empleados />} />
          <Route path="/empleados/:id" element={<EmpleadoPagina />} />
          <Route path="/reparaciones" element={<Reparaciones />} />
          <Route path="/excel" element={<Excel />} />
          {esAdmin && <Route path="/usuarios" element={<Usuarios />} />}
          {esAdmin && <Route path="/bitacora" element={<Bitacora />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
