import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, qs } from '../api';
import { agregarAColaResponsivas, ofrecerCartaResponsiva, useColaResponsivas } from '../responsiva';
import { useCarga, useRetraso } from '../usar';
import { useSesion } from '../sesion';
import { AMBITOS_EQUIPO, EmpleadoListado, EquipoDetalle, Estatus, ESTATUS, ESTADOS_REPORTE, esJefeArea, etiquetaTipo, fecha, hoy, iniciales, nombreEquipo, Reparacion, Ref, textoDestinatario } from '../tipos';
import { BUSCAR, Campo, Cargando, DatosEquipo, Destino, DESTINO_PROPIO, DestinoJefe, ErrorCarga, EtiquetaEquipo, FormModal, Icono, MarcaTemporal, Modal, Pill, useAvisos } from '../ui';
import EquipoForm from './EquipoForm';

type Ventana = null | 'editar' | 'asignar' | 'reparacion' | 'baja' | 'disponible' | { recibir: Reparacion };

export default function EquipoPagina() {
  const id = Number(useParams().id);
  const navegar = useNavigate();
  const { puedeEditar, esAdmin } = useSesion();
  const { avisar, confirmar, avisarEstatus } = useAvisos();
  const colaResponsivas = useColaResponsivas();
  const { datos: e, error, recargar } = useCarga(() => api<EquipoDetalle>(`/equipos/${id}`), [id]);
  const [ventana, setVentana] = useState<Ventana>(null);
  const cerrar = () => setVentana(null);

  if (error) return <ErrorCarga mensaje={error} reintentar={recargar} />;
  if (!e) return <Cargando />;

  /** Ejecuta un cambio de estatus y avisa a dónde quedó el equipo. */
  const accion = async (fn: () => Promise<unknown>, estatus: Estatus) => {
    try { await fn(); avisarEstatus(nombreEquipo(e), estatus); recargar(); } catch (err) { avisar((err as Error).message); }
  };
  const devolver = async () => {
    if (await confirmar({ titulo: 'Registrar devolución', mensaje: `${nombreEquipo(e)} dejará de estar asignado a ${e.empleado?.nombre} y quedará disponible.`, boton: 'Registrar devolución' })) {
      try {
        await api('/asignaciones/devolucion', { cuerpo: { equipoId: e.id } });
        recargar();
        if (e.empleado) await ofrecerCartaResponsiva(e.empleado.id, confirmar, avisar);
        avisarEstatus(nombreEquipo(e), 'DISPONIBLE');
      } catch (err) { avisar((err as Error).message); }
    }
  };
  const marcar = (estatus: 'DISPONIBLE' | 'DANADO') => accion(() => api(`/equipos/${e.id}/estatus`, { cuerpo: { estatus } }), estatus);
  const eliminar = async () => {
    if (await confirmar({ titulo: 'Eliminar del inventario', mensaje: `${nombreEquipo(e)} y todo su historial se borrarán para siempre.`, boton: 'Eliminar', peligro: true })) {
      try { await api(`/equipos/${e.id}`, { metodo: 'DELETE' }); avisar('Equipo eliminado'); navegar('/equipos'); } catch (err) { avisar((err as Error).message); }
    }
  };

  const abierta = e.reparaciones.find((r) => !r.fechaRecepcion);

  return (
    <>
      <Link className="migas" to="/equipos">Equipos</Link>
      <div className="encabezado">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className="icono-grande"><Icono tipo={e.tipo} /></span>
          <div>
            <h1>{nombreEquipo(e)}</h1>
            <span className="sub">{AMBITOS_EQUIPO[e.ambito]} | {etiquetaTipo(e.tipo)} | <Pill estatus={e.estatus} />{e.sustituye && <MarcaTemporal />}</span>
          </div>
        </div>
        {puedeEditar && (
          <div className="acciones">
            {colaResponsivas.length > 0 && <Link className="btn ghost" to="/excel?cola=1">Revisar cola ({colaResponsivas.length})</Link>}
            <button className="btn ghost" onClick={() => setVentana('editar')}>Editar</button>
            {e.ambito === 'USUARIO' && e.estatus === 'DISPONIBLE' && <button className="btn" onClick={() => setVentana('asignar')}>Asignar a un empleado</button>}
          </div>
        )}
      </div>

      <div className="detalle">
        <div>
          {e.reportesFalla?.map((r) => (
            <p key={r.id} className="aviso err" style={{ margin: '0 0 16px' }}>
              <b>Solicitud de soporte {ESTADOS_REPORTE[r.estado].nombre.toLowerCase()}:</b> “{r.descripcion}”
              {r.empleado && <> (reportó {r.empleado.nombre})</>}. <Link to="/soporte">Ver solicitudes</Link>
            </p>
          ))}
          <section className="panel">
            <h2>Asignación</h2>
            {e.estatus === 'ASIGNADO' && e.empleado ? (
              <div className="asignacion">
                <span className="av">{iniciales(e.empleado.nombre)}</span>
                <span>
                  <Link to={`/empleados/${e.empleado.id}`}><b>{e.empleado.nombre}</b></Link><br />
                  <span className="sub">{e.empleado.departamento?.nombre ?? 'Sin departamento'} | {(() => { const f = fecha(e.asignaciones.find((a) => !a.fechaDevolucion)?.fechaEntrega); return f ? `Entregado el ${f}` : 'Sin fecha de entrega registrada'; })()}</span>
                  {(() => {
                    const a = e.asignaciones.find((x) => !x.fechaDevolucion);
                    return a?.puestoDestinatario && <span className="sub">Para {textoDestinatario(a.puestoDestinatario.nombre, a.nombreDestinatario)}</span>;
                  })()}
                </span>
                {puedeEditar && <div className="acciones"><button className="btn ghost sm" onClick={devolver}>Registrar devolución</button></div>}
              </div>
            ) : null}
            {e.sustituye && (
              <p className="aviso temp" style={{ margin: '12px 0 0' }}>
                Asignado temporalmente en lugar de <Link to={`/equipos/${e.sustituye.id}`}><b>{nombreEquipo(e.sustituye)}</b></Link> ({ESTATUS[e.sustituye.estatus].nombre.toLowerCase()}).
                Cuando se repare se decide si se le regresa su equipo o se queda con este.
              </p>
            )}
            {e.estatus !== 'ASIGNADO' && (
              <p className="sub" style={{ margin: 0 }}>
                {e.estatus === 'DISPONIBLE' && 'No está asignado. Está listo para entregarse.'}
                {e.estatus === 'EN_REPARACION' && `En reparación desde el ${fecha(abierta?.fechaEnvio)}${abierta?.proveedor ? ` con ${abierta.proveedor}` : ''}.`}
                {e.estatus === 'DANADO' && 'Marcado como dañado. Envíalo a reparación o márcalo disponible si ya funciona.'}
                {e.estatus === 'RESGUARDO' && 'Está guardado en resguardo y no está disponible para asignación.'}
                {e.empleado && ['DANADO', 'EN_REPARACION', 'RESGUARDO'].includes(e.estatus) && <> Sigue ligado a <Link to={`/empleados/${e.empleado.id}`}><b>{e.empleado.nombre}</b></Link> hasta que quede disponible o se dé de baja.</>}
                {e.estatus === 'BAJA' && `Dado de baja el ${fecha(e.fechaBaja)}${e.motivoBaja ? `: ${e.motivoBaja}` : ''}.`}
              </p>
            )}
            {e.temporales.length > 0 && (
              <p className="aviso temp" style={{ margin: '12px 0 0' }}>
                Mientras tanto usa temporalmente {e.temporales.map((t, i) => <span key={t.id}>{i > 0 && ', '}<Link to={`/equipos/${t.id}`}><b>{nombreEquipo(t)}</b></Link></span>)}.
              </p>
            )}
          </section>

          <section className="panel">
            <h2>Características</h2>
            {e.codigoBarras && <EtiquetaEquipo codigo={e.codigoBarras} />}
            <DatosEquipo e={e} completo />
          </section>

          {puedeEditar && (
            <div className="acciones izq" style={{ marginTop: 16 }}>
              {!['EN_REPARACION', 'BAJA'].includes(e.estatus) && <button className="btn ghost" onClick={() => setVentana('reparacion')}>Enviar a reparación</button>}
              {abierta && <button className="btn" onClick={() => setVentana({ recibir: abierta })}>Registrar regreso de reparación</button>}
              {e.estatus === 'DISPONIBLE' && <button className="btn ghost" onClick={() => marcar('DANADO')}>Marcar como dañado</button>}
              {e.estatus === 'DANADO' && <button className="btn ghost" onClick={() => (e.empleado ? setVentana('disponible') : marcar('DISPONIBLE'))}>Marcar disponible</button>}
              {e.estatus === 'RESGUARDO' && <button className="btn ghost" onClick={() => marcar('DISPONIBLE')}>Marcar disponible</button>}
              {e.estatus !== 'BAJA' && <button className="btn peligro" onClick={() => setVentana('baja')}>Dar de baja</button>}
              {e.estatus === 'BAJA' && <button className="btn ghost" onClick={() => accion(() => api(`/equipos/${e.id}/reactivar`, { cuerpo: {} }), 'DISPONIBLE')}>Reactivar</button>}
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
                      {a.puestoDestinatario && <span className="sub"> para {textoDestinatario(a.puestoDestinatario.nombre, a.nombreDestinatario)}</span>}
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
        <RecibirReparacion reparacion={ventana.recibir} equipo={e} onCerrar={cerrar} onListo={() => { cerrar(); recargar(); }} />
      )}
      {ventana === 'disponible' && <MarcarDisponible equipo={e} onCerrar={cerrar} onListo={() => { cerrar(); recargar(); }} />}
    </>
  );
}

