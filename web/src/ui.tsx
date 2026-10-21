import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { ESTATUS, Estatus, Equipo, nombreEquipo, Tipo } from './tipos';

// ---------- Iconos por tipo de equipo ----------
const TRAZOS: Record<Tipo, string> = {
  LAPTOP: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  TECLADO: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  MOUSE: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>',
  MONITOR: '<rect x="2" y="3" width="20" height="13" rx="1.5"/><path d="M8 21h8M12 16v5"/>',
  ADAPTADOR: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
  MULTIFUNCIONAL: '<path d="M6 9V3h12v6M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
  ACCESS_POINT: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1"/>',
  OTRO: '<path d="M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8M12 13v8"/>',
};
export const Icono = ({ tipo }: { tipo: Tipo }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden dangerouslySetInnerHTML={{ __html: TRAZOS[tipo] ?? TRAZOS.OTRO }} />
);

export const Pill = ({ estatus }: { estatus: Estatus }) => (
  <span className={`pill ${ESTATUS[estatus].clase}`}>{ESTATUS[estatus].nombre}</span>
);

export function detalleEquipo(e: Partial<Equipo> & { tipo: Tipo }) {
  const partes: ReactNode[] = [];
  if (e.serie) partes.push(<span className="mono" key="s">{e.serie}</span>);
  if (e.tipo === 'LAPTOP') {
    const t = [e.procesador, e.memoriaGb && `${e.memoriaGb} GB`, e.disco].filter(Boolean).join(', ');
    if (t) partes.push(<span key="l">{t}</span>);
  }
  if (e.ipGestion) partes.push(<span key="i">IP <span className="mono">{e.ipGestion}</span></span>);
  if (e.tipo === 'ADAPTADOR' && e.tipoAdaptador) partes.push(<span key="a">{e.tipoAdaptador === 'RED' ? 'Red' : 'Multipuertos'}</span>);
  return partes.length ? partes.reduce<ReactNode[]>((acc, p, i) => (i ? [...acc, <span key={`sep${i}`} className="sep"> | </span>, p] : [p]), []) : <span>Sin número de serie</span>;
}

/** Tarjeta de equipo con el estilo de etiqueta de inventario. */
export function TarjetaEquipo({ e, lado, a, onClick }: { e: Equipo; lado?: ReactNode; a?: string; onClick?: () => void }) {
  const cuerpo = (
    <>
      <span className="ic"><Icono tipo={e.tipo} /></span>
      <span className="tx">
        <span className="t1">{nombreEquipo(e)}</span>
        <span className="t2">{detalleEquipo(e)}</span>
      </span>
      {lado !== undefined ? <span className="lado">{lado}</span> : <span className="lado"><Pill estatus={e.estatus} /></span>}
    </>
  );
  const clase = `tag ${ESTATUS[e.estatus].clase}`;
  if (a) return <Link to={a} className={clase}>{cuerpo}</Link>;
  return <button type="button" className={clase} onClick={onClick}>{cuerpo}</button>;
}

export function CodigoBarras({ valor }: { valor: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [falla, setFalla] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    try {
      const tinta = getComputedStyle(document.documentElement).getPropertyValue('--tinta').trim() || '#000';
      JsBarcode(ref.current, valor, { format: 'CODE128', height: 56, margin: 4, fontSize: 14, background: 'transparent', lineColor: tinta, font: 'IBM Plex Mono' });
      setFalla(false);
    } catch {
      setFalla(true);
    }
  }, [valor]);
  return falla ? <p className="mono">{valor}</p> : <svg ref={ref} role="img" aria-label={`Código de barras ${valor}`} />;
}

