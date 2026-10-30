import { KeyboardEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, qs } from '../api';
import { useCarga, useRetraso } from '../usar';
import { useSesion } from '../sesion';
import { AMBITOS_EQUIPO, AmbitoEquipo, ESTATUS, EquipoListado, Estatus, ORDENES, Pagina, TipoEquipoCatalogo, etiquetaTipo, textoDestinatario } from '../tipos';
import { BUSCAR, Cargando, ErrorCarga, Paginacion, Pill, TarjetaEquipo, Vacio } from '../ui';
import EquipoForm from './EquipoForm';

const FILTROS: [string, string][] = [['', 'Activos'], ...(Object.keys(ESTATUS) as Estatus[]).map((s) => [s, ESTATUS[s].plural] as [string, string]), ['todos', 'Todos']];

export default function Equipos() {
  const { puedeEditar } = useSesion();
  const navegar = useNavigate();
  const [p, setP] = useSearchParams();
  const [texto, setTexto] = useState(p.get('q') ?? '');
  const q = useRetraso(texto);
  const tipo = p.get('tipo') ?? '';
  const ambito = (p.get('ambito') as AmbitoEquipo | null) ?? 'USUARIO';
  const estatus = p.get('estatus') ?? '';
  const orden = p.get('orden') ?? '';
  const pagina = Number(p.get('pagina') ?? 1);
  const tipos = useCarga(() => api<TipoEquipoCatalogo[]>('/catalogos/tipos-equipo'), []);
  const cambiar = (k: string, valor: string) => {
    const n = new URLSearchParams(p);
    if (valor) n.set(k, valor); else n.delete(k);
    if (k !== 'pagina') n.delete('pagina');
    setP(n, { replace: true });
  };

  const { datos, error, cargando, recargar } = useCarga(
    () => api<Pagina<EquipoListado>>(`/equipos${qs({
      q, tipo, ambito, orden, pagina, limite: 50,
      estatus: estatus && estatus !== 'todos' ? estatus : undefined,
      incluirBajas: estatus === 'todos',
    })}`),
    [q, tipo, ambito, estatus, orden, pagina],
  );

  // Los lectores de código de barras escriben el código y presionan Enter.
  const escanear = async (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key !== 'Enter' || !texto.trim()) return;
    try {
      const e = await api<{ id: number }>(`/equipos/codigo/${encodeURIComponent(texto.trim())}`);
      navegar(`/equipos/${e.id}`);
    } catch { /* no es un código exacto: se queda la búsqueda normal */ }
  };

  return (
    <>
      <div className="encabezado">
        <h1>Equipos</h1>
        {puedeEditar && <button className="btn" onClick={() => cambiar('nuevo', '1')}>Registrar equipo</button>}
      </div>
      <div className="chips" role="group" aria-label="Área de equipos">
        {(Object.keys(AMBITOS_EQUIPO) as AmbitoEquipo[]).map((a) => (
          <button key={a} className="chip" aria-pressed={ambito === a} onClick={() => cambiar('ambito', a)}>{AMBITOS_EQUIPO[a]}</button>
        ))}
      </div>
      <div className="barra">
        <label className="buscar crece">{BUSCAR}
          <input className="entrada" type="search" placeholder="Buscar por serie, marca, modelo, empleado o código" value={texto}
            onChange={(e) => { setTexto(e.target.value); if (pagina > 1) cambiar('pagina', ''); }} onKeyDown={escanear} aria-label="Buscar equipos" />
        </label>
        <select className="entrada" value={tipo} onChange={(e) => cambiar('tipo', e.target.value)} aria-label="Tipo de equipo">
          <option value="">Todos los tipos</option>
          {(tipos.datos ?? []).map((t) => <option key={t.nombre} value={t.nombre}>{etiquetaTipo(t.nombre)}</option>)}
        </select>
        <select className="entrada" value={orden} onChange={(e) => cambiar('orden', e.target.value)} aria-label="Ordenar">
          <option value="">Por tipo</option>
          {ORDENES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </div>
      {tipos.error && <ErrorCarga mensaje={tipos.error} reintentar={tipos.recargar} />}
      <div className="chips" role="group" aria-label="Estado">
        {FILTROS.map(([k, n]) => <button key={k} className="chip" aria-pressed={estatus === k} onClick={() => cambiar('estatus', k)}>{n}</button>)}
      </div>

      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : (
        <>
          <p className="conteo">{datos.total} {datos.total === 1 ? 'equipo' : 'equipos'}{cargando ? '…' : ''}</p>
          {datos.datos.length ? (
            <div className="lista dos">
              {datos.datos.map((e) => (
                <TarjetaEquipo
                  key={e.id}
                  e={e}
                  a={`/equipos/${e.id}`}
                  persona={e.empleado ? `${e.empleado.nombre}${e.puestoDestinatario ? ` · Para ${textoDestinatario(e.puestoDestinatario.nombre, e.puestoDestinatario.persona)}` : ''}` : undefined}
                  temporal={e.temporal}
                  lado={<Pill estatus={e.estatus} />}
                />
              ))}
            </div>
          ) : (
            <Vacio titulo="Ningún equipo coincide">Prueba con otra búsqueda o cambia los filtros.</Vacio>
          )}
          <Paginacion total={datos.total} pagina={datos.pagina} limite={datos.limite} onCambiar={(n) => cambiar('pagina', String(n))} />
        </>
      )}

      {p.get('nuevo') && (
        <EquipoForm onCerrar={() => cambiar('nuevo', '')} onGuardado={(e) => navegar(`/equipos/${e.id}`)} />
      )}
    </>
  );
}
