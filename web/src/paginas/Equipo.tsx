import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useCarga, useRetraso } from '../usar';
import { useSesion } from '../sesion';
import { CAMPOS, EmpleadoListado, EquipoDetalle, ESTATUS, fecha, hoy, iniciales, nombreEquipo, Reparacion, TIPOS } from '../tipos';
import { BUSCAR, Campo, Cargando, CodigoBarras, ErrorCarga, FormModal, Icono, Modal, Pill, useAvisos } from '../ui';
import EquipoForm from './EquipoForm';

type Ventana = null | 'editar' | 'asignar' | 'reparacion' | 'baja' | { recibir: Reparacion };

export default function EquipoPagina() {
  const id = Number(useParams().id);
  const navegar = useNavigate();
  const { puedeEditar, esAdmin } = useSesion();
  const { avisar, confirmar } = useAvisos();
  const { datos: e, error, recargar } = useCarga(() => api<EquipoDetalle>(`/equipos/${id}`), [id]);
  const [ventana, setVentana] = useState<Ventana>(null);
  const cerrar = () => setVentana(null);

  if (error) return <ErrorCarga mensaje={error} reintentar={recargar} />;
  if (!e) return <Cargando />;

  const accion = async (fn: () => Promise<unknown>, mensaje: string) => {
    try { await fn(); avisar(mensaje); recargar(); } catch (err) { avisar((err as Error).message); }
  };
  const devolver = async () => {
    if (await confirmar({ titulo: 'Registrar devolución', mensaje: `${nombreEquipo(e)} dejará de estar asignado a ${e.empleado?.nombre} y quedará disponible.`, boton: 'Registrar devolución' })) {
      accion(() => api('/asignaciones/devolucion', { cuerpo: { equipoId: e.id } }), 'Devolución registrada');
    }
  };
  const marcar = (estatus: 'DISPONIBLE' | 'DANADO') =>
    accion(() => api(`/equipos/${e.id}/estatus`, { cuerpo: { estatus } }), estatus === 'DANADO' ? 'Marcado como dañado' : 'Marcado como disponible');
  const eliminar = async () => {
    if (await confirmar({ titulo: 'Eliminar del inventario', mensaje: `${nombreEquipo(e)} y todo su historial se borrarán para siempre.`, boton: 'Eliminar', peligro: true })) {
      try { await api(`/equipos/${e.id}`, { metodo: 'DELETE' }); avisar('Equipo eliminado'); navegar('/equipos'); } catch (err) { avisar((err as Error).message); }
    }
  };

  const caracteristicas = CAMPOS.filter((c) => e[c.clave] && (!c.tipos || c.tipos.includes(e.tipo)));
  const abierta = e.reparaciones.find((r) => !r.fechaRecepcion);

  return (
    <>
      <Link className="migas" to="/equipos">Equipos</Link>
      <div className="encabezado">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className="icono-grande"><Icono tipo={e.tipo} /></span>
          <div>
            <h1>{nombreEquipo(e)}</h1>
            <span className="sub">{TIPOS[e.tipo]} | <Pill estatus={e.estatus} /></span>
          </div>
        </div>
        {puedeEditar && (
          <div className="acciones">
            <button className="btn ghost" onClick={() => setVentana('editar')}>Editar</button>
            {e.estatus === 'DISPONIBLE' && <button className="btn" onClick={() => setVentana('asignar')}>Asignar a un empleado</button>}
          </div>
        )}
      </div>

      <div className="detalle">
        <div>
          <section className="panel">
            <h2>Asignación</h2>
            {e.estatus === 'ASIGNADO' && e.empleado ? (
              <div className="asignacion">
                <span className="av">{iniciales(e.empleado.nombre)}</span>
                <span>
                  <Link to={`/empleados/${e.empleado.id}`}><b>{e.empleado.nombre}</b></Link><br />
                  <span className="sub">{e.empleado.departamento?.nombre ?? 'Sin departamento'} | {(() => { const f = fecha(e.asignaciones.find((a) => !a.fechaDevolucion)?.fechaEntrega); return f ? `Entregado el ${f}` : 'Sin fecha de entrega registrada'; })()}</span>
                </span>
                {puedeEditar && <div className="acciones"><button className="btn ghost sm" onClick={devolver}>Registrar devolución</button></div>}
              </div>
            ) : (
              <p className="sub" style={{ margin: 0 }}>
                {e.estatus === 'DISPONIBLE' && 'No está asignado. Está listo para entregarse.'}
                {e.estatus === 'EN_REPARACION' && `En reparación desde el ${fecha(abierta?.fechaEnvio)}${abierta?.proveedor ? ` con ${abierta.proveedor}` : ''}.`}
                {e.estatus === 'DANADO' && 'Marcado como dañado. Envíalo a reparación o márcalo disponible si ya funciona.'}
                {e.estatus === 'BAJA' && `Dado de baja el ${fecha(e.fechaBaja)}${e.motivoBaja ? `: ${e.motivoBaja}` : ''}.`}
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Características</h2>
            {e.codigoBarras && <div className="etiqueta-cb"><CodigoBarras valor={e.codigoBarras} /></div>}
            <dl className="dl">
              {caracteristicas.map((c) => (
                <div key={c.clave} style={{ display: 'contents' }}>
                  <dt>{c.etiqueta}</dt>
                  <dd className={c.mono ? 'mono' : undefined}>{c.opciones ? c.opciones.find(([k]) => k === e[c.clave])?.[1] : String(e[c.clave])}</dd>
                </div>
              ))}
              {e.notas && <><dt>Notas</dt><dd>{e.notas}</dd></>}
              <dt>Registrado</dt><dd>{fecha(e.creadoEn)}</dd>
            </dl>
          </section>

          {puedeEditar && (
            <div className="acciones izq" style={{ marginTop: 16 }}>
              {!['EN_REPARACION', 'BAJA'].includes(e.estatus) && <button className="btn ghost" onClick={() => setVentana('reparacion')}>Enviar a reparación</button>}
              {abierta && <button className="btn" onClick={() => setVentana({ recibir: abierta })}>Registrar regreso de reparación</button>}
              {e.estatus === 'DISPONIBLE' && <button className="btn ghost" onClick={() => marcar('DANADO')}>Marcar como dañado</button>}
              {e.estatus === 'DANADO' && <button className="btn ghost" onClick={() => marcar('DISPONIBLE')}>Marcar disponible</button>}
              {e.estatus !== 'BAJA' && <button className="btn peligro" onClick={() => setVentana('baja')}>Dar de baja</button>}
              {e.estatus === 'BAJA' && <button className="btn ghost" onClick={() => accion(() => api(`/equipos/${e.id}/reactivar`, { cuerpo: {} }), 'Equipo reactivado')}>Reactivar</button>}
              {e.estatus === 'BAJA' && esAdmin && <button className="btn peligro" onClick={eliminar}>Eliminar del inventario</button>}
            </div>
          )}
        </div>

        <div>
          <section className="panel">
            <h2>Historial de asignaciones</h2>
            {e.asignaciones.length ? (
              <ul className="historia">
                {e.asignaciones.map((a) => (
                  <li key={a.id}>
                    <time>{fecha(a.fechaEntrega) || 'Sin fecha'}</time>
                    <span>
                      <Link to={`/empleados/${a.empleadoId}`}>{a.empleado?.nombre}</Link>
                      <span className="sub">{a.fechaDevolucion ? ` hasta el ${fecha(a.fechaDevolucion)}` : ' (vigente)'}</span>
                      {a.notas && <><br /><span className="sub">{a.notas}</span></>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="sub" style={{ margin: 0 }}>Nunca se ha asignado.</p>}
          </section>
          <section className="panel">
            <h2>Reparaciones</h2>
            {e.reparaciones.length ? (
              <ul className="historia">
                {e.reparaciones.map((r) => (
                  <li key={r.id}>
                    <time>{fecha(r.fechaEnvio)}</time>
                    <span>
                      {r.motivo}{r.proveedor && <span className="sub"> ({r.proveedor})</span>}<br />
                      <span className="sub">{r.fechaRecepcion ? `Regresó el ${fecha(r.fechaRecepcion)} como ${ESTATUS[r.resultado ?? 'DISPONIBLE'].nombre.toLowerCase()}${r.solucion ? `: ${r.solucion}` : ''}` : 'Pendiente de regreso'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="sub" style={{ margin: 0 }}>Sin reparaciones registradas.</p>}
          </section>
        </div>
      </div>

      {ventana === 'editar' && <EquipoForm equipo={e} onCerrar={cerrar} onGuardado={() => { cerrar(); recargar(); }} />}
      {ventana === 'asignar' && <AsignarEquipo equipoId={e.id} nombre={nombreEquipo(e)} onCerrar={cerrar} onListo={() => { cerrar(); recargar(); }} />}
      {ventana === 'reparacion' && (
        <EnviarReparacion equipo={e} onCerrar={cerrar} onListo={() => { cerrar(); recargar(); }} />
      )}
      {ventana === 'baja' && (
        <BajaEquipo equipo={e} onCerrar={cerrar} onListo={() => { cerrar(); recargar(); }} />
      )}
      {ventana && typeof ventana === 'object' && (
        <RecibirReparacion reparacion={ventana.recibir} nombre={nombreEquipo(e)} onCerrar={cerrar} onListo={() => { cerrar(); recargar(); }} />
      )}
    </>
  );
}

function AsignarEquipo({ equipoId, nombre, onCerrar, onListo }: { equipoId: number; nombre: string; onCerrar: () => void; onListo: () => void }) {
  const { avisar } = useAvisos();
  const [texto, setTexto] = useState('');
  const [fechaEntrega, setFecha] = useState(hoy());
  const [error, setError] = useState('');
  const q = useRetraso(texto);
  const { datos } = useCarga(() => api<EmpleadoListado[]>(`/empleados${q ? `?q=${encodeURIComponent(q)}` : ''}`), [q]);
  const elegir = async (emp: EmpleadoListado) => {
    try {
      await api('/asignaciones', { cuerpo: { equipoId, empleadoId: emp.id, fechaEntrega } });
      avisar(`Asignado a ${emp.nombre}`);
      onListo();
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal titulo="Asignar a un empleado" sub={nombre} onCerrar={onCerrar}>
      <div className="form">
        <Campo etiqueta="Fecha de entrega"><input type="date" value={fechaEntrega} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <label className="buscar">{BUSCAR}<input className="entrada" type="search" placeholder="Buscar por nombre" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar empleado" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="lista-elegir">
          {(datos ?? []).map((emp) => (
            <button key={emp.id} className="persona" onClick={() => elegir(emp)}>
              <span className="av">{iniciales(emp.nombre)}</span>
              <span><b>{emp.nombre}</b><span className="sub">{emp.departamento?.nombre ?? 'Sin departamento'}</span></span>
              <span className="sub">{emp.equiposAsignados} equipos</span>
            </button>
          ))}
          {datos && !datos.length && <p className="sub">Ningún empleado activo coincide.</p>}
        </div>
      </div>
    </Modal>
  );
}

function EnviarReparacion({ equipo, onCerrar, onListo }: { equipo: EquipoDetalle; onCerrar: () => void; onListo: () => void }) {
  const { avisar } = useAvisos();
  const [motivo, setMotivo] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [fechaEnvio, setFecha] = useState(hoy());
  return (
    <FormModal titulo="Enviar a reparación" sub={nombreEquipo(equipo)} boton="Enviar a reparación" onCerrar={onCerrar} onEnviar={async () => {
      await api('/reparaciones', { cuerpo: { equipoId: equipo.id, motivo, proveedor: proveedor || undefined, fechaEnvio } });
      avisar('Enviado a reparación');
      onListo();
    }}>
      {equipo.estatus === 'ASIGNADO' && <p className="aviso">Lo tiene {equipo.empleado?.nombre}. Al enviarlo se registra la devolución automáticamente.</p>}
      <Campo etiqueta="Falla o motivo"><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} /></Campo>
      <div className="dos-col">
        <Campo etiqueta="Proveedor o taller" opcional><input value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></Campo>
        <Campo etiqueta="Fecha de envío"><input type="date" value={fechaEnvio} onChange={(e) => setFecha(e.target.value)} /></Campo>
      </div>
    </FormModal>
  );
}

function RecibirReparacion({ reparacion, nombre, onCerrar, onListo }: { reparacion: Reparacion; nombre: string; onCerrar: () => void; onListo: () => void }) {
  const { avisar } = useAvisos();
  const [solucion, setSolucion] = useState('');
  const [resultado, setResultado] = useState('DISPONIBLE');
  const [fechaRecepcion, setFecha] = useState(hoy());
  return (
    <FormModal titulo="Registrar regreso de reparación" sub={nombre} boton="Registrar regreso" onCerrar={onCerrar} onEnviar={async () => {
      await api(`/reparaciones/${reparacion.id}/recepcion`, { cuerpo: { solucion, resultado, fechaRecepcion } });
      avisar('Regreso registrado');
      onListo();
    }}>
      <p className="sub" style={{ margin: 0 }}>Enviado el {fecha(reparacion.fechaEnvio)}: {reparacion.motivo}</p>
      <Campo etiqueta="Qué se hizo"><textarea value={solucion} onChange={(e) => setSolucion(e.target.value)} rows={3} /></Campo>
      <div className="dos-col">
        <Campo etiqueta="Cómo quedó el equipo">
          <select value={resultado} onChange={(e) => setResultado(e.target.value)}>
            <option value="DISPONIBLE">Funciona: disponible</option>
            <option value="DANADO">Sigue dañado</option>
            <option value="BAJA">No tiene arreglo: dar de baja</option>
          </select>
        </Campo>
        <Campo etiqueta="Fecha de regreso"><input type="date" value={fechaRecepcion} onChange={(e) => setFecha(e.target.value)} /></Campo>
      </div>
    </FormModal>
  );
}

function BajaEquipo({ equipo, onCerrar, onListo }: { equipo: EquipoDetalle; onCerrar: () => void; onListo: () => void }) {
  const { avisar } = useAvisos();
  const [motivo, setMotivo] = useState('');
  return (
    <FormModal titulo="Dar de baja el equipo" sub={nombreEquipo(equipo)} boton="Dar de baja" peligro onCerrar={onCerrar} onEnviar={async () => {
      await api(`/equipos/${equipo.id}/baja`, { cuerpo: { motivo } });
      avisar('Equipo dado de baja');
      onListo();
    }}>
      {equipo.estatus === 'ASIGNADO' && <p className="aviso">Está asignado a {equipo.empleado?.nombre}. Al darlo de baja se le retira.</p>}
      <Campo etiqueta="Motivo de la baja"><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Por ejemplo: tarjeta madre dañada sin reparación" /></Campo>
    </FormModal>
  );
}
