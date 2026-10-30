import { FormEvent, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, descargar, qs } from '../api';
import { agregarAColaResponsivas, limpiarNotasResponsiva, ofrecerCartaResponsiva, useColaResponsivas } from '../responsiva';
import { useCarga, useRetraso } from '../usar';
import { useSesion } from '../sesion';
import { AccesoEmpleado, Asignacion, EmpleadoDetalle, Equipo, EquipoListado, Estatus, ESTATUS, esJefeArea, etiquetaTipo, fecha, hoy, iniciales, nombreEquipo, Pagina, pluralTipo, claveDestino, claveDestinoDe, Ref, textoDestinatario, RESULTADOS, TipoEquipoCatalogo } from '../tipos';
import { BOTE, BUSCAR, Campo, Cargando, DatosEquipo, Destino, DESTINO_PROPIO, DestinoJefe, ErrorCarga, EtiquetaEquipo, FormModal, LAPIZ, Modal, MarcaTemporal, Pill, TarjetaEquipo, useAvisos, Vacio } from '../ui';
import EmpleadoForm from './EmpleadoForm';

interface EquipoCartaPerfil extends Pick<Equipo, 'id' | 'tipo' | 'descripcion' | 'marca' | 'modelo' | 'serie' | 'color' | 'codigoBarras' | 'tipoAdaptador'> {
  clave: string;
  registroClave: string;
  actual: boolean;
  fechaEntrega?: string | null;
  fechaDevolucion?: string | null;
  notas?: string | null;
  resultado?: Estatus | null;
}

