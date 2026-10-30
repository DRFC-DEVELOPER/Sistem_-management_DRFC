import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';
import Swal, { SweetAlertIcon } from 'sweetalert2';
import { AMBITOS_EQUIPO, CAMPOS, ESTATUS, Estatus, Equipo, esJefeArea, etiquetaTipo, fecha, nombreEquipo, Ref, Tipo } from './tipos';

// ---------- Iconos por tipo de equipo ----------
const TRAZOS: Record<string, string> = {
  LAPTOP: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  TECLADO: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  MOUSE: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/>',
  MONITOR: '<rect x="2" y="3" width="20" height="13" rx="1.5"/><path d="M8 21h8M12 16v5"/>',
  ADAPTADOR: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5"/>',
  MULTIFUNCIONAL: '<path d="M6 9V3h12v6M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>',
  SOPORTE: '<rect x="2" y="7" width="20" height="12" rx="2"/><circle cx="8" cy="13" r="2.5"/><circle cx="16" cy="13" r="2.5"/><path d="M6 7V5h12v2"/>',
  ACCESS_POINT: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><circle cx="12" cy="19.5" r="1"/>',
  TELEFONO_MOVIL: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
  OTRO: '<path d="M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8M12 13v8"/>',
};
export const Icono = ({ tipo }: { tipo: Tipo }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden dangerouslySetInnerHTML={{ __html: TRAZOS[tipo] ?? TRAZOS.OTRO }} />
);

