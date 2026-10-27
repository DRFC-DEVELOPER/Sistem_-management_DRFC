import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, descargar } from '../api';
import { descargarEtiquetasPdf, OpcionesEtiquetas, OrdenEtiquetas } from '../etiquetasPdf';
import { leerColaResponsivas, limpiarNotasResponsiva, quitarDeColaResponsivas, useColaResponsivas, vaciarColaResponsivas } from '../responsiva';
import { useSesion } from '../sesion';
import { Asignacion, EmpleadoDetalle, EmpleadoListado, Equipo, Ref, etiquetaTipo, hoy } from '../tipos';
import { Campo, Modal, useAvisos } from '../ui';
import { useCarga } from '../usar';

interface Analisis {
  filas: number; empleadosNuevos: number; equiposNuevos: number; asignados: number;
  porTipo: Record<string, number>; omitidos: string[]; avisos: string[]; muestraEmpleados: string[];
}

interface EquipoCartaSeleccion extends Pick<Equipo, 'id' | 'tipo' | 'marca' | 'modelo' | 'serie'> {
  descripcion?: string | null;
  color?: string | null;
  codigoBarras?: string | null;
  tipoAdaptador?: Equipo['tipoAdaptador'];
  estatus?: Equipo['estatus'];
  actual: boolean;
  clave: string;
  registroClave: string;
  fechaEntrega?: string | null;
  fechaDevolucion?: string | null;
  notas?: string | null;
  resultado?: Asignacion['resultado'];
}

const RESULTADOS_CARTA: Record<string, string> = {
  DISPONIBLE: 'Devuelto disponible',
  DANADO: 'Devuelto dañado',
  EN_REPARACION: 'Enviado a reparación',
  BAJA: 'Dado de baja',
};

export default function Excel() {
  const { puedeEditar } = useSesion();
  const { avisar } = useAvisos();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [analisis, setAnalisis] = useState<Analisis | null>(null);
  const [resultado, setResultado] = useState<Analisis | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState<'' | 'analizar' | 'importar' | 'exportar'>('');

  const form = (f: File) => { const d = new FormData(); d.append('archivo', f); return d; };
  const elegir = async (ev: ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    setArchivo(f); setAnalisis(null); setResultado(null); setError(''); setOcupado('analizar');
    try { setAnalisis(await api<Analisis>('/excel/analizar', { formulario: form(f) })); } catch (e) { setError((e as Error).message); } finally { setOcupado(''); }
  };
  const importar = async () => {
    if (!archivo) return;
    setOcupado('importar'); setError('');
    try {
      const r = await api<Analisis>('/excel/importar', { formulario: form(archivo) });
      setResultado(r); setAnalisis(null); setArchivo(null);
      avisar(`Importados ${r.equiposNuevos} equipos y ${r.empleadosNuevos} empleados`);
    } catch (e) { setError((e as Error).message); } finally { setOcupado(''); }
  };
  const exportar = async () => {
    setOcupado('exportar');
    try { await descargar('/excel/exportar', 'inventario-equipos.xlsx'); avisar('Excel descargado'); } catch (e) { avisar((e as Error).message); } finally { setOcupado(''); }
  };

  return (
    <>
      <div className="encabezado"><h1>Excel</h1></div>
      <div className="rejilla excel-rejilla" style={{ marginTop: 0 }}>
        <div className="excel-columna">
          <section className="panel">
            <h2>Exportar inventario</h2>
            <p style={{ marginTop: 0 }}>Descarga un Excel con el mismo formato de columnas que usas hoy, más una hoja con la lista completa de equipos.</p>
            <button className="btn ghost" onClick={exportar} disabled={!!ocupado}>{ocupado === 'exportar' ? 'Preparando…' : 'Descargar Excel'}</button>
          </section>
          {puedeEditar && (
            <section className="panel importacion">
            <h2>Importar desde Excel</h2>
            <p style={{ marginTop: 0 }}>
              Sube un archivo .xlsx con el formato de tu inventario (la primera hoja, con la columna USUARIO). Antes de guardar te mostramos qué se va a crear.
              Los equipos cuyo número de serie ya existe se omiten.
            </p>
            <input ref={entrada} type="file" accept=".xlsx" hidden onChange={elegir} />
            <button className="btn" onClick={() => entrada.current?.click()} disabled={!!ocupado}>{ocupado === 'analizar' ? 'Revisando archivo…' : 'Elegir archivo'}</button>
            {error && <p className="error" role="alert" style={{ marginTop: 12 }}>{error}</p>}

            {analisis && (
              <div style={{ marginTop: 16 }}>
                <p className="sub" style={{ marginTop: 0 }}>{archivo?.name}</p>
                <Resumen a={analisis} />
                {analisis.equiposNuevos + analisis.empleadosNuevos > 0 ? (
                  <div className="acciones izq">
                    <button className="btn ghost" onClick={() => { setAnalisis(null); setArchivo(null); }}>Cancelar</button>
                    <button className="btn" onClick={importar} disabled={!!ocupado}>{ocupado === 'importar' ? 'Importando…' : `Importar ${analisis.equiposNuevos} equipos`}</button>
                  </div>
                ) : <p className="aviso">Este archivo no tiene datos nuevos: todo ya está en el inventario.</p>}
              </div>
            )}
            {resultado && (
              <div className="aviso ok" style={{ marginTop: 16 }}>
                Importación lista: {resultado.equiposNuevos} equipos ({resultado.asignados} asignados) y {resultado.empleadosNuevos} empleados nuevos.{' '}
                <Link to="/equipos">Ver equipos</Link>
              </div>
            )}
            </section>
          )}
        </div>
        <div className="excel-columna">
          <PanelResponsiva />
          <PanelEtiquetas />
        </div>
      </div>
    </>
  );
}

