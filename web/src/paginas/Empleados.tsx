import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api';
import { useCarga, useRetraso } from '../usar';
import { useSesion } from '../sesion';
import { EmpleadoListado, iniciales, Ref } from '../tipos';
import { BUSCAR, Cargando, ErrorCarga, Vacio } from '../ui';
import EmpleadoForm from './EmpleadoForm';

export default function Empleados() {
  const { puedeEditar } = useSesion();
  const navegar = useNavigate();
  const [p, setP] = useSearchParams();
  const [texto, setTexto] = useState('');
  const q = useRetraso(texto);
  const [depto, setDepto] = useState('');
  const [inactivos, setInactivos] = useState(false);
  const deptos = useCarga(() => api<Ref[]>('/departamentos'), []);
  const { datos, error, recargar } = useCarga(
    () => api<EmpleadoListado[]>(`/empleados${qs({ q, departamentoId: depto, incluirInactivos: inactivos })}`),
    [q, depto, inactivos],
  );

  return (
    <>
      <div className="encabezado">
        <h1>Empleados</h1>
        {puedeEditar && <button className="btn" onClick={() => setP({ nuevo: '1' })}>Dar de alta empleado</button>}
      </div>
      <div className="barra">
        <label className="buscar crece">{BUSCAR}
          <input className="entrada" type="search" placeholder="Buscar por nombre, número o correo" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar empleados" />
        </label>
        <select className="entrada" value={depto} onChange={(e) => setDepto(e.target.value)} aria-label="Departamento">
          <option value="">Todos los departamentos</option>
          {(deptos.datos ?? []).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        <label className="casilla"><input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} /> Mostrar dados de baja</label>
      </div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : (
        <>
          <p className="conteo">{datos.length} {datos.length === 1 ? 'empleado' : 'empleados'}</p>
          {datos.length ? (
            <div className="lista dos">
              {datos.map((e) => (
                <Link key={e.id} to={`/empleados/${e.id}`} className={`persona${e.activo ? '' : ' inactivo'}`}>
                  <span className="av">{iniciales(e.nombre)}</span>
                  <span><b>{e.nombre}</b><span className="sub">{e.departamento?.nombre ?? 'Sin departamento'}{e.activo ? '' : ' (dado de baja)'}</span></span>
                  <span className="sub">{e.equiposAsignados} {e.equiposAsignados === 1 ? 'equipo' : 'equipos'}</span>
                </Link>
              ))}
            </div>
          ) : <Vacio titulo="Ningún empleado coincide">Prueba con otra búsqueda o cambia el departamento.</Vacio>}
        </>
      )}
      {p.get('nuevo') && <EmpleadoForm onCerrar={() => setP({})} onGuardado={(e) => navegar(`/empleados/${e.id}`)} />}
    </>
  );
}
