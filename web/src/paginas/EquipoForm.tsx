import { useState } from 'react';
import { api } from '../api';
import { agregarAColaResponsivas } from '../responsiva';
import { useCarga } from '../usar';
import { AMBITOS_EQUIPO, AmbitoEquipo, CAMPOS, Equipo, EquipoDetalle, EmpleadoListado, etiquetaTipo, hoy, Ref, Tipo, TipoEquipoCatalogo } from '../tipos';
import { Campo, ErrorCarga, FormModal, useAvisos } from '../ui';

type Valores = Record<string, string>;

/** Alta o edición de un equipo. Al crear se puede asignar de inmediato. */
export default function EquipoForm({ equipo, onCerrar, onGuardado, empleadoInicial }: {
  equipo?: Equipo; onCerrar: () => void; onGuardado: (e: Equipo) => void; empleadoInicial?: number;
}) {
  const { avisar } = useAvisos();
  const nuevo = !equipo;
  const [agregarCartaACola, setAgregarCartaACola] = useState(true);
  const [v, setV] = useState<Valores>(() => {
    const base: Valores = { tipo: equipo?.tipo ?? 'LAPTOP', ambito: equipo?.ambito ?? 'USUARIO', codigoBarras: equipo?.codigoBarras ?? '', notas: equipo?.notas ?? '' };
    CAMPOS.forEach((c) => (base[c.clave] = (equipo?.[c.clave] as string | null) ?? (c.opciones ? c.opciones[0][0] : '')));
    if (equipo?.tipoAdaptador) base.tipoAdaptador = equipo.tipoAdaptador;
    return { ...base, estatusInicial: 'DISPONIBLE', empleadoId: empleadoInicial ? String(empleadoInicial) : '', fechaEntrega: hoy() };
  });
  const [departamentoId, setDepartamentoId] = useState('');
  const empleados = useCarga(() => nuevo ? api<EmpleadoListado[]>('/empleados') : Promise.resolve([]), [nuevo]);
  const departamentos = useCarga(() => nuevo ? api<Ref[]>('/departamentos') : Promise.resolve([]), [nuevo]);
  const tipos = useCarga(() => api<TipoEquipoCatalogo[]>('/catalogos/tipos-equipo'), []);
  const marcas = useCarga(() => api<Ref[]>('/catalogos/marcas'), []);

  const tipo = v.tipo as Tipo;
  const ambito = v.ambito as AmbitoEquipo;
  const aplica = CAMPOS.filter((c) => !c.tipos || c.tipos.includes(tipo));
  const poner = (k: string) => (ev: { target: { value: string } }) => setV((p) => ({ ...p, [k]: ev.target.value }));
  const empleadosFiltrados = (empleados.datos ?? []).filter((e) => !departamentoId || String(e.departamentoId) === departamentoId);

  const enviar = async () => {
    if (!tipos.datos) throw new Error(tipos.error ?? 'No se pudieron cargar los tipos de equipo.');
    if (!marcas.datos) throw new Error(marcas.error ?? 'No se pudieron cargar las marcas.');
    const cuerpo: Record<string, unknown> = { tipo, ambito, codigoBarras: v.codigoBarras, notas: v.notas };
    CAMPOS.forEach((c) => { cuerpo[c.clave] = aplica.includes(c) ? v[c.clave] : ''; });
    if (tipo !== 'ADAPTADOR') delete cuerpo.tipoAdaptador;
    if (!['marca', 'modelo', 'serie', 'descripcion'].some((k) => String(cuerpo[k] ?? '').trim())) {
      throw new Error('Escribe al menos la marca, el modelo, la serie o una descripción.');
    }
    let r: Equipo;
    if (nuevo) {
      // Al crear no se mandan campos vacíos.
      Object.keys(cuerpo).forEach((k) => { if (cuerpo[k] === '') delete cuerpo[k]; });
      if (ambito === 'USUARIO' && v.empleadoId) { cuerpo.empleadoId = Number(v.empleadoId); cuerpo.fechaEntrega = v.fechaEntrega || undefined; }
      else cuerpo.estatusInicial = v.estatusInicial;
      r = await api<EquipoDetalle>('/equipos', { cuerpo });
    } else {
      r = await api<Equipo>(`/equipos/${equipo.id}`, { metodo: 'PATCH', cuerpo });
    }
    let mensaje = nuevo ? (v.empleadoId ? 'Equipo registrado y asignado' : 'Equipo registrado') : 'Cambios guardados';
    if (nuevo && ambito === 'USUARIO' && v.empleadoId && agregarCartaACola) {
      const enCola = agregarAColaResponsivas(Number(v.empleadoId));
      mensaje = enCola
        ? 'Equipo registrado y empleado agregado a la cola de cartas responsivas'
        : 'Equipo registrado, pero no se pudo guardar al empleado en la cola de cartas';
    }
    avisar(mensaje);
    onGuardado(r);
  };

  return (
    <FormModal titulo={nuevo ? 'Registrar equipo' : 'Editar equipo'} boton={nuevo ? 'Guardar equipo' : 'Guardar cambios'} onCerrar={onCerrar} onEnviar={enviar} ancho>
      <Campo etiqueta="Tipo de equipo">
        <select value={tipo} onChange={poner('tipo')}>
          {(tipos.datos ?? []).map((t) => <option key={t.nombre} value={t.nombre}>{etiquetaTipo(t.nombre)}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Área de uso">
        <select value={ambito} onChange={(e) => setV((prev) => ({ ...prev, ambito: e.target.value, empleadoId: '' }))}>
          {(Object.keys(AMBITOS_EQUIPO) as AmbitoEquipo[]).map((a) => <option key={a} value={a}>{AMBITOS_EQUIPO[a]}</option>)}
        </select>
      </Campo>
      <div className="dos-col">
        {aplica.map((c) => (
          <Campo key={c.clave} etiqueta={c.etiqueta}>
            {c.clave === 'marca' ? (
              <select value={v[c.clave]} onChange={poner(c.clave)} disabled={!marcas.datos}>
                <option value="">Selecciona una marca</option>
                {equipo?.marca && !marcas.datos?.some((m) => m.nombre === equipo.marca) && <option value={equipo.marca}>{equipo.marca}</option>}
                {(marcas.datos ?? []).map((m) => <option key={m.id} value={m.nombre}>{m.nombre}</option>)}
              </select>
            ) : c.opciones ? (
              <select value={v[c.clave]} onChange={poner(c.clave)}>{c.opciones.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
            ) : (
              <input value={v[c.clave]} onChange={poner(c.clave)} className={c.mono ? 'mono' : undefined} spellCheck={!c.mono} autoComplete="off" />
            )}
          </Campo>
        ))}
        <Campo etiqueta="Código de barras" opcional={nuevo} ancho>
          <div className="fila">
            <input className="mono" value={v.codigoBarras} onChange={poner('codigoBarras')} placeholder={nuevo ? 'Vacío = se genera el siguiente consecutivo' : 'Escanéalo o escríbelo'} autoComplete="off" spellCheck={false} />
            <button type="button" className="btn ghost sm" onClick={() => setV((p) => ({ ...p, codigoBarras: p.serie }))} disabled={!v.serie}>Usar serie</button>
          </div>
        </Campo>
        {nuevo && (
          <>
            {ambito === 'USUARIO' && (
              <>
                <Campo etiqueta="Departamento">
                  <select value={departamentoId} onChange={(e) => { setDepartamentoId(e.target.value); setV((prev) => ({ ...prev, empleadoId: '' })); }}>
                    <option value="">Todos los departamentos</option>
                    {(departamentos.datos ?? []).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </Campo>
                <Campo etiqueta="Asignar a" opcional>
                  <select value={v.empleadoId} onChange={poner('empleadoId')}>
                    <option value="">Sin asignar</option>
                    {empleadosFiltrados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </Campo>
              </>
            )}
            {ambito === 'USUARIO' && v.empleadoId ? (
              <Campo etiqueta="Fecha de entrega"><input type="date" value={v.fechaEntrega} onChange={poner('fechaEntrega')} /></Campo>
            ) : (
              <Campo etiqueta="Estado">
                <select value={v.estatusInicial} onChange={poner('estatusInicial')}>
                  <option value="DISPONIBLE">Disponible</option>
                  <option value="DANADO">Dañado</option>
                </select>
              </Campo>
            )}
          </>
        )}
        <Campo etiqueta="Notas" ancho><textarea value={v.notas} onChange={poner('notas')} rows={2} /></Campo>
      </div>
      {nuevo && ambito === 'USUARIO' && v.empleadoId && (
        <label className="casilla">
          <input type="checkbox" checked={agregarCartaACola} onChange={(e) => setAgregarCartaACola(e.target.checked)} />
          Agregar a {empleados.datos?.find((e) => String(e.id) === v.empleadoId)?.nombre ?? 'la persona'} a la cola de cartas
        </label>
      )}
      {nuevo && empleados.error && <ErrorCarga mensaje={empleados.error} />}
      {nuevo && departamentos.error && <ErrorCarga mensaje={departamentos.error} />}
      {tipos.error && <ErrorCarga mensaje={tipos.error} reintentar={tipos.recargar} />}
      {marcas.error && <ErrorCarga mensaje={marcas.error} reintentar={marcas.recargar} />}
    </FormModal>
  );
}
