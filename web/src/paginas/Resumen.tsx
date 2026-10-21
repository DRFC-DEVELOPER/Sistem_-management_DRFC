import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCarga } from '../usar';
import { useSesion } from '../sesion';
import { Asignacion, ESTATUS, Estatus, fecha, nombreEquipo, Tipo, TIPOS } from '../tipos';
import { Cargando, ErrorCarga, Vacio } from '../ui';

interface Resumen { porEstatus: Record<Estatus, number>; porTipo: Record<Tipo, { total: number; disponibles: number }> }

export default function Resumen() {
  const { puedeEditar } = useSesion();
  const r = useCarga(() => api<Resumen>('/equipos/resumen'), []);
  const a = useCarga(() => api<Asignacion[]>('/asignaciones'), []);

  if (r.error) return <ErrorCarga mensaje={r.error} reintentar={r.recargar} />;
  if (!r.datos) return <Cargando />;
  const e = r.datos.porEstatus;
  const activos = e.DISPONIBLE + e.ASIGNADO + e.EN_REPARACION + e.DANADO;
  const estatus: Estatus[] = ['DISPONIBLE', 'ASIGNADO', 'EN_REPARACION', 'DANADO'];
  const ultimas = (a.datos ?? []).slice(0, 8);

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Resumen</h1>
          <p className="sub" style={{ margin: '4px 0 0' }}>{activos} equipos en uso o disponibles, {e.BAJA} dados de baja</p>
        </div>
        {puedeEditar && (
          <div className="acciones">
            <Link className="btn ghost" to="/empleados?nuevo=1">Dar de alta empleado</Link>
            <Link className="btn" to="/equipos?nuevo=1">Registrar equipo</Link>
          </div>
        )}
      </div>

      {activos + e.BAJA === 0 ? (
        <Vacio titulo="El inventario está vacío">Importa tu Excel o registra el primer equipo.<br /><Link className="btn" to="/excel">Importar desde Excel</Link></Vacio>
      ) : (
        <>
          <section className="panel">
            <h2>Estado de los equipos</h2>
            <div className="barra-estatus" aria-hidden>
              {estatus.map((s) => <span key={s} className={ESTATUS[s].clase} style={{ width: `${(e[s] / (activos || 1)) * 100}%` }} />)}
            </div>
            <div className="leyenda">
              {[...estatus, 'BAJA' as Estatus].map((s) => (
                <Link key={s} to={`/equipos?estatus=${s}`}><b>{e[s]}</b><span className={`pill ${ESTATUS[s].clase}`}>{ESTATUS[s].plural}</span></Link>
              ))}
            </div>
          </section>
          <div className="rejilla">
            <section className="panel">
              <h2>Por tipo de equipo</h2>
              <table className="tabla">
                <thead><tr><th>Tipo</th><th className="n">Total</th><th className="n">Disponibles</th></tr></thead>
                <tbody>
                  {(Object.keys(TIPOS) as Tipo[]).filter((t) => r.datos!.porTipo[t]).map((t) => (
                    <tr key={t}>
                      <td><Link to={`/equipos?tipo=${t}`}>{TIPOS[t]}</Link></td>
                      <td className="n">{r.datos!.porTipo[t].total}</td>
                      <td className="n">{r.datos!.porTipo[t].disponibles}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="panel">
              <h2>Últimas entregas</h2>
              {ultimas.length ? (
                <ul className="historia">
                  {ultimas.map((x) => (
                    <li key={x.id}>
                      <time>{fecha(x.fechaEntrega) || 'Sin fecha'}</time>
                      <span>
                        <Link to={`/equipos/${x.equipoId}`}>{x.equipo ? nombreEquipo(x.equipo) : 'Equipo'}</Link> a{' '}
                        <Link to={`/empleados/${x.empleadoId}`}>{x.empleado?.nombre}</Link>
                        {x.fechaDevolucion && <span className="sub"> (devuelto el {fecha(x.fechaDevolucion)})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="sub">Aún no hay entregas registradas.</p>}
            </section>
          </div>
        </>
      )}
    </>
  );
}