const TRAZOS_ESTATUS: Record<Estatus, ReactNode> = {
  DISPONIBLE: (
    <>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  ASIGNADO: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="10" r="3.5" /><path d="M6 19c1.5-2.5 3.6-3.5 6-3.5s4.5 1 6 3.5" /></>,
  EN_REPARACION: <><path d="M14.5 6.5a4 4 0 0 1 5-5l-2.5 2.5.5 2 2 .5 2.5-2.5a4 4 0 0 1-5 5L6 20a2 2 0 0 1-3-3z" /><path d="M4 4l6 6" /></>,
  DANADO: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  RESGUARDO: <><path d="M4 5h16v15H4zM8 5V3h8v2" /><path d="M9 10h6v6H9zM12 12v2" /></>,
  BAJA: <><path d="M3 7h18M8 7V4h8v3M5 7l1 14h12l1-14" /><path d="M10 11v6M14 11v6" /></>,
};

export const IconoEstatus = ({ estatus }: { estatus: Estatus }) => (
  <svg className="icono-estatus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap={estatus === 'EN_REPARACION' ? 'round' : undefined} aria-hidden="true">
    {TRAZOS_ESTATUS[estatus]}
  </svg>
);

export const Pill = ({ estatus }: { estatus: Estatus }) => (
  <span className={`pill ${ESTATUS[estatus].clase}`} title={ESTATUS[estatus].nombre} role="img" aria-label={ESTATUS[estatus].nombre}>
    <IconoEstatus estatus={estatus} />
  </span>
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
export const MarcaTemporal = () => <span className="marca-temporal">Temporal</span>;

export function TarjetaEquipo({ e, lado, a, onClick, persona, temporal }: { e: Equipo; lado?: ReactNode; a?: string; onClick?: () => void; persona?: string; temporal?: boolean }) {
  const cuerpo = (
    <>
      <span className="ic"><Icono tipo={e.tipo} /></span>
      <span className="tx">
        {persona && <span className="t0">{persona}</span>}
        <span className="t1">{nombreEquipo(e)}{temporal && <MarcaTemporal />}</span>
        <span className="t2">{detalleEquipo(e)}</span>
      </span>
      {lado !== undefined ? <span className="lado">{lado}</span> : <span className="lado"><Pill estatus={e.estatus} /></span>}
    </>
  );
  const clase = `tag ${temporal ? 'c-temp' : ESTATUS[e.estatus].clase}`;
  if (a) return <Link to={a} className={clase}>{cuerpo}</Link>;
  return <button type="button" className={clase} onClick={onClick}>{cuerpo}</button>;
}

/** Características del equipo, como aparecen en su ficha. */
/** Características del equipo. `completo` muestra todos los campos del formulario, aunque estén vacíos. */
export function DatosEquipo({ e, completo }: { e: Equipo; completo?: boolean }) {
  const caracteristicas = CAMPOS.filter((c) => (completo || e[c.clave]) && (!c.tipos || c.tipos.includes(e.tipo)));
  const vacio = <span className="sub">—</span>;
  return (
    <dl className="dl">
      {completo && <><dt>Tipo de equipo</dt><dd>{etiquetaTipo(e.tipo)}</dd></>}
      {completo && <><dt>Área de uso</dt><dd>{AMBITOS_EQUIPO[e.ambito]}</dd></>}
      {caracteristicas.map((c) => (
        <div key={c.clave} style={{ display: 'contents' }}>
          <dt>{c.etiqueta}</dt>
          <dd className={c.mono && e[c.clave] ? 'mono' : undefined}>
            {!e[c.clave] ? vacio : c.opciones ? c.opciones.find(([k]) => k === e[c.clave])?.[1] : String(e[c.clave])}
          </dd>
        </div>
      ))}
      {completo && <><dt>Código de barras</dt><dd className={e.codigoBarras ? 'mono' : undefined}>{e.codigoBarras || vacio}</dd></>}
      {(completo || e.notas) && <><dt>Notas</dt><dd>{e.notas || vacio}</dd></>}
      <dt>Registrado</dt><dd>{fecha(e.creadoEn)}</dd>
    </dl>
  );
}

export function CodigoBarras({ valor }: { valor: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [falla, setFalla] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    try {
      // Siempre negro sobre blanco (la etiqueta tiene fondo blanco) para que los escáneres lo lean en cualquier tema.
      JsBarcode(ref.current, valor, { format: 'CODE128', height: 56, margin: 4, fontSize: 14, background: 'transparent', lineColor: '#000000', font: 'IBM Plex Mono' });
      setFalla(false);
    } catch {
      setFalla(true);
    }
  }, [valor]);
  return falla ? <p className="mono">{valor}</p> : <svg ref={ref} role="img" aria-label={`Código de barras ${valor}`} />;
}

/** Código QR dibujado directamente como SVG (negro sobre blanco, con un módulo de margen). */
export function CodigoQR({ valor }: { valor: string }) {
  const trazo = useMemo(() => {
    try {
      const { size, data } = QRCode.create(valor, { errorCorrectionLevel: 'M' }).modules;
      let d = '';
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y * size + x]) d += `M${x + 1} ${y + 1}h1v1h-1z`;
      return { size, d };
    } catch {
      return null;
    }
  }, [valor]);
  if (!trazo) return <p className="mono">{valor}</p>;
  const lado = trazo.size + 2;
  return (
    <svg className="qr" viewBox={`0 0 ${lado} ${lado}`} shapeRendering="crispEdges" role="img" aria-label={`Código QR ${valor}`}>
      <rect width={lado} height={lado} fill="#ffffff" />
      <path d={trazo.d} fill="#000000" />
    </svg>
  );
}

