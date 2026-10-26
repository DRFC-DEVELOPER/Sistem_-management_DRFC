import { ChangeEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, descargar } from '../api';
import { descargarEtiquetasPdf, OpcionesEtiquetas, OrdenEtiquetas } from '../etiquetasPdf';
import { useSesion } from '../sesion';
import { EmpleadoListado, Ref } from '../tipos';
import { Campo, useAvisos } from '../ui';
import { useCarga } from '../usar';

interface Analisis {
  filas: number; empleadosNuevos: number; equiposNuevos: number; asignados: number;
  porTipo: Record<string, number>; omitidos: string[]; avisos: string[]; muestraEmpleados: string[];
}

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
      <div className="rejilla" style={{ marginTop: 0 }}>
        <section className="panel">
          <h2>Exportar inventario</h2>
          <p style={{ marginTop: 0 }}>Descarga un Excel con el mismo formato de columnas que usas hoy, más una hoja con la lista completa de equipos.</p>
          <button className="btn ghost" onClick={exportar} disabled={!!ocupado}>{ocupado === 'exportar' ? 'Preparando…' : 'Descargar Excel'}</button>
        </section>

        <PanelEtiquetas />

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
    </>
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
