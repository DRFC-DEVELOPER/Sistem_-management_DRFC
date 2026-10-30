import { FormEvent, ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from './api';
import { useSesion } from './sesion';
import { useResumenSoporte } from './usar';
import { iniciales, ROLES, Usuario } from './tipos';
import { Campo, Cargando, FormModal, useAvisos } from './ui';
import Acceso from './paginas/Acceso';
import Resumen from './paginas/Resumen';
import Equipos from './paginas/Equipos';
import EquipoPagina from './paginas/Equipo';
import Empleados from './paginas/Empleados';
import EmpleadoPagina from './paginas/Empleado';
import Reparaciones from './paginas/Reparaciones';
import Soporte from './paginas/Soporte';
import Excel from './paginas/Excel';
import Usuarios from './paginas/Usuarios';
import Altas from './paginas/Altas';
import Bitacora from './paginas/Bitacora';
import CambiarPassword from './paginas/CambiarPassword';

const LOGO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M2 20h20M7 8v4M10 8v4M13 8v4M16 8v4" />
  </svg>
);
export const Marca = () => <span className="marca">{LOGO}<b>Inventario</b></span>;

const trazo = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

// Secciones del menú lateral; `admin` las muestra solo a administradores.
const SECCIONES: { ruta: string; nombre: string; admin?: boolean; icono: ReactNode }[] = [
  { ruta: '/', nombre: 'Inicio', icono: <svg {...trazo}><path d="M3.5 11 12 3.5l8.5 7.5" /><path d="M5.5 9.5V20h4.5v-5.5h4V20h4.5V9.5" /></svg> },
  { ruta: '/empleados', nombre: 'Empleados', icono: <svg {...trazo}><rect x="2.5" y="7" width="19" height="13" rx="2" /><path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2M2.5 12.5h19M10.5 11.5v2h3v-2" /></svg> },
  { ruta: '/equipos', nombre: 'Equipos', icono: <svg {...trazo}><rect x="5" y="3" width="15" height="10.5" rx="1" /><path d="M3 16h17M9 6.5l-1.5 1.5M13 6l-4 4" /><rect x="2.5" y="12" width="6" height="9" rx="1" /><path d="M5 19h1" /></svg> },
  { ruta: '/reparaciones', nombre: 'Reparaciones', icono: <svg {...trazo}><rect x="3" y="3" width="16" height="12" rx="1" /><path d="M8 19h6M11 15v4" /><path d="M11 6.5 8.5 11h5z" /><path d="m15.5 14.5 5 5a1.4 1.4 0 0 1-2 2l-5-5" /></svg> },
  { ruta: '/soporte', nombre: 'Soporte', icono: <svg {...trazo}><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><rect x="2.5" y="13" width="4" height="6" rx="1.5" /><rect x="17.5" y="13" width="4" height="6" rx="1.5" /><path d="M19.5 19v.5a2.5 2.5 0 0 1-2.5 2.5h-3.5" /></svg> },
  { ruta: '/excel', nombre: 'Generar', icono: <svg {...trazo}><path d="M7 18H6a4 4 0 0 1-.5-8A6 6 0 0 1 17 8.5a4.5 4.5 0 0 1 1 9h-1" /><path d="M12 21v-9M8.5 15 12 11.5l3.5 3.5" /></svg> },
  { ruta: '/bitacora', nombre: 'Bitacora', admin: true, icono: <svg {...trazo}><path d="M15 4.5h2.5a1 1 0 0 1 1 1V12M8.5 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h6" /><rect x="8.5" y="3" width="6.5" height="3" rx="1" /><path d="M8 10h7M8 13.5h4" /><circle cx="17" cy="18" r="4" /><path d="m15.3 18 1.2 1.2 2.2-2.4" /></svg> },
  { ruta: '/usuarios', nombre: 'Usuarios', admin: true, icono: <svg {...trazo}><path d="M12 2.5 4 5.5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10v-6z" /><circle cx="12" cy="10" r="2.5" /><path d="M8 16.5c.8-1.7 2.2-2.5 4-2.5s3.2.8 4 2.5" /></svg> },
  { ruta: '/altas', nombre: 'Altas', admin: true, icono: <svg {...trazo}><path d="M3 21h18M5 21V5l7-3 7 3v16M9 8h1M14 8h1M9 12h1M14 12h1M10 21v-5h4v5" /></svg> },
];

const BUSCAR = <svg viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth={2.6} strokeLinecap="round" aria-hidden width="20" height="20"><circle cx="10" cy="10" r="6.5" /><path d="m15 15 6 6" /></svg>;
const CAMPANA = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden width="38" height="38"><path d="M12 2a1.6 1.6 0 0 1 1.6 1.6v.6A6.5 6.5 0 0 1 18.5 10.5v4.2l1.8 2.4a.8.8 0 0 1-.6 1.3H4.3a.8.8 0 0 1-.6-1.3l1.8-2.4v-4.2a6.5 6.5 0 0 1 4.9-6.3v-.6A1.6 1.6 0 0 1 12 2M9.5 19.6h5a2.5 2.5 0 0 1-5 0" /></svg>;
const MENU = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden width="24" height="24"><path d="M4 6h16M4 12h16M4 18h16" /></svg>;

/** Perfil del usuario con acceso a su cuenta, edición de datos y cambio de contraseña. */
function Perfil() {
  const { usuario, actualizarUsuario } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState(false);
  const [editar, setEditar] = useState(false);
  // Animación de perfil en web/public/GIF_IA.mp4 (debe ser H.264 para que la reproduzca cualquier navegador).
  // Si no se puede cargar se muestran las iniciales.
  const [sinGif, setSinGif] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (ev: MouseEvent) => { if (!ref.current?.contains(ev.target as Node)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);
  if (!usuario) return null;
  return (
    <div className="perfil" ref={ref}>
      <button className="perfil__boton" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-label="Mi cuenta">
        <span className="perfil__foto">
          {sinGif ? iniciales(usuario.nombre) : <video src="/GIF_IA.mp4" autoPlay loop muted playsInline aria-hidden onError={() => setSinGif(true)} />}
        </span>
      </button>
      <div className="perfil__identidad">
        <button className="perfil__boton perfil__texto" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} aria-label="Mi cuenta">
          <span className="perfil__rol">{ROLES[usuario.rol]}</span>
          <span className="perfil__nombre">{usuario.nombre}</span>
        </button>
        {usuario.rol === 'ADMIN' && (
          <button className="perfil__editar" onClick={() => { setAbierto(false); setEditar(true); }} aria-label="Editar mi usuario" title="Editar mi usuario">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m14 5 5 5M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16 4 20z" />
            </svg>
          </button>
        )}
      </div>
      {abierto && (
        <div className="menu">
          <p><b>{usuario.nombre}</b><br /><span className="sub">{usuario.usuario} | {ROLES[usuario.rol]}</span></p>
          <button onClick={() => { setAbierto(false); setClave(true); }}>Cambiar contraseña</button>
        </div>
      )}
      {clave && <CambiarPassword onCerrar={() => setClave(false)} />}
      {editar && <EditarPerfil onCerrar={() => setEditar(false)} onGuardado={(actualizado) => { actualizarUsuario(actualizado); setEditar(false); }} />}
    </div>
  );
}

function EditarPerfil({ onCerrar, onGuardado }: { onCerrar: () => void; onGuardado: (usuario: Usuario) => void }) {
  const { usuario } = useSesion();
  const { avisar } = useAvisos();
  const [nombre, setNombre] = useState(usuario?.nombre ?? '');
  const [nombreUsuario, setNombreUsuario] = useState(usuario?.usuario ?? '');
  const [correo, setCorreo] = useState(usuario?.correo ?? '');
  if (!usuario) return null;
  return (
    <FormModal titulo="Editar mi usuario" boton="Guardar cambios" onCerrar={onCerrar} onEnviar={async () => {
      const actualizado = await api<Usuario>(`/usuarios-sistema/${usuario.id}`, {
        metodo: 'PATCH',
        cuerpo: { nombre, usuario: nombreUsuario, correo: correo || null },
      });
      onGuardado(actualizado);
      avisar('Usuario actualizado');
    }}>
      <Campo etiqueta="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" /></Campo>
      <Campo etiqueta="Usuario (para iniciar sesión)"><input value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} autoCapitalize="none" spellCheck={false} autoComplete="username" /></Campo>
      <Campo etiqueta="Correo" opcional><input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} autoComplete="email" /></Campo>
    </FormModal>
  );
}