export default function EmpleadoPagina() {
  const id = Number(useParams().id);
  const navegar = useNavigate();
  const { puedeEditar, esAdmin } = useSesion();
  const { avisar, confirmar } = useAvisos();
  const colaResponsivas = useColaResponsivas();
  const { datos: e, error, recargar } = useCarga(() => api<EmpleadoDetalle>(`/empleados/${id}`), [id]);
  const [ventana, setVentana] = useState<null | 'editar' | 'asignar'>(null);
  const [devolviendo, setDevolviendo] = useState<Equipo | null>(null);
  const [cartaAbierta, setCartaAbierta] = useState(false);
  const cerrar = () => setVentana(null);

  if (error) return <ErrorCarga mensaje={error} reintentar={recargar} />;
  if (!e) return <Cargando />;

  const intentar = async (fn: () => Promise<unknown>, msj: string) => {
    try { await fn(); avisar(msj); recargar(); } catch (err) { avisar((err as Error).message); }
  };
  const baja = async () => {
    const n = e.equiposActuales.filter((x) => x.estatus === 'ASIGNADO').length;
    const ligados = e.equiposActuales.filter((x) => ['DANADO', 'EN_REPARACION', 'RESGUARDO'].includes(x.estatus)).length;
    if (await confirmar({
      titulo: 'Dar de baja al empleado',
      mensaje: [
        n ? `${e.nombre} tiene ${n} ${n === 1 ? 'equipo asignado, que volverá' : 'equipos asignados, que volverán'} al inventario como disponible.` : `${e.nombre} quedará como dado de baja.`,
        ligados ? `${ligados === 1 ? 'El equipo dañado, en reparación o en resguardo quedará' : `Los ${ligados} equipos dañados, en reparación o en resguardo quedarán`} ligados a ${e.nombre} hasta que queden disponibles o se den de baja.` : '',
      ].filter(Boolean).join(' '),
      boton: 'Dar de baja', peligro: true,
    })) intentar(() => api(`/empleados/${e.id}/baja`, { cuerpo: {} }), 'Empleado dado de baja');
  };
  const eliminar = async () => {
    if (await confirmar({ titulo: 'Eliminar empleado', mensaje: `${e.nombre} se borrará para siempre.`, boton: 'Eliminar', peligro: true })) {
      try { await api(`/empleados/${e.id}`, { metodo: 'DELETE' }); avisar('Empleado eliminado'); navegar('/empleados'); } catch (err) { avisar((err as Error).message); }
    }
  };
  const asignacionActual = (equipoId: number) =>
    e.asignaciones.find((a) => a.equipoId === equipoId && !a.fechaDevolucion)
      ?? e.asignaciones.find((a) => a.equipoId === equipoId);
  const paraOtrosPuestos = e.equiposActuales.filter((x) => !!asignacionActual(x.id)?.puestoDestinatarioId);
  const equiposPropios = e.equiposActuales.filter((x) => !paraOtrosPuestos.some((otro) => otro.id === x.id));
  const mostrarEquipo = (x: Equipo) => {
    const vigente = asignacionActual(x.id);
    const temporal = !!vigente?.sustituyeEquipoId;
    const lado = (
      <>
        {x.estatus === 'ASIGNADO' ? <span className="sub">{fecha(vigente?.fechaEntrega)}</span> : <Pill estatus={x.estatus} />}
        {vigente?.puestoDestinatario && <span className="sub">Para {textoDestinatario(vigente.puestoDestinatario.nombre, vigente.nombreDestinatario)}</span>}
      </>
    );
    return puedeEditar
      ? <TarjetaEquipo key={x.id} e={x} lado={lado} temporal={temporal} onClick={() => setDevolviendo(x)} />
      : <TarjetaEquipo key={x.id} e={x} lado={lado} temporal={temporal} a={`/equipos/${x.id}`} />;
  };

  return (
    <>
      <Link className="migas" to="/empleados">Empleados</Link>
      <div className="encabezado">
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span className="av" style={{ width: 52, height: 52, fontSize: '1.2rem' }}>{iniciales(e.nombre)}</span>
          <div>
            <h1>{e.nombre}</h1>
            <span className="sub">{e.departamento?.nombre ?? 'Sin departamento'}{e.puesto ? ` | ${e.puesto.nombre}` : ''}{e.activo ? '' : ` | Dado de baja el ${fecha(e.fechaBaja)}`}</span>
          </div>
        </div>
        <div className="acciones">
          <button className="btn ghost" onClick={() => setCartaAbierta(true)}>Generar carta</button>
          {colaResponsivas.length > 0 && <Link className="btn ghost" to="/excel?cola=1">Revisar cola ({colaResponsivas.length})</Link>}
          {puedeEditar && e.activo && <button className="btn" onClick={() => setVentana('asignar')}>Asignar equipo del inventario</button>}
        </div>
      </div>

      <div className="detalle">
        <div>
          {equiposPropios.length > 0 && (
            <section className="panel">
              <h2>Equipos asignados ({equiposPropios.length})</h2>
              <div className="lista">
                {puedeEditar && <p className="sub" style={{ margin: 0 }}>Toca un equipo para registrar su devolución.</p>}
                {equiposPropios.map(mostrarEquipo)}
              </div>
            </section>
          )}
          {!equiposPropios.length && (
            <section className="panel">
              <h2>Equipos asignados (0)</h2>
              <Vacio titulo="Sin equipos asignados">{e.activo && puedeEditar ? 'Usa “Asignar equipo del inventario” para entregarle uno.' : null}</Vacio>
            </section>
          )}
          <section className="panel">
            <h2>Historial</h2>
            {e.asignaciones.length ? <TablaHistorial empleado={e} /> : <p className="sub" style={{ margin: 0 }}>Todavía no ha recibido equipos.</p>}
          </section>
        </div>
        <div>
          <section className="panel">
            <div className="panel-cab">
              <h2>Datos</h2>
              {puedeEditar && (
                <div className="acciones">
                  <button className="btn ghost icono" onClick={() => setVentana('editar')} title="Editar datos" aria-label="Editar datos">{LAPIZ}</button>
                  {e.activo
                    ? <button className="btn peligro icono" onClick={baja} title="Dar de baja" aria-label="Dar de baja">{BOTE}</button>
                    : <button className="btn ghost sm" onClick={() => intentar(() => api(`/empleados/${e.id}/reactivar`, { cuerpo: {} }), 'Empleado reactivado')}>Reactivar</button>}
                  {!e.activo && esAdmin && <button className="btn peligro icono" onClick={eliminar} title="Eliminar empleado" aria-label="Eliminar empleado">{BOTE}</button>}
                </div>
              )}
            </div>
            <dl className="dl">
              <dt>Nombre</dt><dd>{e.nombre}</dd>
              <dt>Departamento</dt><dd>{e.departamento?.nombre ?? '—'}</dd>
              <dt>Puesto</dt><dd>{e.puesto?.nombre ?? '—'}</dd>
              <dt>Número</dt><dd>{e.numero || '—'}</dd>
              <dt>Correo</dt><dd>{e.correo || '—'}</dd>
              {e.notas && <><dt>Notas</dt><dd>{e.notas}</dd></>}
              <dt>Estado</dt><dd>{e.activo ? 'Activo' : 'Dado de baja'}</dd>
            </dl>
          </section>
          {paraOtrosPuestos.length > 0 && (
            <section className="panel">
              <h2>Equipos para otros puestos ({paraOtrosPuestos.length})</h2>
              <p className="sub" style={{ margin: '0 0 12px' }}>Equipos bajo el resguardo de este jefe de área, destinados a personal de su departamento.</p>
              <div className="lista">{paraOtrosPuestos.map(mostrarEquipo)}</div>
            </section>
          )}
          {esAdmin && <AccesoApp key={String(e.activo)} empleado={e} />}
        </div>
      </div>

      {ventana === 'editar' && <EmpleadoForm empleado={e} onCerrar={cerrar} onGuardado={() => { cerrar(); recargar(); }} />}
      {ventana === 'asignar' && <ElegirEquipo empleado={e} onCerrar={cerrar} onListo={() => { cerrar(); recargar(); }} />}
      {devolviendo && <DevolverEquipo equipo={devolviendo} empleado={e} onCerrar={() => setDevolviendo(null)} onListo={() => { setDevolviendo(null); recargar(); }} />}
      {cartaAbierta && <CartaResponsivaPerfil empleado={e} onCerrar={() => setCartaAbierta(false)} />}
    </>
  );
}

