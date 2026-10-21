import { ChangeEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, descargar } from '../api';
import { useSesion } from '../sesion';
import { useAvisos } from '../ui';

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
