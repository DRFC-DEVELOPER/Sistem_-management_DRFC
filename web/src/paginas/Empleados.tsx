import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api';
import { useCarga, useRetraso } from '../usar';
import { useSesion } from '../sesion';
import { EmpleadoListado, iniciales, ORDENES, Ref } from '../tipos';
import { BUSCAR, Cargando, ErrorCarga, Vacio } from '../ui';
import EmpleadoForm from './EmpleadoForm';

export default function Empleados() {
  const { puedeEditar } = useSesion();
  const navegar = useNavigate();
  const [p, setP] = useSearchParams();
  const texto = p.get('q') ?? '';
  const q = useRetraso(texto);
  const [depto, setDepto] = useState('');
  const [inactivos, setInactivos] = useState(false);
  const [orden, setOrden] = useState('');
  const cambiarBusqueda = (valor: string) => {
    const parametros = new URLSearchParams(p);
    if (valor) parametros.set('q', valor); else parametros.delete('q');
    setP(parametros, { replace: true });
  };
  const abrirAlta = () => {
    const parametros = new URLSearchParams(p);
    parametros.set('nuevo', '1');
    setP(parametros);
  };
  const cerrarAlta = () => {
    const parametros = new URLSearchParams(p);
    parametros.delete('nuevo');
    setP(parametros);
  };
  const deptos = useCarga(() => api<Ref[]>('/departamentos'), []);
  const { datos, error, recargar } = useCarga(
    () => api<EmpleadoListado[]>(`/empleados${qs({ q, departamentoId: depto, incluirInactivos: inactivos })}`),
    [q, depto, inactivos],
  );
  // La API los regresa en orden alfabético.
  const lista = useMemo(() => {
    if (!datos || !orden) return datos;
    const signo = orden === 'antiguos' ? 1 : -1;
    return [...datos].sort((a, b) => signo * (a.creadoEn.localeCompare(b.creadoEn) || a.id - b.id));
  }, [datos, orden]);

  return (
    <>
      <div className="encabezado">
        <h1>Empleados</h1>
        {puedeEditar && <button className="btn" onClick={abrirAlta}>Dar de alta empleado</button>}
      </div>
      <div className="barra">
        <label className="buscar crece">{BUSCAR}
          <input className="entrada" type="search" placeholder="Buscar por nombre, número o correo" value={texto} onChange={(e) => cambiarBusqueda(e.target.value)} aria-label="Buscar empleados" />
        </label>
        <select className="entrada" value={depto} onChange={(e) => setDepto(e.target.value)} aria-label="Departamento">
          <option value="">Todos los departamentos</option>
          {(deptos.datos ?? []).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <select className="entrada" value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
          <option value="">Alfabético (A–Z)</option>
          {ORDENES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
        <label className="casilla"><input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} /> Mostrar dados de baja</label>
      </div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !lista ? <Cargando /> : (
        <>
          <p className="conteo">{lista.length} {lista.length === 1 ? 'empleado' : 'empleados'}</p>
          {lista.length ? (
            <div className="lista dos">
              {lista.map((e) => (
                <Link key={e.id} to={`/empleados/${e.id}`} className={`persona${e.activo ? '' : ' inactivo'}`}>
                  <span className="av">{iniciales(e.nombre)}</span>
                  <span><b>{e.nombre}</b><span className="sub">{e.departamento?.nombre ?? 'Sin departamento'}{e.puesto ? ` | ${e.puesto.nombre}` : ''}{e.activo ? '' : ' (dado de baja)'}</span></span>
                  <span className="sub">{e.equiposAsignados} {e.equiposAsignados === 1 ? 'equipo' : 'equipos'}</span>
                </Link>
              ))}
            </div>
          ) : <Vacio titulo="Ningún empleado coincide">Prueba con otra búsqueda o cambia el departamento.</Vacio>}
        </>
      )}
      {p.get('nuevo') && <EmpleadoForm onCerrar={cerrarAlta} onGuardado={(e) => navegar(`/empleados/${e.id}`)} />}
    </>
  );
}