/** Cuenta con la que el empleado entra a la app móvil para ver sus equipos y reportar fallas. */
function AccesoApp({ empleado: e }: { empleado: EmpleadoDetalle }) {
  const { avisar, confirmar } = useAvisos();
  const { datos: acceso, error, cargando, recargar } = useCarga(() => api<AccesoEmpleado | null>(`/empleados/${e.id}/acceso`), [e.id]);
  const [creando, setCreando] = useState(false);
  // La contraseña temporal solo se muestra una vez, justo después de crearla o restablecerla.
  const [clave, setClave] = useState<{ usuario: string; password: string } | null>(null);
  const cambiar = async (cuerpo: { activo?: boolean; restablecerPassword?: boolean }, mensaje: string) => {
    try {
      const r = await api<AccesoEmpleado>(`/empleados/${e.id}/acceso`, { metodo: 'PATCH', cuerpo });
      if (r.passwordTemporal) setClave({ usuario: r.usuario, password: r.passwordTemporal });
      avisar(mensaje);
      recargar();
    } catch (err) { avisar((err as Error).message); }
  };
  const restablecer = async () => {
    if (await confirmar({ titulo: 'Restablecer contraseña', mensaje: `Se generará una contraseña temporal nueva para ${e.nombre}; la anterior dejará de funcionar.`, boton: 'Restablecer' })) {
      cambiar({ restablecerPassword: true }, 'Contraseña restablecida');
    }
  };
  return (
    <section className="panel">
      <h2>Acceso a la app</h2>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : cargando && acceso === null ? <Cargando /> : acceso ? (
        <>
          <dl className="dl">
            <dt>Usuario</dt><dd className="mono">{acceso.usuario}</dd>
            <dt>Estado</dt><dd>{acceso.activo ? 'Activo' : 'Desactivado'}{acceso.activo && acceso.debeCambiarPassword && <span className="sub"> | falta cambiar la contraseña temporal</span>}</dd>
            <dt>Último acceso</dt><dd>{acceso.ultimoAcceso ? new Date(acceso.ultimoAcceso).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : 'Nunca ha entrado'}</dd>
          </dl>
          <div className="acciones izq" style={{ marginTop: 12 }}>
            {acceso.activo && <button className="btn ghost sm" onClick={restablecer}>Restablecer contraseña</button>}
            {acceso.activo
              ? <button className="btn peligro sm" onClick={() => cambiar({ activo: false }, 'Acceso desactivado')}>Desactivar acceso</button>
              : e.activo && <button className="btn ghost sm" onClick={() => cambiar({ activo: true }, 'Acceso activado')}>Activar acceso</button>}
          </div>
        </>
      ) : (
        <>
          <p className="sub" style={{ margin: '0 0 12px' }}>
            {e.activo ? 'Con una cuenta, el empleado puede ver sus equipos en la app móvil y reportar fallas. No podrá modificar nada.' : 'Reactiva al empleado para darle acceso a la app.'}
          </p>
          {e.activo && <button className="btn sm" onClick={() => setCreando(true)}>Crear acceso</button>}
        </>
      )}
      {creando && (
        <CrearAcceso empleado={e} onCerrar={() => setCreando(false)} onCreado={(r) => { setCreando(false); setClave({ usuario: r.usuario, password: r.passwordTemporal ?? '' }); recargar(); }} />
      )}
      {clave && <ClaveTemporal nombre={e.nombre} {...clave} onCerrar={() => setClave(null)} />}
    </section>
  );
}

function CrearAcceso({ empleado: e, onCerrar, onCreado }: { empleado: EmpleadoDetalle; onCerrar: () => void; onCreado: (r: AccesoEmpleado) => void }) {
  const [usuario, setUsuario] = useState(e.numero ?? '');
  return (
    <FormModal titulo="Crear acceso a la app" sub={e.nombre} boton="Crear acceso" onCerrar={onCerrar} onEnviar={async () => {
      onCreado(await api<AccesoEmpleado>(`/empleados/${e.id}/acceso`, { cuerpo: { usuario: usuario.trim() || undefined } }));
    }}>
      <Campo etiqueta="Usuario para entrar">
        <input value={usuario} onChange={(ev) => setUsuario(ev.target.value)} autoCapitalize="none" spellCheck={false} autoComplete="off" placeholder="Número de empleado" />
      </Campo>
      <p className="sub" style={{ margin: 0 }}>Se generará una contraseña temporal. El empleado deberá cambiarla la primera vez que entre.</p>
    </FormModal>
  );
}