export const Vacio = ({ titulo, children }: { titulo: string; children?: ReactNode }) => (
  <div className="vacio"><strong>{titulo}</strong>{children}</div>
);
export const Cargando = () => <p className="sub">Cargando…</p>;
export const ErrorCarga = ({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) => (
  <div className="aviso err" role="alert">{mensaje} {reintentar && <button className="btn ghost sm" onClick={reintentar}>Reintentar</button>}</div>
);

// ---------- Ventana modal ----------
export function Modal({ titulo, sub, onCerrar, children, ancho }: { titulo: string; sub?: ReactNode; onCerrar: () => void; children: ReactNode; ancho?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const primero = ref.current?.querySelector<HTMLElement>('input:not([type=hidden]),select,textarea,button:not(.x)');
    primero?.focus();
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    document.body.classList.add('bloqueado');
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.classList.remove('bloqueado');
      previo?.focus();
    };
  }, [onCerrar]);
  return (
    <div className="capa" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) onCerrar(); }}>
      <div className={`hoja${ancho ? ' ancha' : ''}`} role="dialog" aria-modal="true" aria-labelledby="titulo-modal" ref={ref}>
        <div className="hoja-cab">
          <h2 id="titulo-modal">{titulo}{sub && <span className="sub">{sub}</span>}</h2>
          <button className="x" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Formulario dentro de un modal con manejo de envío y errores. */
export function FormModal({ titulo, sub, boton, onCerrar, onEnviar, children, peligro, ancho }: {
  titulo: string; sub?: ReactNode; boton: string; onCerrar: () => void; onEnviar: () => Promise<void>; children: ReactNode; peligro?: boolean; ancho?: boolean;
}) {
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    setOcupado(true);
    try { await onEnviar(); } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  };
  return (
    <Modal titulo={titulo} sub={sub} onCerrar={onCerrar} ancho={ancho}>
      <form className="form" onSubmit={enviar} noValidate>
        {children}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="acciones">
          <button type="button" className="btn ghost" onClick={onCerrar}>Cancelar</button>
          <button className={peligro ? 'btn peligro-solido' : 'btn'} disabled={ocupado}>{ocupado ? 'Guardando…' : boton}</button>
        </div>
      </form>
    </Modal>
  );
}

export function Campo({ etiqueta, opcional, children, ancho }: { etiqueta: string; opcional?: boolean; children: ReactNode; ancho?: boolean }) {
  return (
    <label className={`campo${ancho ? ' ancho' : ''}`}>
      <span>{etiqueta}{opcional && <em> (opcional)</em>}</span>
      {children}
    </label>
  );
}

// ---------- Avisos y confirmaciones ----------
interface Avisos {
  avisar: (m: string) => void;
  confirmar: (o: { titulo: string; mensaje: string; boton: string; peligro?: boolean }) => Promise<boolean>;
}
const CtxAvisos = createContext<Avisos | null>(null);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const [conf, setConf] = useState<null | { titulo: string; mensaje: string; boton: string; peligro?: boolean; res: (v: boolean) => void }>(null);
  const t = useRef<number>();
  const avisar = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setToast(null), 3200);
  }, []);
  const confirmar = useCallback<Avisos['confirmar']>((o) => new Promise((res) => setConf({ ...o, res })), []);
  const cerrar = (v: boolean) => { conf?.res(v); setConf(null); };
  return (
    <CtxAvisos.Provider value={{ avisar, confirmar }}>
      {children}
      {conf && (
        <Modal titulo={conf.titulo} onCerrar={() => cerrar(false)}>
          <p className="sub" style={{ marginTop: 0 }}>{conf.mensaje}</p>
          <div className="acciones">
            <button className="btn ghost" onClick={() => cerrar(false)}>Cancelar</button>
            <button className={conf.peligro ? 'btn peligro-solido' : 'btn'} onClick={() => cerrar(true)}>{conf.boton}</button>
          </div>
        </Modal>
      )}
      <div className="toast" role="status" aria-live="polite" hidden={!toast}>{toast}</div>
    </CtxAvisos.Provider>
  );
}
export const useAvisos = () => {
  const a = useContext(CtxAvisos);
  if (!a) throw new Error('useAvisos fuera de ProveedorAvisos');
  return a;
};

export function Paginacion({ total, pagina, limite, onCambiar }: { total: number; pagina: number; limite: number; onCambiar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / limite));
  if (paginas <= 1) return null;
  return (
    <nav className="paginacion" aria-label="Páginas">
      <button className="btn ghost sm" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>Anterior</button>
      <span className="sub">Página {pagina} de {paginas}</span>
      <button className="btn ghost sm" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>Siguiente</button>
    </nav>
  );
}

export const BUSCAR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
