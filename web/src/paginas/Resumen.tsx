import { FocusEvent, MouseEvent, ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCarga } from '../usar';
import { Asignacion, Estatus, etiquetaTipo, fecha, nombreEquipo, Tipo, TipoEquipoCatalogo, TIPOS } from '../tipos';
import { Cargando, ErrorCarga, Icono, IconoEstatus, Vacio } from '../ui';

interface Resumen {
  porEstatus: Record<Estatus, number>;
  porTipo: Partial<Record<Tipo, { total: number; disponibles: number }>>;
  movimientos: { mes: string; entregas: number; devoluciones: number }[];
  porDepartamento: { nombre: string; n: number }[];
  empleados: { activos: number; sinEquipo: number };
  reparacionesAbiertas: number;
}

const mesDe = (mes: string, opciones: Intl.DateTimeFormatOptions) => new Date(`${mes}-15T12:00:00`).toLocaleDateString('es-MX', opciones);

/** Tooltip que sigue al puntero (o se ancla al elemento cuando llega por teclado). */
function useTooltip() {
  const [tip, setTip] = useState<null | { x: number; y: number; contenido: ReactNode }>(null);
  const en = (contenido: ReactNode) => ({
    onMouseMove: (ev: MouseEvent) => setTip({ x: ev.clientX, y: ev.clientY, contenido }),
    onMouseLeave: () => setTip(null),
    onFocus: (ev: FocusEvent<HTMLElement>) => {
      const r = ev.currentTarget.getBoundingClientRect();
      setTip({ x: r.left + r.width / 2, y: r.top, contenido });
    },
    onBlur: () => setTip(null),
  });
  const capa = tip && <div className="tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>{tip.contenido}</div>;
  return { en, capa };
}

const PRINCIPALES: Tipo[] = ['LAPTOP', 'MONITOR', 'TECLADO', 'MOUSE', 'ADAPTADOR', 'MULTIFUNCIONAL', 'SOPORTE'];

const ESTADOS: { estatus: Estatus; nombre: string; tono: string }[] = [
  { estatus: 'DISPONIBLE', nombre: 'Disponible', tono: 'green' },
  { estatus: 'ASIGNADO', nombre: 'Asignado', tono: 'blue' },
  { estatus: 'EN_REPARACION', nombre: 'En reparación', tono: 'orange' },
  { estatus: 'DANADO', nombre: 'Dañados', tono: 'red' },
  { estatus: 'BAJA', nombre: 'Dados de baja', tono: 'gray' },
];

function Card({ titulo, children, className = '' }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <h3 className="card__title">{titulo}</h3>
      {children}
    </section>
  );
}

function Leyenda({ items }: { items: { nombre: string; color: string }[] }) {
  return (
    <div className="legend">
      {items.map((x) => (
        <span key={x.nombre} className="legend__item"><span className="legend__swatch" style={{ background: x.color }} />{x.nombre}</span>
      ))}
    </div>
  );
}