function PanelResponsiva() {
  const { avisar } = useAvisos();
  const cola = useColaResponsivas();
  const [colaCargada, setColaCargada] = useState(() =>
    new URLSearchParams(window.location.search).get('cola') === '1' && leerColaResponsivas().length > 0,
  );
  const [modalColaAbierto, setModalColaAbierto] = useState(() =>
    new URLSearchParams(window.location.search).get('cola') === '1' && leerColaResponsivas().length > 0,
  );
  const [departamentoId, setDepartamentoId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [empleadosSeleccionados, setEmpleadosSeleccionados] = useState<number[]>(() =>
    new URLSearchParams(window.location.search).get('cola') === '1' ? leerColaResponsivas() : [],
  );
  const [equiposSeleccionados, setEquiposSeleccionados] = useState<string[]>([]);
  const [empleadosEquiposInicializados, setEmpleadosEquiposInicializados] = useState<number[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const deptos = useCarga(() => api<Ref[]>('/departamentos'), []);
  const empleados = useCarga(() => api<EmpleadoListado[]>('/empleados'), []);
  const seleccionIds = empleadosSeleccionados.join(',');
  const detallesEmpleados = useCarga(
    () => seleccionIds
      ? Promise.all(empleadosSeleccionados.map((id) => api<EmpleadoDetalle>(`/empleados/${id}`)))
      : Promise.resolve([]),
    [seleccionIds],
  );
  const departamentoCoincide = (e: EmpleadoListado) =>
    !departamentoId || (departamentoId === 'sin-departamento' ? e.departamentoId === null : String(e.departamentoId) === departamentoId);
  const termino = busqueda.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const coincidencias = (empleados.datos ?? []).filter((e) =>
    departamentoCoincide(e)
    && e.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(termino),
  );
  const seleccionados = (empleados.datos ?? []).filter((e) => empleadosSeleccionados.includes(e.id));
  const disponibles = coincidencias.filter((e) => !empleadosSeleccionados.includes(e.id));
  const detallesSeleccionados = (detallesEmpleados.datos ?? []).filter((e) => empleadosSeleccionados.includes(e.id));
  const equiposPorEmpleado = detallesSeleccionados.map((empleado) => {
    const equipos: EquipoCartaSeleccion[] = [];
    const asignacionesVigentes = new Map(empleado.asignaciones.filter((a) => !a.fechaDevolucion).map((a) => [a.equipoId, a]));
    empleado.equiposActuales.filter((e) => e.estatus === 'ASIGNADO').forEach((e) => {
      equipos.push({
        id: e.id, tipo: e.tipo, marca: e.marca, modelo: e.modelo, serie: e.serie, descripcion: e.descripcion,
        color: e.color, codigoBarras: e.codigoBarras, tipoAdaptador: e.tipoAdaptador, estatus: e.estatus,
        actual: true, clave: `${empleado.id}-${e.id}`, registroClave: `actual-${e.id}`,
        fechaEntrega: asignacionesVigentes.get(e.id)?.fechaEntrega,
        notas: limpiarNotasResponsiva(asignacionesVigentes.get(e.id)?.notas),
      });
    });
    empleado.asignaciones.filter((a) => a.fechaDevolucion && a.equipo).forEach((a) => {
      if (!a.equipo) return;
      equipos.push({
        ...a.equipo, actual: false, clave: `${empleado.id}-${a.equipo.id}`, registroClave: `devolucion-${a.id}`,
        fechaEntrega: a.fechaEntrega, fechaDevolucion: a.fechaDevolucion, notas: limpiarNotasResponsiva(a.notas), resultado: a.resultado,
      });
    });
    return { empleado, equipos };
  });
  const todosLosEquipos = [...new Set(equiposPorEmpleado.flatMap(({ equipos }) => equipos.map((e) => e.clave)))];
  const todosLosEquiposSeleccionados = todosLosEquipos.length > 0 && todosLosEquipos.every((clave) => equiposSeleccionados.includes(clave));
  const departamentosElegidos = new Set(detallesSeleccionados.map((empleado) => empleado.departamentoId));
  const mismoDepartamento = departamentosElegidos.size <= 1;
  const fechaCarta = hoy();
  const limiteSuperado = equiposPorEmpleado.some(({ equipos }) => {
    const incluidos = equipos.filter((equipo) => equiposSeleccionados.includes(equipo.clave));
    return incluidos.filter((equipo) => equipo.actual).length > 12
      || incluidos.filter((equipo) => !equipo.actual).length > 11;
  });

  useEffect(() => {
    if (!detallesEmpleados.datos) return;
    const nuevos = equiposPorEmpleado.filter(({ empleado }) => !empleadosEquiposInicializados.includes(empleado.id));
    if (!nuevos.length) return;
    const equiposNuevos = nuevos.flatMap(({ equipos }) => equipos.map((e) => e.clave));
    setEquiposSeleccionados((actuales) => [...new Set([...actuales, ...equiposNuevos])]);
    setEmpleadosEquiposInicializados((actuales) => [...new Set([...actuales, ...nuevos.map(({ empleado }) => empleado.id)])]);
  }, [detallesEmpleados.datos]);

  const agregarEmpleado = (id: number) => {
    const elegido = disponibles.find((e) => e.id === id);
    if (!elegido) return;
    setDepartamentoId(elegido.departamentoId === null ? 'sin-departamento' : String(elegido.departamentoId));
    setEmpleadosSeleccionados((actuales) => [...actuales, elegido.id]);
    setBusqueda('');
  };
  const quitarEmpleado = (id: number) => {
    setEmpleadosSeleccionados((actuales) => actuales.filter((seleccionado) => seleccionado !== id));
    const prefijo = `${id}-`;
    setEquiposSeleccionados((actuales) => actuales.filter((clave) => !clave.startsWith(prefijo)));
    setEmpleadosEquiposInicializados((actuales) => actuales.filter((empleadoId) => empleadoId !== id));
  };
  const cargarCola = () => {
    const ids = leerColaResponsivas();
    if (!ids.length) return;
    setEmpleadosSeleccionados(ids);
    setEquiposSeleccionados([]);
    setEmpleadosEquiposInicializados([]);
    setColaCargada(true);
    setModalColaAbierto(true);
  };
  const vaciarColaPendiente = () => {
    if (!vaciarColaResponsivas()) {
      avisar('No se pudo vaciar la cola de cartas.');
      return;
    }
    if (colaCargada) {
      setEmpleadosSeleccionados([]);
      setEquiposSeleccionados([]);
      setEmpleadosEquiposInicializados([]);
    }
    setColaCargada(false);
    setModalColaAbierto(false);
  };
  const cambiarTodosLosEquipos = () => {
    setEquiposSeleccionados((actuales) => todosLosEquiposSeleccionados
      ? actuales.filter((id) => !todosLosEquipos.includes(id))
      : [...new Set([...actuales, ...todosLosEquipos])]);
  };
  const cambiarEquipo = (id: string, incluido: boolean) => {
    setEquiposSeleccionados((actuales) => incluido
      ? [...new Set([...actuales, id])]
      : actuales.filter((seleccionado) => seleccionado !== id));
  };

  const descargarCarta = async () => {
    if (!empleadosSeleccionados.length) return;
    setOcupado(true);
    try {
      const ruta = `/excel/responsivas?empleadoIds=${empleadosSeleccionados.join(',')}&equipoIds=${equiposSeleccionados.join(',')}`;
      await descargar(ruta, 'cartas-responsivas.xlsx');
      if (colaCargada) {
        if (!quitarDeColaResponsivas(empleadosSeleccionados)) avisar('Las cartas se generaron correctamente, pero no se pudo actualizar la cola.');
        else avisar(`Se generaron correctamente ${empleadosSeleccionados.length} ${empleadosSeleccionados.length === 1 ? 'carta' : 'cartas'}.`);
        setColaCargada(false);
        setModalColaAbierto(false);
        setEmpleadosSeleccionados([]);
        setEquiposSeleccionados([]);
        setEmpleadosEquiposInicializados([]);
      } else {
        avisar(`Se generaron correctamente ${empleadosSeleccionados.length} ${empleadosSeleccionados.length === 1 ? 'carta' : 'cartas'}.`);
      }
    } catch (e) {
      avisar((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="panel">
      <h2>Carta responsiva</h2>
      <p style={{ marginTop: 0 }}>Filtra por departamento y nombre. Selecciona una o varias personas del mismo departamento para incluir una carta por hoja, con sus equipos asignados y el historial de devoluciones. La fecha de cada carta es la fecha en que se genera el Excel.</p>
      <div className="responsiva-cola">
        <div>
          <strong>Cola de altas</strong>
          <span className="sub">{cola.length} {cola.length === 1 ? 'persona pendiente' : 'personas pendientes'}</span>
        </div>
        <div className="acciones">
          <button type="button" className="btn ghost sm" onClick={cargarCola} disabled={!cola.length}>
            Vista previa desde cola
          </button>
          <button type="button" className="btn ghost sm" onClick={vaciarColaPendiente} disabled={!cola.length}>Vaciar cola</button>
        </div>
      </div>
      {!colaCargada && <div className="form">
        <Campo etiqueta="Departamento">
          <select value={departamentoId} onChange={(e) => {
            setDepartamentoId(e.target.value);
            setEmpleadosSeleccionados([]);
            setEquiposSeleccionados([]);
            setEmpleadosEquiposInicializados([]);
            setBusqueda('');
          }}>
            <option value="">Todos los departamentos</option>
            {(deptos.datos ?? []).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            <option value="sin-departamento">Sin departamento</option>
          </select>
        </Campo>
        <div className="campo">
          <label htmlFor="buscar-empleado-responsiva">Buscar por nombre</label>
          <input
            id="buscar-empleado-responsiva"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Escribe el nombre del empleado"
            aria-label="Buscar empleado para agregar"
            aria-expanded={!!termino}
            aria-controls="resultados-empleados-responsiva"
          />
          {termino && (
            <div className="responsiva-resultados" id="resultados-empleados-responsiva" role="list" aria-label="Empleados disponibles">
              {disponibles.slice(0, 20).map((e) => (
                <div className="responsiva-resultado" key={e.id} role="listitem">
                  <span>{e.nombre}<span className="sub">{e.departamento?.nombre ?? 'Sin departamento'}</span></span>
                  <button
                    type="button"
                    className="btn ghost sm"
                    onClick={() => agregarEmpleado(e.id)}
                    aria-label={`Agregar a ${e.nombre}`}
                    title={`Agregar a ${e.nombre}`}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              ))}
              {empleados.error && <p className="error" role="alert">{empleados.error}</p>}
              {empleados.datos && !disponibles.length && <p className="sub">No hay personas disponibles que coincidan en este departamento.</p>}
              {disponibles.length > 20 && <p className="sub">Escribe más letras para ver resultados más específicos.</p>}
            </div>
          )}
        </div>
        {deptos.error && <p className="error" role="alert">{deptos.error}</p>}
        {empleados.error && <p className="error" role="alert">{empleados.error}</p>}
        <Campo etiqueta="Personas seleccionadas">
          {seleccionados.length > 0 ? (
            <div className="responsiva-seleccionados">
              {seleccionados.map((e) => (
                <div key={e.id} className="responsiva-seleccionado">
                  <span>{e.nombre}<span className="sub">{e.departamento?.nombre ?? 'Sin departamento'}</span></span>
                  <button type="button" className="btn ghost sm" onClick={() => quitarEmpleado(e.id)} aria-label={`Quitar a ${e.nombre}`} title={`Quitar a ${e.nombre}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                  </button>
                </div>
              ))}
            </div>
          ) : <p className="sub">Elige una persona para comenzar. Las demás deberán ser del mismo departamento.</p>}

        </Campo>
        {empleadosSeleccionados.length > 0 && (
          <VistaPreviaResponsiva
            personas={equiposPorEmpleado}
            equiposSeleccionados={equiposSeleccionados}
            todosLosEquiposSeleccionados={todosLosEquiposSeleccionados}
            hayEquipos={todosLosEquipos.length > 0}
            cargando={detallesEmpleados.cargando}
            error={detallesEmpleados.error}
            mismoDepartamento={mismoDepartamento}
            limiteSuperado={limiteSuperado}
            ocupado={ocupado}
            fechaCarta={fechaCarta}
            onCambiarTodos={cambiarTodosLosEquipos}
            onCambiarEquipo={cambiarEquipo}
            onQuitarEmpleado={quitarEmpleado}
            onDescargar={descargarCarta}
          />
        )}
      </div>}
      {colaCargada && modalColaAbierto && (
        <Modal
          titulo="Vista previa de cartas responsivas"
          sub={`${empleadosSeleccionados.length} ${empleadosSeleccionados.length === 1 ? 'persona' : 'personas'} en la cola`}
          onCerrar={() => setModalColaAbierto(false)}
          ancho
          clase="modal-responsivas"
        >
          <VistaPreviaResponsiva
            personas={equiposPorEmpleado}
            equiposSeleccionados={equiposSeleccionados}
            todosLosEquiposSeleccionados={todosLosEquiposSeleccionados}
            hayEquipos={todosLosEquipos.length > 0}
            cargando={detallesEmpleados.cargando}
            error={detallesEmpleados.error}
            mismoDepartamento={mismoDepartamento}
            limiteSuperado={limiteSuperado}
            ocupado={ocupado}
            fechaCarta={fechaCarta}
            onCambiarTodos={cambiarTodosLosEquipos}
            onCambiarEquipo={cambiarEquipo}
            onQuitarEmpleado={quitarEmpleado}
            onDescargar={descargarCarta}
          />
        </Modal>
      )}
    </section>
  );
}

function VistaPreviaResponsiva({
  personas,
  equiposSeleccionados,
  todosLosEquiposSeleccionados,
  hayEquipos,
  cargando,
  error,
  mismoDepartamento,
  limiteSuperado,
  ocupado,
  fechaCarta,
  onCambiarTodos,
  onCambiarEquipo,
  onQuitarEmpleado,
  onDescargar,
}: {
  personas: { empleado: EmpleadoDetalle; equipos: EquipoCartaSeleccion[] }[];
  equiposSeleccionados: string[];
  todosLosEquiposSeleccionados: boolean;
  hayEquipos: boolean;
  cargando: boolean;
  error: string | null;
  mismoDepartamento: boolean;
  limiteSuperado: boolean;
  ocupado: boolean;
  fechaCarta: string;
  onCambiarTodos: () => void;
  onCambiarEquipo: (id: string, incluido: boolean) => void;
  onQuitarEmpleado: (id: number) => void;
  onDescargar: () => void;
}) {
  const cantidadEquipos = personas.reduce((total, { equipos }) =>
    total + equipos.filter((equipo) => equiposSeleccionados.includes(equipo.clave)).length, 0);

  return (
    <div className="responsiva-vista">
      <div className="responsiva-equipos-titulo">
        <span>Vista previa de las cartas</span>
        <button type="button" className="btn ghost sm" onClick={onCambiarTodos} disabled={!hayEquipos}>
          {todosLosEquiposSeleccionados ? 'Quitar selección' : 'Seleccionar todo'}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {cargando && !personas.length && <p className="sub">Cargando personas y equipos…</p>}
      {!mismoDepartamento && <p className="error" role="alert">Todas las cartas de un mismo archivo deben ser del mismo departamento. Quita las personas de otro departamento para continuar.</p>}
      {limiteSuperado && <p className="error" role="alert">La plantilla permite hasta 12 equipos asignados y 11 devoluciones por persona. Desmarca equipos para continuar.</p>}
      {!cargando && !error && !personas.length && <p className="sub">No quedan personas seleccionadas en la vista previa.</p>}
      <div className="responsiva-vista-lista">
        {personas.map(({ empleado, equipos }) => (
          <div key={empleado.id} className="responsiva-equipos-persona">
            <div className="responsiva-persona-titulo">
              <h3>{empleado.nombre}</h3>
              <button type="button" className="btn ghost sm" onClick={() => onQuitarEmpleado(empleado.id)} aria-label={`Quitar a ${empleado.nombre}`} title={`Quitar a ${empleado.nombre}`}>
                Quitar
              </button>
            </div>
            <dl className="responsiva-datos-persona">
              <div><dt>Departamento</dt><dd>{empleado.departamento?.nombre ?? 'Sin departamento'}</dd></div>
              <div><dt>Puesto</dt><dd>{empleado.puesto?.nombre ?? '—'}</dd></div>
              <div><dt>Número</dt><dd>{empleado.numero || '—'}</dd></div>
              <div><dt>Fecha de la carta</dt><dd>{new Date(`${fechaCarta}T12:00:00`).toLocaleDateString('es-MX')}</dd></div>
              <div><dt>Folio</dt><dd>{empleado.id}-{fechaCarta.replace(/-/g, '')}</dd></div>
              {empleado.correo && <div><dt>Correo</dt><dd>{empleado.correo}</dd></div>}
            </dl>
            <strong className="responsiva-lista-titulo">Equipos incluidos en la carta</strong>
            {equipos.length ? equipos.map((equipo) => (
              <label key={equipo.registroClave} className="responsiva-equipo">
                <input
                  type="checkbox"
                  checked={equiposSeleccionados.includes(equipo.clave)}
                  onChange={(e) => onCambiarEquipo(equipo.clave, e.target.checked)}
                />
                <span>
                  <strong>{equipo.descripcion || etiquetaTipo(equipo.tipo)}{equipo.tipo === 'ADAPTADOR' && equipo.tipoAdaptador ? ` (${equipo.tipoAdaptador === 'RED' ? 'Red' : 'Multipuertos'})` : ''}</strong>
                  <span>Cantidad: 1 | Marca: {equipo.marca || '—'} | Modelo: {equipo.modelo || '—'} | Serie: {equipo.serie || '—'}</span>
                  <span className="sub">
                    {equipo.actual
                      ? `Asignado actualmente${equipo.fechaEntrega ? ` | Entregado: ${new Date(`${equipo.fechaEntrega.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX')}` : ''}`
                      : `Devolución histórica${equipo.fechaDevolucion ? ` | Devuelto: ${new Date(`${equipo.fechaDevolucion.slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX')}` : ''}${equipo.resultado ? ` | ${RESULTADOS_CARTA[equipo.resultado] ?? equipo.resultado}` : ''}`}
                    {equipo.notas ? ` | ${equipo.notas}` : ''}
                  </span>
                  <span className="sub">{equiposSeleccionados.includes(equipo.clave) ? 'Se incluirá en la carta' : 'No se incluirá'}</span>
                </span>
              </label>
            )) : <p className="sub">Esta persona no tiene equipos asignados ni devoluciones registradas.</p>}
          </div>
        ))}
      </div>
      <div className="responsiva-vista-acciones">
        <span className="sub">{personas.length} {personas.length === 1 ? 'carta' : 'cartas'} · {cantidadEquipos} registros de equipo seleccionados</span>
        <button
          className="btn"
          onClick={onDescargar}
          disabled={!personas.length || cargando || !!error || ocupado || !mismoDepartamento || limiteSuperado}
        >
          {ocupado ? 'Preparando cartas…' : 'Generar y descargar cartas'}
        </button>
      </div>
    </div>
  );
}

type Alcance = 'todos' | 'departamento' | 'empleado' | 'recientes';

const ORDENES: [OrdenEtiquetas, string][] = [['usuario', 'Usuario'], ['departamento', 'Departamento'], ['recientes', 'Más recientes primero']];

const haceDias = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const slug = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function PanelEtiquetas() {
  const { avisar } = useAvisos();
  const [alcance, setAlcance] = useState<Alcance>('todos');
  const [departamentoId, setDepartamento] = useState('');
  const [empleadoId, setEmpleado] = useState('');
  const [desde, setDesde] = useState(haceDias(30));
  const [orden, setOrden] = useState<OrdenEtiquetas>('usuario');
  const [ocupado, setOcupado] = useState(false);
  const deptos = useCarga(() => (alcance === 'departamento' ? api<Ref[]>('/departamentos') : Promise.resolve(null)), [alcance]);
  const empleados = useCarga(() => (alcance === 'empleado' ? api<EmpleadoListado[]>('/empleados') : Promise.resolve(null)), [alcance]);

  const cambiarAlcance = (a: Alcance) => {
    setAlcance(a);
    if (a === 'recientes') setOrden('recientes');
    else if (orden === 'recientes') setOrden('usuario');
  };

  const opciones = (): OpcionesEtiquetas | null => {
    if (alcance === 'departamento') {
      const d = deptos.datos?.find((x) => String(x.id) === departamentoId);
      return d ? { departamentoId: d.id, orden, descripcion: `Departamento: ${d.nombre}`, archivo: slug(d.nombre) } : null;
    }
    if (alcance === 'empleado') {
      const e = empleados.datos?.find((x) => String(x.id) === empleadoId);
      return e ? { empleadoId: e.id, orden, descripcion: `Usuario: ${e.nombre}`, archivo: slug(e.nombre) } : null;
    }
    if (alcance === 'recientes') {
      if (!desde) return null;
      return { desde, orden, descripcion: `Dados de alta desde el ${new Date(`${desde}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`, archivo: `desde-${desde}` };
    }
    return { orden, descripcion: `Todos los equipos, ordenados por ${ORDENES.find(([k]) => k === orden)![1].toLowerCase()}` };
  };
  const listo = opciones();

  const generar = async () => {
    if (!listo) return;
    setOcupado(true);
    try { avisar(`PDF descargado con ${await descargarEtiquetasPdf(listo)} equipos`); } catch (e) { avisar((e as Error).message); } finally { setOcupado(false); }
  };

  return (
    <section className="panel">
      <h2>Códigos de barras y QR</h2>
      <p style={{ marginTop: 0 }}>Descarga un PDF con el código de barras y el QR de cada equipo, con el nombre del usuario al que está asignado, listo para imprimir.</p>
      <div className="form">
        <Campo etiqueta="Qué equipos">
          <select value={alcance} onChange={(e) => cambiarAlcance(e.target.value as Alcance)}>
            <option value="todos">Todos</option>
            <option value="departamento">De un departamento</option>
            <option value="empleado">De una persona</option>
            <option value="recientes">Dados de alta recientemente</option>
          </select>
        </Campo>
        {alcance === 'departamento' && (
          <Campo etiqueta="Departamento">
            <select value={departamentoId} onChange={(e) => setDepartamento(e.target.value)} disabled={!deptos.datos}>
              <option value="">{deptos.datos ? 'Elige un departamento' : 'Cargando…'}</option>
              {deptos.datos?.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </Campo>
        )}
        {alcance === 'empleado' && (
          <Campo etiqueta="Persona">
            <select value={empleadoId} onChange={(e) => setEmpleado(e.target.value)} disabled={!empleados.datos}>
              <option value="">{empleados.datos ? 'Elige una persona' : 'Cargando…'}</option>
              {empleados.datos?.map((e) => <option key={e.id} value={e.id}>{e.nombre} ({e.equiposAsignados} equipos)</option>)}
            </select>
          </Campo>
        )}
        {alcance === 'recientes' && (
          <Campo etiqueta="Dados de alta desde"><input type="date" value={desde} max={haceDias(0)} onChange={(e) => setDesde(e.target.value)} /></Campo>
        )}
        {alcance !== 'empleado' && (
          <Campo etiqueta="Ordenar por">
            <select value={orden} onChange={(e) => setOrden(e.target.value as OrdenEtiquetas)}>
              {ORDENES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
            </select>
          </Campo>
        )}
        {(deptos.error || empleados.error) && <p className="error" role="alert">{deptos.error || empleados.error}</p>}
        <div><button className="btn ghost" onClick={generar} disabled={ocupado || !listo}>{ocupado ? 'Generando PDF…' : 'Descargar PDF'}</button></div>
      </div>
    </section>
  );
}

function Resumen({ a }: { a: Analisis }) {
  return (
    <>
      <dl className="dl">
        <dt>Filas con datos</dt><dd>{a.filas}</dd>
        <dt>Empleados nuevos</dt><dd>{a.empleadosNuevos}</dd>
        <dt>Equipos nuevos</dt><dd>{a.equiposNuevos} ({a.asignados} quedarán asignados)</dd>
        {Object.entries(a.porTipo).map(([t, n]) => <div key={t} style={{ display: 'contents' }}><dt style={{ paddingLeft: 14 }}>{t}</dt><dd>{n}</dd></div>)}
        <dt>Omitidos</dt><dd>{a.omitidos.length}</dd>
      </dl>
      {a.avisos.map((x) => <p key={x} className="aviso">{x}</p>)}
      {a.muestraEmpleados.length > 0 && (
        <details><summary>Ver empleados nuevos</summary><ul>{a.muestraEmpleados.map((n) => <li key={n}>{n}</li>)}{a.empleadosNuevos > a.muestraEmpleados.length && <li>y {a.empleadosNuevos - a.muestraEmpleados.length} más</li>}</ul></details>
      )}
      {a.omitidos.length > 0 && <details><summary>Ver omitidos</summary><ul>{a.omitidos.map((n, i) => <li key={i}>{n}</li>)}</ul></details>}
    </>
  );
}
