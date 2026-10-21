import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, qs } from '../api';
import { useCarga, useRetraso } from '../usar';
import { useSesion } from '../sesion';
import { EmpleadoDetalle, EquipoListado, fecha, hoy, iniciales, nombreEquipo, Pagina, Tipo, TIPOS } from '../tipos';
import { BUSCAR, Campo, Cargando, ErrorCarga, Modal, TarjetaEquipo, useAvisos, Vacio } from '../ui';
import EmpleadoForm from './EmpleadoForm';
import EquipoForm from './EquipoForm';

export default function EmpleadoPagina() {
  const id = Number(useParams().id);
  const navegar = useNavigate();
  const { puedeEditar, esAdmin } = useSesion();
  const { avisar, confirmar } = useAvisos();
  const { datos: e, error, recargar } = useCarga(() => api<EmpleadoDetalle>(`/empleados/${id}`), [id]);
  const [ventana, setVentana] = useState<null | 'editar' | 'asignar' | 'nuevo'>(null);
  const cerrar = () => setVentana(null);

  if (error) return <ErrorCarga mensaje={error} reintentar={recargar} />;
  if (!e) return <Cargando />;

  const intentar = async (fn: () => Promise<unknown>, msj: string) => {
    try { await fn(); avisar(msj); recargar(); } catch (err) { avisar((err as Error).message); }
  };
  const devolver = async (equipoId: number, nombre: string) => {
    if (await confirmar({ titulo: 'Registrar devolución', mensaje: `${nombre} quedará disponible en el inventario.`, boton: 'Registrar devolución' })) {
      intentar(() => api('/asignaciones/devolucion', { cuerpo: { equipoId } }), 'Devolución registrada');
    }
  };
  const baja = async () => {
    const n = e.equiposActuales.length;
    if (await confirmar({
      titulo: 'Dar de baja al empleado',
      mensaje: n ? `${e.nombre} tiene ${n} ${n === 1 ? 'equipo asignado, que volverá' : 'equipos asignados, que volverán'} al inventario como disponible.` : `${e.nombre} quedará como dado de baja.`,
      boton: 'Dar de baja', peligro: true,
    })) intentar(() => api(`/empleados/${e.id}/baja`, { cuerpo: {} }), 'Empleado dado de baja');
  };
  const eliminar = async () => {
    if (await confirmar({ titulo: 'Eliminar empleado', mensaje: `${e.nombre} se borrará para siempre.`, boton: 'Eliminar', peligro: true })) {
      try { await api(`/empleados/${e.id}`, { metodo: 'DELETE' }); avisar('Empleado eliminado'); navegar('/empleados'); } catch (err) { avisar((err as Error).message); }
    }
  };

  return (
    <>
      <Link className="migas" to="/empleados">Empleados</Link>
      <div className="encabezado">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className="av" style={{ width: 52, height: 52, fontSize: '1.2rem' }}>{iniciales(e.nombre)}</span>
          <div>
            <h1>{e.nombre}</h1>
            <span className="sub">{e.departamento?.nombre ?? 'Sin departamento'}{e.activo ? '' : ` | Dado de baja el ${fecha(e.fechaBaja)}`}</span>
          </div>
        </div>
        {puedeEditar && e.activo && (
          <div className="acciones">
            <button className="btn ghost" onClick={() => setVentana('nuevo')}>Registrar equipo nuevo</button>
            <button className="btn" onClick={() => setVentana('asignar')}>Asignar equipo del inventario</button>
          </div>
        )}
      </div>

      <div className="detalle">
        <div>
          <section className="panel">
            <h2>Equipos asignados ({e.equiposActuales.length})</h2>
            {e.equiposActuales.length ? (
              <div className="lista">
                {e.equiposActuales.map((x) => (
                  <div className="fila-accion" key={x.id}>
                    <TarjetaEquipo e={x} a={`/equipos/${x.id}`} lado={<span className="sub">{fecha(e.asignaciones.find((a) => a.equipoId === x.id && !a.fechaDevolucion)?.fechaEntrega)}</span>} />
                    {puedeEditar && <button className="btn ghost sm" onClick={() => devolver(x.id, nombreEquipo(x))}>Devolver</button>}
                  </div>
                ))}
              </div>
            ) : <Vacio titulo="Sin equipos asignados">{e.activo && puedeEditar ? 'Usa “Asignar equipo del inventario” para entregarle uno.' : null}</Vacio>}
          </section>
          <section className="panel">
            <h2>Historial</h2>
            {e.asignaciones.length ? (
              <div className="desliza">
                <table className="tabla">
                  <thead><tr><th>Equipo</th><th>Entregado</th><th>Devuelto</th></tr></thead>
                  <tbody>
                    {e.asignaciones.map((a) => (
                      <tr key={a.id}>
                        <td><Link to={`/equipos/${a.equipoId}`}>{a.equipo ? nombreEquipo(a.equipo) : 'Equipo'}</Link>{a.equipo?.serie && <span className="sub mono"> {a.equipo.serie}</span>}</td>
                        <td>{fecha(a.fechaEntrega) || '—'}</td>
                        <td>{a.fechaDevolucion ? fecha(a.fechaDevolucion) : <span className="sub">Vigente</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="sub" style={{ margin: 0 }}>Todavía no ha recibido equipos.</p>}
          </section>
        </div>
        <div>
          <section className="panel">
            <h2>Datos</h2>
            <dl className="dl">
              <dt>Nombre</dt><dd>{e.nombre}</dd>
              <dt>Departamento</dt><dd>{e.departamento?.nombre ?? '—'}</dd>
              <dt>Número</dt><dd>{e.numero || '—'}</dd>
              <dt>Correo</dt><dd>{e.correo || '—'}</dd>
              {e.notas && <><dt>Notas</dt><dd>{e.notas}</dd></>}
              <dt>Estado</dt><dd>{e.activo ? 'Activo' : 'Dado de baja'}</dd>
            </dl>
          </section>
          {puedeEditar && (
            <div className="acciones izq" style={{ marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setVentana('editar')}>Editar datos</button>
              {e.activo
                ? <button className="btn peligro" onClick={baja}>Dar de baja</button>
                : <button className="btn ghost" onClick={() => intentar(() => api(`/empleados/${e.id}/reactivar`, { cuerpo: {} }), 'Empleado reactivado')}>Reactivar</button>}
              {!e.activo && esAdmin && <button className="btn peligro" onClick={eliminar}>Eliminar</button>}
            </div>
          )}
        </div>
      </div>

      {ventana === 'editar' && <EmpleadoForm empleado={e} onCerrar={cerrar} onGuardado={() => { cerrar(); recargar(); }} />}
      {ventana === 'nuevo' && <EquipoForm empleadoInicial={e.id} onCerrar={cerrar} onGuardado={() => { cerrar(); recargar(); }} />}
      {ventana === 'asignar' && <ElegirEquipo empleado={e} onCerrar={cerrar} onListo={() => { cerrar(); recargar(); }} />}
    </>
  );
}

function ElegirEquipo({ empleado, onCerrar, onListo }: { empleado: EmpleadoDetalle; onCerrar: () => void; onListo: () => void }) {
  const { avisar } = useAvisos();
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('');
  const [fechaEntrega, setFecha] = useState(hoy());
  const [error, setError] = useState('');
  const q = useRetraso(texto);
  const { datos } = useCarga(() => api<Pagina<EquipoListado>>(`/equipos${qs({ estatus: 'DISPONIBLE', q, tipo, limite: 100 })}`), [q, tipo]);
  const elegir = async (equipoId: number, nombre: string) => {
    try {
      await api('/asignaciones', { cuerpo: { equipoId, empleadoId: empleado.id, fechaEntrega } });
      avisar(`${nombre} asignado a ${empleado.nombre}`);
      onListo();
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal titulo={`Asignar equipo a ${empleado.nombre}`} sub="Solo se muestran equipos disponibles" onCerrar={onCerrar} ancho>
      <div className="form">
        <div className="dos-col">
          <Campo etiqueta="Fecha de entrega"><input type="date" value={fechaEntrega} onChange={(e) => setFecha(e.target.value)} /></Campo>
          <Campo etiqueta="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {(Object.keys(TIPOS) as Tipo[]).map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
            </select>
          </Campo>
        </div>
        <label className="buscar">{BUSCAR}<input className="entrada" type="search" placeholder="Buscar por serie, marca, modelo o código" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar equipo" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="lista-elegir">
          {(datos?.datos ?? []).map((x) => <TarjetaEquipo key={x.id} e={x} onClick={() => elegir(x.id, nombreEquipo(x))} />)}
          {datos && !datos.datos.length && <p className="sub">No hay equipos disponibles con ese filtro.</p>}
        </div>
      </div>
    </Modal>
  );
}
