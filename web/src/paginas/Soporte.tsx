import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../api';
import { avisarCambioSoporte, useCarga } from '../usar';
import { useSesion } from '../sesion';
import { EstadoReporte, ESTADOS_REPORTE, ESTATUS, fecha, nombreEquipo, ReporteFalla } from '../tipos';
import { Campo, Cargando, ErrorCarga, FormModal, useAvisos, Vacio } from '../ui';

type Filtro = 'ABIERTOS' | EstadoReporte | 'TODOS';
const FILTROS: [Filtro, string][] = [['ABIERTOS', 'Sin cerrar'], ['PENDIENTE', 'Pendientes'], ['EN_ATENCION', 'En atención'], ['CERRADO', 'Cerrados'], ['TODOS', 'Todos']];
type Accion = { tipo: 'atender' | 'reparacion' | 'cerrar'; reporte: ReporteFalla };

const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/** Bandeja de las fallas que los empleados reportan desde la app móvil. */
export default function Soporte() {
  const { puedeEditar } = useSesion();
  const [filtro, setFiltro] = useState<Filtro>('ABIERTOS');
  const [accion, setAccion] = useState<Accion | null>(null);
  const estado = filtro === 'ABIERTOS' || filtro === 'TODOS' ? undefined : filtro;
  const { datos: cargados, error, recargar } = useCarga(() => api<ReporteFalla[]>(`/reportes-falla${qs({ estado })}`), [estado]);
  const datos = filtro === 'ABIERTOS' ? cargados?.filter((r) => r.estado !== 'CERRADO') : cargados;
  const listo = () => { setAccion(null); recargar(); avisarCambioSoporte(); };

  return (
    <>
      <div className="encabezado"><h1>Solicitudes de soporte</h1></div>
      <p className="sub" style={{ marginTop: -8 }}>Fallas que los empleados reportan desde la app. Reportar no cambia el estatus del equipo: tú decides qué hacer.</p>
      <div className="barra">
        <div className="chips" role="group" aria-label="Mostrar">
          {FILTROS.map(([k, n]) => <button key={k} className="chip" aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{n}</button>)}
        </div>
      </div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : datos.length ? (
        <div className="lista-reportes">
          {datos.map((r) => (
            <section key={r.id} className="panel reporte">
              <div className="panel-cab">
                <div>
                  <h2>{r.equipo ? <Link to={`/equipos/${r.equipoId}`}>{nombreEquipo(r.equipo)}</Link> : 'Equipo'}</h2>
                  <span className="sub">
                    {r.equipo?.codigoBarras && <span className="mono">{r.equipo.codigoBarras}</span>}
                    {r.equipo && <> | Equipo {ESTATUS[r.equipo.estatus].nombre.toLowerCase()}</>}
                  </span>
                </div>
                <span className={`estado-reporte ${ESTADOS_REPORTE[r.estado].clase}`}>{ESTADOS_REPORTE[r.estado].nombre}</span>
              </div>
              <p className="reporte__falla">“{r.descripcion}”</p>
              <p className="sub" style={{ margin: 0 }}>
                Reportó {r.empleado ? <Link to={`/empleados/${r.empleado.id}`}><b>{r.empleado.nombre}</b></Link> : 'un empleado'}
                {r.empleado?.departamento && <> ({r.empleado.departamento.nombre})</>} el {fechaHora(r.creadoEn)}
              </p>
              {r.respuesta && (
                <p className="sub" style={{ margin: '6px 0 0' }}>
                  <b>Respuesta{r.atendidoPor ? ` de ${r.atendidoPor.nombre}` : ''}:</b> {r.respuesta}
                </p>
              )}
              {r.reparacion && (
                <p className="sub" style={{ margin: '6px 0 0' }}>
                  Enviado a reparación el {fecha(r.reparacion.fechaEnvio)}{r.reparacion.proveedor && ` con ${r.reparacion.proveedor}`}
                  {r.reparacion.fechaRecepcion ? `; regresó el ${fecha(r.reparacion.fechaRecepcion)}.` : '; aún no regresa.'}
                </p>
              )}
              {r.cerradoEn && <p className="sub" style={{ margin: '6px 0 0' }}>Cerrado el {fechaHora(r.cerradoEn)}.</p>}
              {puedeEditar && r.estado !== 'CERRADO' && (
                <div className="acciones izq" style={{ marginTop: 12 }}>
                  {r.estado === 'PENDIENTE' && <button className="btn ghost sm" onClick={() => setAccion({ tipo: 'atender', reporte: r })}>Atender</button>}
                  {!r.reparacionId && r.equipo?.estatus !== 'EN_REPARACION' && (
                    <button className="btn ghost sm" onClick={() => setAccion({ tipo: 'reparacion', reporte: r })}>Mandar a reparación</button>
                  )}
                  <button className="btn sm" onClick={() => setAccion({ tipo: 'cerrar', reporte: r })}>Cerrar</button>
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <Vacio titulo={filtro === 'ABIERTOS' ? 'No hay solicitudes pendientes' : 'Sin solicitudes'}>
          Cuando un empleado reporte una falla desde la app, aparecerá aquí.
        </Vacio>
      )}
      {accion?.tipo === 'atender' && <Atender reporte={accion.reporte} onCerrar={() => setAccion(null)} onListo={listo} />}
      {accion?.tipo === 'reparacion' && <AReparacion reporte={accion.reporte} onCerrar={() => setAccion(null)} onListo={listo} />}
      {accion?.tipo === 'cerrar' && <Cerrar reporte={accion.reporte} onCerrar={() => setAccion(null)} onListo={listo} />}
    </>
  );
}

interface PropsAccion { reporte: ReporteFalla; onCerrar: () => void; onListo: () => void }
const subtitulo = (r: ReporteFalla) => `${r.equipo ? nombreEquipo(r.equipo) : 'Equipo'} | ${r.empleado?.nombre ?? ''}`;

function Atender({ reporte, onCerrar, onListo }: PropsAccion) {
  const { avisar } = useAvisos();
  const [respuesta, setRespuesta] = useState('');
  return (
    <FormModal titulo="Atender solicitud" sub={subtitulo(reporte)} boton="Marcar en atención" onCerrar={onCerrar} onEnviar={async () => {
      await api(`/reportes-falla/${reporte.id}/atender`, { cuerpo: { respuesta: respuesta.trim() || undefined } });
      avisar('Solicitud en atención');
      onListo();
    }}>
      <p className="sub" style={{ margin: 0 }}>El empleado verá en la app que su solicitud ya se está atendiendo.</p>
      <Campo etiqueta="Mensaje para el empleado" opcional>
        <textarea rows={3} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Por ejemplo: pasa a soporte hoy a las 4" />
      </Campo>
    </FormModal>
  );
}

function AReparacion({ reporte, onCerrar, onListo }: PropsAccion) {
  const { avisar } = useAvisos();
  const [motivo, setMotivo] = useState(reporte.descripcion);
  const [proveedor, setProveedor] = useState('');
  return (
    <FormModal titulo="Mandar a reparación" sub={subtitulo(reporte)} boton="Mandar a reparación" onCerrar={onCerrar} onEnviar={async () => {
      await api(`/reportes-falla/${reporte.id}/reparacion`, { cuerpo: { motivo: motivo.trim() || undefined, proveedor: proveedor.trim() || undefined } });
      avisar('Equipo enviado a reparación');
      onListo();
    }}>
      {reporte.equipo?.estatus === 'ASIGNADO' && (
        <p className="aviso temp" style={{ margin: 0 }}>Se registrará la devolución del equipo; seguirá ligado a {reporte.empleado?.nombre ?? 'el empleado'} mientras está en reparación.</p>
      )}
      <Campo etiqueta="Falla"><textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
      <Campo etiqueta="Proveedor" opcional><input value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></Campo>
    </FormModal>
  );
}

function Cerrar({ reporte, onCerrar, onListo }: PropsAccion) {
  const { avisar } = useAvisos();
  const [respuesta, setRespuesta] = useState('');
  return (
    <FormModal titulo="Cerrar solicitud" sub={subtitulo(reporte)} boton="Cerrar solicitud" onCerrar={onCerrar} onEnviar={async () => {
      await api(`/reportes-falla/${reporte.id}/cerrar`, { cuerpo: { respuesta } });
      avisar('Solicitud cerrada');
      onListo();
    }}>
      {reporte.reparacion && !reporte.reparacion.fechaRecepcion && (
        <p className="aviso temp" style={{ margin: 0 }}>El equipo sigue en reparación. Cerrar la solicitud no registra su regreso; hazlo desde la ficha del equipo.</p>
      )}
      <Campo etiqueta="¿Cómo se resolvió?">
        <textarea rows={3} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="El empleado verá esta respuesta en la app" />
      </Campo>
    </FormModal>
  );
}