function AsignarEquipo({ equipoId, nombre, onCerrar, onListo }: { equipoId: number; nombre: string; onCerrar: () => void; onListo: () => void }) {
  const { avisar } = useAvisos();
  const [texto, setTexto] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [fechaEntrega, setFecha] = useState(hoy());
  const [error, setError] = useState('');
  const [jefeElegido, setJefeElegido] = useState<EmpleadoListado | null>(null);
  const [destino, setDestino] = useState<Destino>(DESTINO_PROPIO);
  const q = useRetraso(texto);
  const deptos = useCarga(() => api<Ref[]>('/departamentos'), []);
  const empleados = useCarga(() => api<EmpleadoListado[]>(`/empleados${qs({ q, departamentoId })}`), [q, departamentoId]);
  const puestos = useCarga(
    () => jefeElegido?.departamentoId ? api<Ref[]>(`/departamentos/${jefeElegido.departamentoId}/puestos`) : Promise.resolve([]),
    [jefeElegido?.departamentoId],
  );
  const elegir = async (emp: EmpleadoListado, d: Destino = DESTINO_PROPIO) => {
    const puestoDestinatarioId = d.paraOtro && d.puestoId ? Number(d.puestoId) : undefined;
    try {
      await api('/asignaciones', { cuerpo: { equipoId, empleadoId: emp.id, fechaEntrega, puestoDestinatarioId, nombreDestinatario: puestoDestinatarioId && d.persona.trim() ? d.persona.trim() : undefined } });
      const enCola = agregarAColaResponsivas(emp.id);
      avisar(enCola
        ? `Asignado a ${emp.nombre} y agregado a la cola de cartas`
        : `Asignado a ${emp.nombre}, pero no se pudo guardar en la cola de cartas`);
      onListo();
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal titulo="Asignar a un empleado" sub={nombre} onCerrar={onCerrar}>
      <div className="form">
        <Campo etiqueta="Fecha de entrega"><input type="date" value={fechaEntrega} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo etiqueta="Departamento">
          <select value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)} disabled={!deptos.datos}>
            <option value="">Todos los departamentos</option>
            {(deptos.datos ?? []).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </Campo>
        <label className="buscar">{BUSCAR}<input className="entrada" type="search" placeholder="Buscar por nombre" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar empleado" /></label>
        {deptos.error && <p className="error" role="alert">{deptos.error}</p>}
        {empleados.error && <p className="error" role="alert">{empleados.error}</p>}
        {jefeElegido && (
          <section className="panel" style={{ margin: 0 }}>
            <h3>Asignar a {jefeElegido.nombre}</h3>
            <p className="sub">Jefe de área de {jefeElegido.departamento?.nombre ?? 'su departamento'}.</p>
            <div className="form">
              <DestinoJefe
                jefe={jefeElegido.nombre}
                puestos={puestos.datos}
                destino={destino}
                onCambio={(d) => { setDestino(d); setError(''); }}
              />
            </div>
            {puestos.error && <ErrorCarga mensaje={puestos.error} reintentar={puestos.recargar} />}
            <div className="acciones">
              <button type="button" className="btn ghost" onClick={() => { setJefeElegido(null); setDestino(DESTINO_PROPIO); }}>Cancelar</button>
              <button type="button" className="btn" disabled={destino.paraOtro && !destino.puestoId} onClick={() => elegir(jefeElegido, destino)}>Asignar equipo</button>
            </div>
          </section>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="lista-elegir">
          {(empleados.datos ?? []).map((emp) => (
            <button key={emp.id} className="persona" onClick={() => esJefeArea(emp.puesto?.nombre) ? (setJefeElegido(emp), setDestino(DESTINO_PROPIO), setError('')) : elegir(emp)}>
              <span className="av">{iniciales(emp.nombre)}</span>
              <span><b>{emp.nombre}</b><span className="sub">{emp.departamento?.nombre ?? 'Sin departamento'}{emp.puesto ? ` | ${emp.puesto.nombre}` : ''}</span></span>
              <span className="sub">{emp.equiposAsignados} equipos</span>
            </button>
          ))}
          {empleados.datos && !empleados.datos.length && <p className="sub">Ningún empleado activo coincide en este departamento.</p>}
        </div>
      </div>
    </Modal>
  );
}

function EnviarReparacion({ equipo, onCerrar, onListo }: { equipo: EquipoDetalle; onCerrar: () => void; onListo: () => void }) {
  const { avisar, confirmar, avisarEstatus } = useAvisos();
  const [motivo, setMotivo] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [fechaEnvio, setFecha] = useState(hoy());
  return (
    <FormModal titulo="Enviar a reparación" sub={nombreEquipo(equipo)} boton="Enviar a reparación" onCerrar={onCerrar} onEnviar={async () => {
      await api('/reparaciones', { cuerpo: { equipoId: equipo.id, motivo, proveedor: proveedor || undefined, fechaEnvio } });
      onListo();
      if (equipo.estatus === 'ASIGNADO' && equipo.empleado) {
        await ofrecerCartaResponsiva(equipo.empleado.id, confirmar, avisar);
      }
      avisarEstatus(nombreEquipo(equipo), 'EN_REPARACION');
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

/** Al quedar reparado un equipo ligado a un empleado: regresárselo o dejarlo disponible. */
function DestinoReparado({ equipo, regresar, setRegresar }: { equipo: EquipoDetalle; regresar: boolean; setRegresar: (v: boolean) => void }) {
  if (!equipo.empleado) return null;
  const temporales = equipo.temporales.map(nombreEquipo).join(', ');
  return (
    <fieldset className="destino">
      <legend>¿Qué hacer con el equipo?</legend>
      <label>
        <input type="radio" name="destino" checked={regresar} onChange={() => setRegresar(true)} />
        <span>
          <b>Regresárselo a {equipo.empleado.nombre}</b>
          <span className="sub">{temporales ? `${temporales} (temporal) vuelve al inventario como disponible.` : 'Se le asigna de nuevo.'}</span>
        </span>
      </label>
      <label>
        <input type="radio" name="destino" checked={!regresar} onChange={() => setRegresar(false)} />
        <span>
          <b>Dejarlo disponible en el inventario</b>
          <span className="sub">{temporales ? `${temporales} se queda con ${equipo.empleado.nombre} y deja de ser temporal.` : `Se desliga de ${equipo.empleado.nombre}.`}</span>
        </span>
      </label>
    </fieldset>
  );
}

function MarcarDisponible({ equipo, onCerrar, onListo }: { equipo: EquipoDetalle; onCerrar: () => void; onListo: () => void }) {
  const { avisar, confirmar, avisarEstatus } = useAvisos();
  const [regresar, setRegresar] = useState(true);
  return (
    <FormModal titulo="Marcar disponible" sub={nombreEquipo(equipo)} boton="Guardar" onCerrar={onCerrar} onEnviar={async () => {
      await api(`/equipos/${equipo.id}/estatus`, { cuerpo: { estatus: 'DISPONIBLE', regresarAEmpleado: regresar } });
      onListo();
      if (regresar && equipo.empleado) await ofrecerCartaResponsiva(equipo.empleado.id, confirmar, avisar);
      avisarEstatus(nombreEquipo(equipo), regresar ? 'ASIGNADO' : 'DISPONIBLE');
    }}>
      <DestinoReparado equipo={equipo} regresar={regresar} setRegresar={setRegresar} />
    </FormModal>
  );
}

function RecibirReparacion({ reparacion, equipo, onCerrar, onListo }: { reparacion: Reparacion; equipo: EquipoDetalle; onCerrar: () => void; onListo: () => void }) {
  const { avisar, confirmar, avisarEstatus } = useAvisos();
  const nombre = nombreEquipo(equipo);
  const [solucion, setSolucion] = useState('');
  const [resultado, setResultado] = useState<Estatus>('DISPONIBLE');
  const [fechaRecepcion, setFecha] = useState(hoy());
  const [regresar, setRegresar] = useState(true);
  const regresa = resultado === 'DISPONIBLE' && !!equipo.empleado && regresar;
  return (
    <FormModal titulo="Registrar regreso de reparación" sub={nombre} boton="Registrar regreso" onCerrar={onCerrar} onEnviar={async () => {
      await api(`/reparaciones/${reparacion.id}/recepcion`, { cuerpo: { solucion, resultado, fechaRecepcion, regresarAEmpleado: regresa } });
      onListo();
      if (regresa && equipo.empleado) await ofrecerCartaResponsiva(equipo.empleado.id, confirmar, avisar);
      avisarEstatus(nombre, regresa ? 'ASIGNADO' : resultado);
    }}>
      <p className="sub" style={{ margin: 0 }}>Enviado el {fecha(reparacion.fechaEnvio)}: {reparacion.motivo}</p>
      <Campo etiqueta="Qué se hizo"><textarea value={solucion} onChange={(e) => setSolucion(e.target.value)} rows={3} /></Campo>
      <div className="dos-col">
        <Campo etiqueta="Cómo quedó el equipo">
          <select value={resultado} onChange={(e) => setResultado(e.target.value as Estatus)}>
            <option value="DISPONIBLE">{equipo.empleado ? 'Ya funciona' : 'Funciona: disponible'}</option>
            <option value="DANADO">Sigue dañado</option>
            <option value="BAJA">No tiene arreglo: dar de baja</option>
          </select>
        </Campo>
        <Campo etiqueta="Fecha de regreso"><input type="date" value={fechaRecepcion} onChange={(e) => setFecha(e.target.value)} /></Campo>
      </div>
      {resultado === 'DISPONIBLE' && <DestinoReparado equipo={equipo} regresar={regresar} setRegresar={setRegresar} />}
    </FormModal>
  );
}

function BajaEquipo({ equipo, onCerrar, onListo }: { equipo: EquipoDetalle; onCerrar: () => void; onListo: () => void }) {
  const { avisarEstatus } = useAvisos();
  const [motivo, setMotivo] = useState('');
  return (
    <FormModal titulo="Dar de baja el equipo" sub={nombreEquipo(equipo)} boton="Dar de baja" peligro onCerrar={onCerrar} onEnviar={async () => {
      await api(`/equipos/${equipo.id}/baja`, { cuerpo: { motivo } });
      avisarEstatus(nombreEquipo(equipo), 'BAJA');
      onListo();
    }}>
      {equipo.estatus === 'ASIGNADO' && <p className="aviso">Está asignado a {equipo.empleado?.nombre}. Al darlo de baja se le retira.</p>}
      <Campo etiqueta="Motivo de la baja"><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Por ejemplo: tarjeta madre dañada sin reparación" /></Campo>
    </FormModal>
  );
}