export default function Resumen() {
  const r = useCarga(() => api<Resumen>('/equipos/resumen'), []);
  const a = useCarga(() => api<Asignacion[]>('/asignaciones'), []);
  const catalogos = useCarga(() => api<TipoEquipoCatalogo[]>('/catalogos/tipos-equipo'), []);
  const tip = useTooltip();

  if (r.error) return <ErrorCarga mensaje={r.error} reintentar={r.recargar} />;
  if (!r.datos) return <Cargando />;
  const d = r.datos;
  const e = d.porEstatus;
  const activos = e.DISPONIBLE + e.ASIGNADO + e.EN_REPARACION + e.DANADO;
  // Los totales por tipo no incluyen los dados de baja.
  // Los tipos principales se muestran siempre, aunque aún no haya equipos; los demás solo si tienen alguno.
  const tipos = (catalogos.datos?.map((t) => t.nombre) ?? Object.keys(TIPOS))
    .filter((t) => d.porTipo[t] || PRINCIPALES.includes(t))
    .map((t) => ({ t, total: 0, disponibles: 0, ...d.porTipo[t] }))
    .sort((x, y) => y.total - x.total);
  const ultimas = (a.datos ?? []).slice(0, 8);

  return (
    <>
      <div className="encabezado"><h2>Resumen</h2></div>
      {catalogos.error && <ErrorCarga mensaje={catalogos.error} reintentar={catalogos.recargar} />}

      {activos + e.BAJA === 0 ? (
        <Vacio titulo="El inventario está vacío">Importa tu Excel o registra el primer equipo.<br /><Link className="btn" to="/excel">Importar desde Excel</Link></Vacio>
      ) : (
        <>
          <section className="summary">
            <Link className="summary__head" to="/equipos?estatus=todos" title="Ver todos los equipos">
              <span className="summary__total">{activos + e.BAJA}</span>
              <span>
                <span className="summary__title">Equipos en total</span>
                <span className="summary__sub">{activos} activos | {e.DISPONIBLE} disponibles para entregar | {e.BAJA} dados de baja</span>
              </span>
            </Link>
            <div className="res-chips">
              {tipos.map((x) => (
                <Link key={x.t} className="res-chip" to={`/equipos?tipo=${encodeURIComponent(x.t)}`} title={`${x.total} en total, ${x.disponibles} disponibles`}>
                  <span className="res-chip__ic"><Icono tipo={x.t} /></span>{etiquetaTipo(x.t)}
                </Link>
              ))}
            </div>
          </section>

          <section className="stats">
            {ESTADOS.map((k) => (
              <Link key={k.estatus} className="stat" to={`/equipos?estatus=${k.estatus}`}>
                <span className="stat__num">{e[k.estatus]}</span>
                <span className={`stat__label tone-${k.tono}`}><IconoEstatus estatus={k.estatus} />{k.nombre}</span>
              </Link>
            ))}
            <Link className="stat" to="/empleados">
              <span className="stat__num">{d.empleados.activos}</span>
              <span className="stat__note tone-green">Empleados activos |<br />{d.empleados.sinEquipo} sin equipo</span>
            </Link>
          </section>

          <div className="grid">
            <Card titulo="Disponibilidad por tipo">
              <Leyenda items={[{ nombre: 'Disponibles', color: 'var(--green)' }, { nombre: 'En uso, reparación o dañados', color: 'var(--track)' }]} />
              <DisponibilidadPorTipo tipos={tipos} en={tip.en} />
            </Card>
            <Card titulo="Movimientos de los últimos 6 meses">
              <Leyenda items={[{ nombre: 'Entregas', color: 'var(--blue-bar)' }, { nombre: 'Devoluciones', color: 'var(--amber)' }]} />
              <Movimientos datos={d.movimientos} en={tip.en} />
            </Card>
            <Card titulo="Equipos asignados por departamento">
              <PorDepartamento datos={d.porDepartamento} en={tip.en} />
            </Card>
            <Card titulo="Últimas entregas" className="card--list">
              {ultimas.length ? (
                <ul className="entregas">
                  {ultimas.map((x) => (
                    <li key={x.id}>
                      <span className="entregas__fecha">{fecha(x.fechaEntrega) || 'Sin fecha'}</span>
                      <span className="entregas__texto">
                        <Link to={`/equipos/${x.equipoId}`}>{x.equipo ? nombreEquipo(x.equipo) : 'Equipo'}</Link> a{' '}
                        <Link to={`/empleados/${x.empleadoId}`}>{x.empleado?.nombre}</Link>
                        {x.fechaDevolucion && <span className="entregas__devuelto"> (devuelto el {fecha(x.fechaDevolucion)})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="sub">Aún no hay entregas registradas.</p>}
            </Card>
          </div>
          {tip.capa}
        </>
      )}
    </>
  );
}

type En = ReturnType<typeof useTooltip>['en'];

function DisponibilidadPorTipo({ tipos, en }: { tipos: { t: Tipo; total: number; disponibles: number }[]; en: En }) {
  const max = Math.max(1, ...tipos.map((x) => x.total));
  return (
    <div className="hbars">
      {tipos.map((x) => (
        <Link
          key={x.t}
          className="hbars__row"
          to={`/equipos?tipo=${encodeURIComponent(x.t)}`}
          {...en(<><b>{etiquetaTipo(x.t)}</b><br />{x.disponibles} disponibles<br />{x.total - x.disponibles} en uso u otro estatus<br />{x.total} en total</>)}
        >
          <span className="hbars__label">{etiquetaTipo(x.t)}</span>
          <span className="hbars__bar">
            <span className="hbars__track" style={{ width: `${Math.max((x.total / max) * 100, 12)}%` }}>
              <span className="hbars__fill" style={{ width: `${x.total ? (x.disponibles / x.total) * 100 : 0}%` }} />
            </span>
          </span>
          <span className="hbars__value"><b>{x.disponibles}</b> de {x.total}</span>
        </Link>
      ))}
    </div>
  );
}

function Movimientos({ datos, en }: { datos: Resumen['movimientos']; en: En }) {
  const max = Math.max(1, ...datos.flatMap((m) => [m.entregas, m.devoluciones]));
  if (datos.every((m) => !m.entregas && !m.devoluciones)) return <p className="sub">Sin entregas ni devoluciones en estos meses.</p>;
  const h = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className="vbars">
      {datos.map((m) => (
        <div
          key={m.mes}
          className="vbars__col"
          tabIndex={0}
          {...en(<><b>{mesDe(m.mes, { month: 'long', year: 'numeric' })}</b><br />{m.entregas} entregas<br />{m.devoluciones} devoluciones</>)}
        >
          <div className="vbars__plot">
            {m.entregas > 0 && <div className="vbars__bar is-entregas" style={{ height: h(m.entregas) }}><span>{m.entregas}</span></div>}
            {m.devoluciones > 0 && <div className="vbars__bar is-devoluciones" style={{ height: h(m.devoluciones) }}><span>{m.devoluciones}</span></div>}
          </div>
          <span className="vbars__label">{mesDe(m.mes, { month: 'short' }).replace('.', '')}</span>
        </div>
      ))}
    </div>
  );
}

function PorDepartamento({ datos, en }: { datos: Resumen['porDepartamento']; en: En }) {
  if (!datos.length) return <p className="sub">No hay equipos asignados.</p>;
  const max = Math.max(1, ...datos.map((x) => x.n));
  const total = datos.reduce((t, x) => t + x.n, 0);
  return (
    <div className="hbars hbars--dept">
      {datos.map((x) => (
        <div key={x.nombre} className="hbars__row" tabIndex={0} {...en(<><b>{x.nombre}</b><br />{x.n} equipos asignados ({Math.round((x.n / total) * 100)}%)</>)}>
          <span className="hbars__label">{x.nombre}</span>
          <span className="hbars__bar"><span className="hbars__solid" style={{ width: `${Math.max((x.n / max) * 100, 3)}%` }} /></span>
          <span className="hbars__value"><b>{x.n}</b></span>
        </div>
      ))}
    </div>
  );
}
