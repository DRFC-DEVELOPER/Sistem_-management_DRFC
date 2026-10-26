import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCarga } from '../usar';
import { ESTATUS, fecha, nombreEquipo, ORDENES, Reparacion } from '../tipos';
import { Cargando, ErrorCarga, Vacio } from '../ui';

export default function Reparaciones() {
  const [abiertas, setAbiertas] = useState(true);
  const [orden, setOrden] = useState('recientes');
  const { datos: cargadas, error, recargar } = useCarga(() => api<Reparacion[]>(`/reparaciones${abiertas ? '?abiertas=true' : ''}`), [abiertas]);
  // La API las regresa de la más reciente a la más antigua.
  const datos = useMemo(() => (cargadas && orden === 'antiguos' ? [...cargadas].reverse() : cargadas), [cargadas, orden]);
  return (
    <>
      <div className="encabezado"><h1>Reparaciones</h1></div>
      <div className="barra">
        <div className="chips" role="group" aria-label="Mostrar">
          <button className="chip" aria-pressed={abiertas} onClick={() => setAbiertas(true)}>Pendientes de regreso</button>
          <button className="chip" aria-pressed={!abiertas} onClick={() => setAbiertas(false)}>Todas</button>
        </div>
        <select className="entrada" value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar">
          {ORDENES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : datos.length ? (
        <section className="panel desliza">
          <table className="tabla">
            <thead><tr><th>Equipo</th><th>Empleado</th><th>Falla</th><th>Proveedor</th><th>Enviado</th><th>Regreso</th></tr></thead>
            <tbody>
              {datos.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/equipos/${r.equipoId}`}>{r.equipo ? nombreEquipo(r.equipo) : 'Equipo'}</Link>{r.equipo?.serie && <><br /><span className="sub mono">{r.equipo.serie}</span></>}</td>
                  <td>{!r.fechaRecepcion && r.equipo?.empleado ? <Link to={`/empleados/${r.equipo.empleado.id}`}><b>{r.equipo.empleado.nombre}</b></Link> : <span className="sub">—</span>}</td>
                  <td>{r.motivo}</td>
                  <td>{r.proveedor ?? '—'}</td>
                  <td>{fecha(r.fechaEnvio)}</td>
                  <td>{r.fechaRecepcion ? <>{fecha(r.fechaRecepcion)}<br /><span className="sub">{ESTATUS[r.resultado ?? 'DISPONIBLE'].nombre}</span></> : <Link to={`/equipos/${r.equipoId}`}>Registrar regreso</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <Vacio titulo={abiertas ? 'No hay equipos en reparación' : 'Sin reparaciones registradas'}>Para enviar uno, abre la ficha del equipo y usa “Enviar a reparación”.</Vacio>
      )}
    </>
  );
}