/** Guarda un SVG de la página como PNG con fondo blanco, al ancho indicado para que se imprima nítido. */
async function descargarPng(svg: SVGSVGElement, ancho: number, nombre: string) {
  const vb = svg.viewBox.baseVal;
  const w0 = vb?.width || svg.width.baseVal.value;
  const h0 = vb?.height || svg.height.baseVal.value;
  const alto = Math.round((ancho * h0) / w0);
  const copia = svg.cloneNode(true) as SVGSVGElement;
  copia.setAttribute('width', String(ancho));
  copia.setAttribute('height', String(alto));
  copia.removeAttribute('style');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copia)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url; });
    const lienzo = Object.assign(document.createElement('canvas'), { width: ancho, height: alto });
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);
    const png = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/png'));
    if (!png) return;
    const enlace = Object.assign(document.createElement('a'), { href: URL.createObjectURL(png), download: nombre });
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function TarjetaCodigo({ titulo, archivo, ancho, children }: { titulo: string; archivo: string; ancho: number; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  const descargar = () => {
    const svg = caja.current?.querySelector('svg');
    if (svg) descargarPng(svg, ancho, archivo);
  };
  return (
    <div className="etiqueta">
      <div className="etiqueta-cb" ref={caja}>{children}</div>
      <div className="etiqueta-pie">
        <span className="sub">{titulo}</span>
        <button type="button" className="btn ghost sm" onClick={descargar}>Descargar</button>
      </div>
    </div>
  );
}

/** Código de barras y QR del equipo, cada uno con su descarga en PNG. */
export const EtiquetaEquipo = ({ codigo }: { codigo: string }) => (
  <div className="etiquetas">
    <TarjetaCodigo titulo="Código de barras" archivo={`${codigo}-codigo-barras.png`} ancho={900}>
      <CodigoBarras valor={codigo} />
    </TarjetaCodigo>
    <TarjetaCodigo titulo="Código QR" archivo={`${codigo}-qr.png`} ancho={600}>
      <CodigoQR valor={codigo} />
    </TarjetaCodigo>
  </div>
);

export const Vacio = ({ titulo, children }: { titulo: string; children?: ReactNode }) => (
  <div className="vacio"><strong>{titulo}</strong>{children}</div>
);
export const Cargando = () => <p className="sub">Cargando…</p>;
export const ErrorCarga = ({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) => (
  <div className="aviso err" role="alert">{mensaje} {reintentar && <button className="btn ghost sm" onClick={reintentar}>Reintentar</button>}</div>
);

// ---------- Ventana modal ----------
export function Modal({ titulo, sub, onCerrar, children, ancho, clase }: { titulo: string; sub?: ReactNode; onCerrar: () => void; children: ReactNode; ancho?: boolean; clase?: string }) {
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
      <div className={`hoja${ancho ? ' ancha' : ''}${clase ? ` ${clase}` : ''}`} role="dialog" aria-modal="true" aria-labelledby="titulo-modal" ref={ref}>
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

/** A quién va un equipo entregado a un jefe de área. */
export interface Destino { paraOtro: boolean; puestoId: string; persona: string }
export const DESTINO_PROPIO: Destino = { paraOtro: false, puestoId: '', persona: '' };

/**
 * Solo para jefes de área: el equipo puede ser para su uso o para otra persona de su departamento.
 * En el segundo caso el jefe queda como responsable y el equipo se muestra aparte en su perfil.
 */
export function DestinoJefe({ jefe, puestos, destino, onCambio }: {
  jefe: string; puestos?: Ref[] | null; destino: Destino; onCambio: (d: Destino) => void;
}) {
  const opciones = (puestos ?? []).filter((p) => !esJefeArea(p.nombre));
  const elegido = opciones.find((p) => String(p.id) === destino.puestoId);
  const persona = destino.persona.trim();
  return (
    <>
      <Campo etiqueta="¿Para quién es el equipo?">
        <select value={destino.paraOtro ? 'OTRO' : 'JEFE'} onChange={(e) => onCambio(e.target.value === 'OTRO' ? { ...DESTINO_PROPIO, paraOtro: true } : DESTINO_PROPIO)}>
          <option value="JEFE">Para {jefe} (uso personal)</option>
          <option value="OTRO">Para otra persona de su departamento</option>
        </select>
      </Campo>
      {destino.paraOtro && (
        <>
          <Campo etiqueta="Puesto de quien lo usará">
            <select value={destino.puestoId} onChange={(e) => onCambio({ ...destino, puestoId: e.target.value })} disabled={!puestos}>
              <option value="">Selecciona el puesto</option>
              {opciones.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Nombre de quien lo usará" opcional>
            <input value={destino.persona} onChange={(e) => onCambio({ ...destino, persona: e.target.value })} maxLength={150} placeholder={elegido ? `Nombre del ${elegido.nombre.toLowerCase()}` : 'Nombre de la persona'} autoComplete="off" />
          </Campo>
        </>
      )}
      {destino.paraOtro && puestos && !opciones.length && (
        <p className="aviso err" style={{ gridColumn: '1 / -1', margin: 0 }}>
          El departamento no tiene otros puestos. Agrégalos primero en Departamentos (por ejemplo, Almacenista).
        </p>
      )}
      {destino.paraOtro && opciones.length > 0 && (
        <p className="sub" style={{ gridColumn: '1 / -1', margin: 0 }}>
          <b>{jefe}</b> queda como responsable del equipo{elegido ? ` que usará ${persona ? `${persona} (${elegido.nombre})` : `el ${elegido.nombre.toLowerCase()}`}` : ''}.
          {' '}Cada persona puede tener un equipo de cada tipo; si no escribes el nombre, cuenta como una sola persona de ese puesto.
          Aparecerá aparte en su perfil, en “Equipos para otros puestos”.
        </p>
      )}
    </>
  );
}

// ---------- Avisos y confirmaciones ----------
interface Avisos {
  avisar: (m: string) => void;
  confirmar: (o: { titulo: string; mensaje: string; boton: string; peligro?: boolean }) => Promise<boolean>;
  /** Avisa que un equipo cambió de estatus y ofrece ir a la lista donde quedó. */
  avisarEstatus: (equipo: string, estatus: Estatus) => void;
}

// Alerta que se muestra según el nuevo estatus y lista a la que lleva el botón «Ver».
const CAMBIOS: Partial<Record<Estatus, { titulo: string; icono: SweetAlertIcon; texto: string; ruta: string; boton: string }>> = {
  DISPONIBLE: { titulo: 'Equipo disponible', icono: 'success', texto: 'quedó en el inventario, listo para entregarse.', ruta: '/equipos?estatus=DISPONIBLE', boton: 'Ver disponibles' },
  DANADO: { titulo: 'Equipo marcado como dañado', icono: 'warning', texto: 'quedó apartado como dañado. Envíalo a reparación o márcalo disponible cuando funcione.', ruta: '/equipos?estatus=DANADO', boton: 'Ver dañados' },
  EN_REPARACION: { titulo: 'Equipo enviado a reparación', icono: 'info', texto: 'quedó en los equipos en reparación, pendiente de regreso.', ruta: '/equipos?estatus=EN_REPARACION', boton: 'Ver en reparación' },
  RESGUARDO: { titulo: 'Equipo en resguardo', icono: 'info', texto: 'quedó guardado en resguardo y no está disponible para asignación.', ruta: '/equipos?estatus=RESGUARDO', boton: 'Ver en resguardo' },
  BAJA: { titulo: 'Equipo dado de baja', icono: 'error', texto: 'ya no forma parte del inventario activo.', ruta: '/equipos?estatus=BAJA', boton: 'Ver dados de baja' },
};
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
  const navegar = useNavigate();
  const avisarEstatus = useCallback<Avisos['avisarEstatus']>((equipo, estatus) => {
    const c = CAMBIOS[estatus];
    if (!c) return avisar(`${equipo}: ${ESTATUS[estatus].nombre}`);
    const css = getComputedStyle(document.documentElement);
    const color = (v: string) => css.getPropertyValue(v).trim() || undefined;
    // Se abre después de que React cierre el formulario, para que no le quite el foco a la alerta.
    window.setTimeout(() => {
      Swal.fire({
        title: c.titulo,
        text: `${equipo} ${c.texto}`,
        icon: c.icono,
        showCancelButton: true,
        confirmButtonText: c.boton,
        cancelButtonText: 'Cerrar',
        reverseButtons: true,
        background: color('--superficie'),
        color: color('--tinta'),
        confirmButtonColor: color('--acento'),
        cancelButtonColor: color('--apagado'),
      }).then((r) => { if (r.isConfirmed) navegar(c.ruta); });
    });
  }, [avisar, navegar]);
  return (
    <CtxAvisos.Provider value={{ avisar, confirmar, avisarEstatus }}>
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
export const LAPIZ = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>
);
export const BOTE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></svg>
);