/** Buscador de la barra superior: un código exacto abre el equipo; cualquier otro texto busca en Equipos. */
function Buscador() {
  const navegar = useNavigate();
  const [texto, setTexto] = useState('');
  const buscar = async (ev: FormEvent) => {
    ev.preventDefault();
    const t = texto.trim();
    if (!t) return;
    try {
      const e = await api<{ id: number }>(`/equipos/codigo/${encodeURIComponent(t)}`);
      navegar(`/equipos/${e.id}`);
    } catch {
      navegar(`/equipos?q=${encodeURIComponent(t)}`);
    }
    setTexto('');
  };
  return (
    <form className="search" role="search" onSubmit={buscar}>
      <input type="search" placeholder="Buscar" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar equipo por código, serie, marca o empleado" />
      <button type="submit" aria-label="Buscar">{BUSCAR}</button>
    </form>
  );
}

// Al buscar desde la barra superior cambia ?q=, y la lista de equipos se vuelve a montar con ese texto.
function EquiposConBusqueda() {
  const [p] = useSearchParams();
  return <Equipos key={p.get('q') ?? ''} />;
}

/** Opciones del menú; la pestaña gris se desliza hasta la opción activa al cambiar de pantalla. */
function MenuSecciones({ esAdmin, pendientes }: { esAdmin: boolean; pendientes: number }) {
  const { pathname } = useLocation();
  const nav = useRef<HTMLElement>(null);
  const [marca, setMarca] = useState<{ top: number; height: number; animar: boolean } | null>(null);

  useLayoutEffect(() => {
    const ubicar = (animar: boolean) => {
      const activo = nav.current?.querySelector<HTMLElement>('a.active');
      // Sin opción activa no hay pestaña; la primera vez aparece en su lugar sin deslizarse.
      setMarca((antes) => (activo ? { top: activo.offsetTop, height: activo.offsetHeight, animar: animar && !!antes } : null));
    };
    ubicar(true);
    // Si cambia el tamaño del menú (fuentes cargadas, ventana), se reacomoda sin animación.
    const obs = new ResizeObserver(() => ubicar(false));
    if (nav.current) obs.observe(nav.current);
    return () => obs.disconnect();
  }, [pathname, esAdmin]);

  return (
    <nav className="sidebar__nav" aria-label="Secciones" ref={nav}>
      {marca && <span className={`sidebar__indicador${marca.animar ? ' anima' : ''}`} style={{ top: marca.top, height: marca.height }} aria-hidden />}
      {SECCIONES.filter((s) => !s.admin || esAdmin).map((s) => (
        <NavLink key={s.ruta} to={s.ruta} end={s.ruta === '/'}>
          {s.icono}<span>{s.nombre}</span>
          {s.ruta === '/soporte' && pendientes > 0 && <span className="contador" aria-label={`${pendientes} sin atender`}>{pendientes}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const { usuario, cargando, esAdmin, salir } = useSesion();
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { pendientes } = useResumenSoporte(!!usuario);
  useEffect(() => { window.scrollTo(0, 0); setMenuAbierto(false); }, [pathname]);

  if (cargando) return <main className="content"><Cargando /></main>;
  if (!usuario) return <Acceso />;

  return (
    <div className="layout">
      <aside className={`sidebar${menuAbierto ? ' abierto' : ''}`}>
        <Perfil />
        <MenuSecciones esAdmin={esAdmin} pendientes={pendientes} />
        <button className="sidebar__salir" onClick={salir}>cerrar sesión</button>
      </aside>
      {menuAbierto && <div className="sidebar__velo" onClick={() => setMenuAbierto(false)} />}
      <div className="main">
        <header className="topbar">
          <div className="topbar__left">
            <button className="topbar__menu" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">{MENU}</button>
            <h1>Bienvenido, {usuario.nombre.split(' ')[0]}!</h1>
          </div>
          <div className="topbar__right">
            <Buscador />
            <Link className="bell" to="/soporte" title="Solicitudes de soporte" aria-label={pendientes ? `Solicitudes de soporte: ${pendientes} sin atender` : 'Solicitudes de soporte'}>
              {CAMPANA}
              {pendientes > 0 && <span className="contador" aria-hidden>{pendientes > 99 ? '99+' : pendientes}</span>}
            </Link>
          </div>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Resumen />} />
            <Route path="/equipos" element={<EquiposConBusqueda />} />
            <Route path="/equipos/:id" element={<EquipoPagina />} />
            <Route path="/empleados" element={<Empleados />} />
            <Route path="/empleados/:id" element={<EmpleadoPagina />} />
            <Route path="/reparaciones" element={<Reparaciones />} />
            <Route path="/soporte" element={<Soporte />} />
            <Route path="/excel" element={<Excel />} />
            {esAdmin && <Route path="/usuarios" element={<Usuarios />} />}
            {esAdmin && <Route path="/altas" element={<Altas />} />}
            {esAdmin && <Route path="/departamentos" element={<Navigate to="/altas" replace />} />}
            {esAdmin && <Route path="/bitacora" element={<Bitacora />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