function ClaveTemporal({ nombre, usuario, password, onCerrar }: { nombre: string; usuario: string; password: string; onCerrar: () => void }) {
  const { avisar } = useAvisos();
  const copiar = () => navigator.clipboard.writeText(`Usuario: ${usuario}\nContraseña temporal: ${password}`).then(() => avisar('Datos copiados'), () => avisar('No se pudo copiar'));
  return (
    <Modal titulo="Datos de acceso" sub={nombre} onCerrar={onCerrar}>
      <div className="form">
        <p className="aviso temp" style={{ margin: 0 }}>Anótalos o cópialos ahora: la contraseña temporal no se volverá a mostrar.</p>
        <dl className="dl">
          <dt>Usuario</dt><dd className="mono">{usuario}</dd>
          <dt>Contraseña temporal</dt><dd className="mono" style={{ fontSize: '1.15rem' }}>{password}</dd>
        </dl>
        <div className="acciones">
          <button type="button" className="btn ghost" onClick={copiar}>Copiar</button>
          <button type="button" className="btn" onClick={onCerrar}>Listo</button>
        </div>
      </div>
    </Modal>
  );
}

const FILAS_HISTORIAL = 5;

/** Historial de asignaciones: muestra las primeras filas y el resto con scroll. */
function TablaHistorial({ empleado: e }: { empleado: EmpleadoDetalle }) {
  const caja = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState<number>();
  // Las filas cambian de alto (notas, destinatario), así que se mide dónde termina la quinta.
  useLayoutEffect(() => {
    const medir = () => {
      const el = caja.current;
      const fila = el?.querySelectorAll('tbody tr')[FILAS_HISTORIAL - 1];
      setAlto(el && fila && el.querySelectorAll('tbody tr').length > FILAS_HISTORIAL
        ? Math.ceil(fila.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop)
        : undefined);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [e.asignaciones]);
  return (
    <div ref={caja} className="desliza historial-scroll" style={{ maxHeight: alto }}>
      <table className="tabla">
        <thead><tr><th>Equipo</th><th>Entregado</th><th>Devuelto</th><th>Estatus</th></tr></thead>
        <tbody>
          {e.asignaciones.map((a) => (
            <tr key={a.id}>
              <td>
                <Link to={`/equipos/${a.equipoId}`}>{a.equipo ? nombreEquipo(a.equipo) : 'Equipo'}</Link>{a.equipo?.serie && <span className="sub mono"> {a.equipo.serie}</span>}
                {a.puestoDestinatario && <span className="sub" style={{ display: 'block' }}>Para {textoDestinatario(a.puestoDestinatario.nombre, a.nombreDestinatario)}</span>}
                {a.notas && <span className="sub" style={{ display: 'block' }}>{a.notas}</span>}
              </td>
              <td>{fecha(a.fechaEntrega) || '—'}</td>
              <td>{a.fechaDevolucion ? fecha(a.fechaDevolucion) : <span className="sub">Vigente</span>}</td>
              <td><EstadoAsignacion a={a} empleadoId={e.id} historial={e.asignaciones} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CartaResponsivaPerfil({ empleado, onCerrar }: { empleado: EmpleadoDetalle; onCerrar: () => void }) {
  const { avisar } = useAvisos();
  const asignacionesVigentes = new Map(empleado.asignaciones.filter((a) => !a.fechaDevolucion).map((a) => [a.equipoId, a]));
  const equipos: EquipoCartaPerfil[] = [
    ...empleado.equiposActuales.filter((equipo) => equipo.estatus === 'ASIGNADO').map((equipo): EquipoCartaPerfil => {
      const asignacion = asignacionesVigentes.get(equipo.id);
      return {
        id: equipo.id,
        clave: `${empleado.id}-${equipo.id}`,
        registroClave: `actual-${equipo.id}`,
        actual: true,
        tipo: equipo.tipo,
        descripcion: equipo.descripcion,
        marca: equipo.marca,
        modelo: equipo.modelo,
        serie: equipo.serie,
        color: equipo.color,
        codigoBarras: equipo.codigoBarras,
        tipoAdaptador: equipo.tipoAdaptador,
        fechaEntrega: asignacion?.fechaEntrega,
        notas: limpiarNotasResponsiva(asignacion?.notas),
      };
    }),
    ...empleado.asignaciones.filter((a) => a.fechaDevolucion && a.equipo).flatMap((a): EquipoCartaPerfil[] => a.equipo ? [{
      id: a.equipo.id,
      clave: `${empleado.id}-${a.equipo.id}`,
      registroClave: `devolucion-${a.id}`,
      actual: false,
      tipo: a.equipo.tipo,
      descripcion: a.equipo.descripcion,
      marca: a.equipo.marca,
      modelo: a.equipo.modelo,
      serie: a.equipo.serie,
      color: a.equipo.color,
      codigoBarras: a.equipo.codigoBarras,
      tipoAdaptador: a.equipo.tipoAdaptador,
      fechaEntrega: a.fechaEntrega,
      fechaDevolucion: a.fechaDevolucion,
      notas: limpiarNotasResponsiva(a.notas),
      resultado: a.resultado,
    }] : []),
  ];
  const [seleccionados, setSeleccionados] = useState<string[]>(() => [...new Set(equipos.map((equipo) => equipo.clave))]);
  const [ocupado, setOcupado] = useState(false);
  const todosSeleccionados = equipos.length > 0 && equipos.every((equipo) => seleccionados.includes(equipo.clave));
  const entregas = equipos.filter((equipo) => equipo.actual && seleccionados.includes(equipo.clave)).length;
  const devoluciones = equipos.filter((equipo) => !equipo.actual && seleccionados.includes(equipo.clave)).length;
  const limiteSuperado = entregas > 12 || devoluciones > 11;
  const fechaCarta = hoy();

  const descargarCarta = async () => {
    setOcupado(true);
    try {
      const ids = [...new Set(equipos.filter((equipo) => seleccionados.includes(equipo.clave)).map((equipo) => equipo.clave))];
      await descargar(
        `/excel/responsivas?empleadoIds=${empleado.id}&equipoIds=${encodeURIComponent(ids.join(','))}`,
        `carta-responsiva-${empleado.id}.xlsx`,
      );
      avisar('Carta generada correctamente.');
      onCerrar();
    } catch (error) {
      avisar((error as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo="Vista previa de carta responsiva"
      sub={empleado.nombre}
      onCerrar={onCerrar}
      ancho
      clase="modal-responsivas"
    >
      <div className="responsiva-vista">
        <div className="responsiva-equipos-titulo">
          <span>Datos que aparecerán en la carta</span>
          <button
            type="button"
            className="btn ghost sm"
            onClick={() => setSeleccionados(todosSeleccionados ? [] : [...new Set(equipos.map((equipo) => equipo.clave))])}
            disabled={!equipos.length}
          >
            {todosSeleccionados ? 'Quitar selección' : 'Seleccionar todo'}
          </button>
        </div>
        <div className="responsiva-vista-lista">
          <section className="responsiva-equipos-persona">
            <h3>{empleado.nombre}</h3>
            <dl className="responsiva-datos-persona">
              <div><dt>Departamento</dt><dd>{empleado.departamento?.nombre ?? 'Sin departamento'}</dd></div>
              <div><dt>Puesto</dt><dd>{empleado.puesto?.nombre ?? '—'}</dd></div>
              <div><dt>Número</dt><dd>{empleado.numero || '—'}</dd></div>
              <div><dt>Fecha de la carta</dt><dd>{fecha(fechaCarta)}</dd></div>
              <div><dt>Folio</dt><dd>{empleado.id}-{fechaCarta.replace(/-/g, '')}</dd></div>
            </dl>
            <strong className="responsiva-lista-titulo">Equipos incluidos en la carta</strong>
            {equipos.length ? equipos.map((equipo) => (
              <label key={equipo.registroClave} className="responsiva-equipo">
                <input
                  type="checkbox"
                  checked={seleccionados.includes(equipo.clave)}
                  onChange={(event) => setSeleccionados((actuales) => event.target.checked
                    ? [...new Set([...actuales, equipo.clave])]
                    : actuales.filter((clave) => clave !== equipo.clave))}
                />
                <span>
                  <strong>{equipo.descripcion || etiquetaTipo(equipo.tipo)}{equipo.tipo === 'ADAPTADOR' && equipo.tipoAdaptador ? ` (${equipo.tipoAdaptador === 'RED' ? 'Red' : 'Multipuertos'})` : ''}</strong>
                  <span>Cantidad: 1 | Marca: {equipo.marca || '—'} | Modelo: {equipo.modelo || '—'} | Serie: {equipo.serie || '—'}</span>
                  <span className="sub">
                    {equipo.actual
                      ? `Asignado actualmente${equipo.fechaEntrega ? ` | Entregado: ${fecha(equipo.fechaEntrega)}` : ''}`
                      : `Devolución histórica${equipo.fechaDevolucion ? ` | Devuelto: ${fecha(equipo.fechaDevolucion)}` : ''}${equipo.resultado ? ` | ${RESULTADOS[equipo.resultado] ?? equipo.resultado}` : ''}`}
                    {equipo.notas ? ` | ${equipo.notas}` : ''}
                  </span>
                  <span className="sub">{seleccionados.includes(equipo.clave) ? 'Se incluirá en la carta' : 'No se incluirá'}</span>
                </span>
              </label>
            )) : <p className="sub">No hay equipos asignados ni devoluciones registradas.</p>}
          </section>
        </div>
        {limiteSuperado && <p className="error" role="alert">La plantilla permite hasta 12 equipos asignados y 11 devoluciones por carta. Desmarca equipos para continuar.</p>}
        <div className="responsiva-vista-acciones">
          <span className="sub">{entregas} equipos asignados · {devoluciones} devoluciones históricas</span>
          <button type="button" className="btn" onClick={descargarCarta} disabled={ocupado || limiteSuperado}>
            {ocupado ? 'Preparando carta…' : 'Generar y descargar carta'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Cómo se describe la devolución anterior cuando al empleado se le regresa el mismo equipo.
const ANTES: Partial<Record<Estatus, string>> = {
  DISPONIBLE: 'que devolvió', DANADO: 'que devolvió dañado', EN_REPARACION: 'que se mandó a reparación', RESGUARDO: 'que dejó en resguardo', BAJA: 'que se dio de baja',
};

/** Cómo terminó la asignación y, si cambió después, cómo está hoy el equipo. */
function EstadoAsignacion({ a, empleadoId, historial }: { a: Asignacion; empleadoId: number; historial: Asignacion[] }) {
  // Asignación anterior del mismo equipo a este empleado: significa que se le regresó.
  const previa = historial
    .filter((p) => p.equipoId === a.equipoId && p.id < a.id && p.fechaDevolucion)
    .reduce<Asignacion | undefined>((m, p) => (!m || p.id > m.id ? p : m), undefined);
  const regreso = previa && (
    <span className="sub" style={{ display: 'block' }}>
      Mismo equipo {ANTES[previa.resultado ?? 'DISPONIBLE'] ?? 'que devolvió'} el {fecha(previa.fechaDevolucion)}
    </span>
  );
  if (!a.fechaDevolucion) {
    return <><span className={`pill ${ESTATUS.ASIGNADO.clase}`}>{previa ? 'Se le regresó' : 'Asignado'}</span>{regreso}</>;
  }
  const r = a.resultado && RESULTADOS[a.resultado] ? a.resultado : 'DISPONIBLE';
  const actual = a.equipo?.estatus;
  let hoyTexto = '';
  if (actual === 'ASIGNADO') hoyTexto = a.equipo?.empleadoId === empleadoId ? 'se le volvió a entregar' : 'asignado a otra persona';
  else if (actual && actual !== r) hoyTexto = ESTATUS[actual].nombre.toLowerCase();
  return (
    <>
      <span className={`pill ${ESTATUS[r].clase}`}>{RESULTADOS[r]}</span>
      {regreso}
      {hoyTexto && <span className="sub" style={{ display: 'block' }}>Hoy: {hoyTexto}</span>}
    </>
  );
}

function DevolverEquipo({ equipo, empleado: emp, onCerrar, onListo }: { equipo: Equipo; empleado: EmpleadoDetalle; onCerrar: () => void; onListo: () => void }) {
  const { avisar, avisarEstatus, confirmar } = useAvisos();
  const empleado = emp.nombre;
  // Relación temporal: a quién sustituye este equipo, o quién lo sustituye a él mientras está dañado.
  const sustituyeId = emp.asignaciones.find((a) => a.equipoId === equipo.id && !a.fechaDevolucion)?.sustituyeEquipoId;
  const sustituye = sustituyeId ? emp.equiposActuales.find((x) => x.id === sustituyeId) : undefined;
  const sustitutos = emp.asignaciones
    .filter((a) => a.sustituyeEquipoId === equipo.id && !a.fechaDevolucion)
    .map((a) => emp.equiposActuales.find((x) => x.id === a.equipoId))
    .filter((x): x is Equipo => !!x);
  const [fechaDev, setFechaDev] = useState(hoy());
  const [estatus, setEstatus] = useState<'DISPONIBLE' | 'DANADO' | 'RESGUARDO'>('DISPONIBLE');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const nombre = nombreEquipo(equipo);
  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    if (estatus === 'DANADO' && !notas.trim()) { setError('Describe la falla en el comentario.'); return; }
    setOcupado(true);
    try {
      await api('/asignaciones/devolucion', { cuerpo: { equipoId: equipo.id, fecha: fechaDev, estatus, notas: notas.trim() || undefined } });
      onListo();
      await ofrecerCartaResponsiva(emp.id, confirmar, avisar);
      avisarEstatus(nombre, estatus);
    } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  };
  return (
    <Modal
      titulo={nombre}
      sub={<>{empleado}{equipo.serie && <> | <span className="mono">{equipo.serie}</span></>} | <Link to={`/equipos/${equipo.id}`}>Ver ficha</Link></>}
      onCerrar={onCerrar}
      ancho
      clase={abierto ? 'con-lateral' : undefined}
    >
      <div className={`ficha-lateral${abierto ? ' abierta' : ''}`}>
        <section className="panel">
          <h2>{etiquetaTipo(equipo.tipo)} | <Pill estatus={equipo.estatus} />{sustituyeId && <MarcaTemporal />}</h2>
          {sustituyeId && (
            <p className="aviso temp">
              Asignado temporalmente en lugar de <b>{sustituye ? nombreEquipo(sustituye) : 'su equipo'}</b>{sustituye && ` (${ESTATUS[sustituye.estatus].nombre.toLowerCase()})`}.
              Cuando el equipo original quede disponible o se dé de baja, este dejará de ser temporal.
            </p>
          )}
          {sustitutos.length > 0 && (
            <p className="aviso temp">Mientras tanto usa temporalmente <b>{sustitutos.map(nombreEquipo).join(', ')}</b>.</p>
          )}
          {equipo.codigoBarras && <EtiquetaEquipo codigo={equipo.codigoBarras} />}
          <DatosEquipo e={equipo} />
          {equipo.estatus !== 'ASIGNADO' && (
            <p className="sub" style={{ margin: '14px 0 0' }}>
              Ya se recibió y sigue ligado a {empleado} mientras esté {ESTATUS[equipo.estatus].nombre.toLowerCase()}. Se desliga al marcarlo disponible o darlo de baja desde su ficha.
            </p>
          )}
          {!abierto && equipo.estatus === 'ASIGNADO' && (
            <div className="acciones" style={{ marginTop: 14 }}>
              <button type="button" className="btn" onClick={() => setAbierto(true)}>Registrar devolución</button>
            </div>
          )}
        </section>
        {abierto && (
          <form className="form lateral" onSubmit={enviar} noValidate>
            <h3 style={{ margin: 0 }}>Registrar devolución</h3>
            <Campo etiqueta="Fecha de devolución"><input type="date" value={fechaDev} max={hoy()} onChange={(ev) => setFechaDev(ev.target.value)} /></Campo>
            <Campo etiqueta="Estado en que se recibe">
              <select value={estatus} onChange={(ev) => setEstatus(ev.target.value as 'DISPONIBLE' | 'DANADO' | 'RESGUARDO')}>
                <option value="DISPONIBLE">Disponible (funciona bien)</option>
                <option value="DANADO">Dañado</option>
                <option value="RESGUARDO">En resguardo</option>
              </select>
            </Campo>
            <Campo etiqueta="Comentario" opcional={estatus !== 'DANADO'}>
              <textarea rows={3} value={notas} onChange={(ev) => setNotas(ev.target.value)} placeholder={estatus === 'DANADO' ? 'Qué falla tiene el equipo' : estatus === 'RESGUARDO' ? 'Observaciones del resguardo' : 'Observaciones de la devolución'} />
            </Campo>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="acciones">
              <button type="button" className="btn ghost" onClick={() => { setAbierto(false); setError(''); }}>Cancelar</button>
              <button className="btn" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Registrar devolución'}</button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

function ElegirEquipo({ empleado, onCerrar, onListo }: { empleado: EmpleadoDetalle; onCerrar: () => void; onListo: () => void }) {
  const { avisar } = useAvisos();
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('');
  const [destino, setDestino] = useState<Destino>(DESTINO_PROPIO);
  const [fechaEntrega, setFecha] = useState(hoy());
  const [error, setError] = useState('');
  const q = useRetraso(texto);
  const { datos } = useCarga(() => api<Pagina<EquipoListado>>(`/equipos${qs({ estatus: 'DISPONIBLE', q, tipo, limite: 100 })}`), [q, tipo]);
  const tipos = useCarga(() => api<TipoEquipoCatalogo[]>('/catalogos/tipos-equipo'), []);
  const puedeAsignarParaPuesto = esJefeArea(empleado.puesto?.nombre) && !!empleado.departamentoId;
  const puestos = useCarga(
    () => puedeAsignarParaPuesto ? api<Ref[]>(`/departamentos/${empleado.departamentoId}/puestos`) : Promise.resolve([]),
    [puedeAsignarParaPuesto, empleado.departamentoId],
  );
  const puestoNombre = puestos.datos?.find((p) => String(p.id) === destino.puestoId)?.nombre;
  const puestoDestinatarioId = destino.paraOtro && destino.puestoId ? Number(destino.puestoId) : null;
  const persona = destino.persona.trim();
  const quien = puestoDestinatarioId ? (persona ? `${persona} (${puestoNombre})` : `El puesto ${puestoNombre} (sin nombre)`) : empleado.nombre;
  // Las reglas por tipo se revisan para quien usará el equipo: el jefe o la persona de su departamento.
  const clave = claveDestino(puestoDestinatarioId, persona);
  const delDestino = empleado.equiposActuales.filter((x) => claveDestinoDe(empleado, x.id) === clave);
  // Tipos que ya tiene asignados: no puede recibir otro igual, salvo si sustituye un equipo ligado.
  const enUso = delDestino.filter((x) => x.estatus === 'ASIGNADO' && x.tipo !== 'OTRO');
  const ocupados = [...new Set(enUso.map((x) => x.tipo))];
  const faltaPuesto = destino.paraOtro && !puestoDestinatarioId;
  const opciones = faltaPuesto ? [] : (datos?.datos ?? []).filter((x) => !ocupados.includes(x.tipo));
  const tipoElegido = tipo;
  const yaTieneElegido = tipoElegido ? enUso.filter((x) => x.tipo === tipoElegido) : [];
  // Equipos ligados sin sustituto: un equipo nuevo del mismo tipo se asigna temporalmente.
  const sustituibles = delDestino.filter(
    (x) => ['DANADO', 'EN_REPARACION', 'RESGUARDO'].includes(x.estatus) && !empleado.asignaciones.some((a) => a.sustituyeEquipoId === x.id && !a.fechaDevolucion),
  );
  const elegir = async (equipoId: number, nombre: string) => {
    try {
      await api('/asignaciones', { cuerpo: { equipoId, empleadoId: empleado.id, fechaEntrega, puestoDestinatarioId: puestoDestinatarioId ?? undefined, nombreDestinatario: puestoDestinatarioId && persona ? persona : undefined } });
      const enCola = agregarAColaResponsivas(empleado.id);
      avisar(enCola
        ? `${nombre} asignado y ${empleado.nombre} agregado a la cola de cartas`
        : `${nombre} asignado, pero no se pudo guardar a ${empleado.nombre} en la cola de cartas`);
      onListo();
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <Modal titulo={`Asignar equipo a ${empleado.nombre}`} sub={puestoDestinatarioId ? `Queda bajo su responsabilidad para ${persona || `el ${puestoNombre?.toLowerCase()}`}` : 'Solo se muestran equipos disponibles'} onCerrar={onCerrar} ancho>
      <div className="form">
        <div className="dos-col">
          <Campo etiqueta="Fecha de entrega"><input type="date" value={fechaEntrega} onChange={(e) => setFecha(e.target.value)} /></Campo>
          <Campo etiqueta="Tipo">
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {(tipos.datos ?? []).map((t) => <option key={t.nombre} value={t.nombre}>{etiquetaTipo(t.nombre)}{ocupados.includes(t.nombre) ? ' (ya tiene)' : ''}</option>)}
            </select>
          </Campo>
          {puedeAsignarParaPuesto && (
            <DestinoJefe
              jefe={empleado.nombre}
              puestos={puestos.datos}
              destino={destino}
              onCambio={(d) => { setDestino(d); setError(''); }}
            />
          )}
        </div>
        {puestos.error && <ErrorCarga mensaje={puestos.error} reintentar={puestos.recargar} />}
        {tipos.error && <ErrorCarga mensaje={tipos.error} reintentar={tipos.recargar} />}
        {!faltaPuesto && !tipoElegido && enUso.length > 0 && (
          <div className="aviso ya" style={{ margin: 0 }}>
            <b>{quien} ya tiene asignado:</b>
            <ul>{enUso.map((x) => <li key={x.id}><b>{etiquetaTipo(x.tipo)}</b>: {nombreEquipo(x)}{x.serie && <span className="mono"> {x.serie}</span>}</li>)}</ul>
            <span className="sub">
              No se muestran esos tipos. Solo puede recibir otro igual si el anterior está dañado, en reparación, en resguardo o dado de baja.
              {puedeAsignarParaPuesto && !puestoDestinatarioId && ' Si el equipo es para alguien más, elige “Para otra persona de su departamento”.'}
              {puestoDestinatarioId && !persona && ' Si es para otra persona del mismo puesto, escribe su nombre.'}
            </span>
          </div>
        )}
        {sustituibles.length > 0 && (
          <p className="aviso temp" style={{ margin: 0 }}>
            Tiene {sustituibles.map((x) => `${nombreEquipo(x)} (${ESTATUS[x.estatus].nombre.toLowerCase()})`).join(', ')}. Si le asignas otro equipo del mismo tipo, quedará como <b>temporal</b>.
          </p>
        )}
        <label className="buscar">{BUSCAR}<input className="entrada" type="search" placeholder="Buscar por serie, marca, modelo o código" value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar equipo" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="lista-elegir">
          {opciones.map((x) => <TarjetaEquipo key={x.id} e={x} onClick={() => elegir(x.id, nombreEquipo(x))} />)}
          {faltaPuesto && <p className="sub">Selecciona el puesto de quien usará el equipo para ver los equipos disponibles.</p>}
          {datos && !faltaPuesto && !opciones.length && (
            yaTieneElegido.length ? (
              <div className="aviso ya" role="status" style={{ margin: 0 }}>
                <b>{quien} ya tiene {etiquetaTipo(yaTieneElegido[0].tipo).toLowerCase()} asignado:</b> {yaTieneElegido.map(nombreEquipo).join(', ')}.
                <span className="sub" style={{ display: 'block' }}>Solo puede recibir otro si el anterior está dañado, en reparación, en resguardo o dado de baja.</span>
              </div>
            ) : tipoElegido && !q ? (
              <div className="aviso err" role="status" style={{ margin: 0 }}>
                <b>No hay {pluralTipo(tipoElegido)} disponibles.</b>
                <span className="sub" style={{ display: 'block' }}>Todos están asignados, dañados o en reparación. Registra uno nuevo o recibe una devolución para poder asignarlo.</span>
              </div>
            ) : <p className="sub">No hay equipos disponibles con ese filtro.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
