import { useState } from 'react';
import { api } from '../api';
import { agregarAColaResponsivas } from '../responsiva';
import { useCarga } from '../usar';
import { AMBITOS_EQUIPO, AmbitoEquipo, CAMPOS, EmpleadoDetalle, Equipo, EquipoDetalle, EmpleadoListado, esJefeArea, etiquetaTipo, hoy, nombreEquipo, claveDestino, claveDestinoDe, Ref, Tipo, TipoEquipoCatalogo } from '../tipos';
import { Campo, Destino, DESTINO_PROPIO, DestinoJefe, ErrorCarga, FormModal, useAvisos } from '../ui';

type Valores = Record<string, string>;

/** Alta o edición de un equipo. Al crear se puede asignar de inmediato. */
export default function EquipoForm({ equipo, onCerrar, onGuardado, empleadoInicial }: {
  equipo?: Equipo; onCerrar: () => void; onGuardado: (e: Equipo) => void; empleadoInicial?: number;
}) {
  const { avisar } = useAvisos();
  const nuevo = !equipo;
  // El código de barras es único: una vez registrado ya no se modifica.
  const codigoFijo = !!equipo?.codigoBarras;
  const [agregarCartaACola, setAgregarCartaACola] = useState(true);
  const [v, setV] = useState<Valores>(() => {
    const base: Valores = { tipo: equipo?.tipo ?? 'LAPTOP', ambito: equipo?.ambito ?? 'USUARIO', codigoBarras: equipo?.codigoBarras ?? '', notas: equipo?.notas ?? '' };
    CAMPOS.forEach((c) => (base[c.clave] = (equipo?.[c.clave] as string | null) ?? (c.opciones ? c.opciones[0][0] : '')));
    if (equipo?.tipoAdaptador) base.tipoAdaptador = equipo.tipoAdaptador;
    return { ...base, estatusInicial: 'DISPONIBLE', empleadoId: empleadoInicial ? String(empleadoInicial) : '', fechaEntrega: hoy() };
  });
  const [departamentoId, setDepartamentoId] = useState('');
  const [destinoJefe, setDestinoJefe] = useState<Destino>(DESTINO_PROPIO);
  const empleados = useCarga(() => nuevo ? api<EmpleadoListado[]>('/empleados') : Promise.resolve([]), [nuevo]);
  const departamentos = useCarga(() => nuevo ? api<Ref[]>('/departamentos') : Promise.resolve([]), [nuevo]);
  const empleadoElegido = (empleados.datos ?? []).find((e) => String(e.id) === v.empleadoId);
  const departamentoPuestosId = empleadoElegido?.departamentoId ?? (departamentoId ? Number(departamentoId) : null);
  const puestos = useCarga(
    () => nuevo && departamentoPuestosId ? api<Ref[]>(`/departamentos/${departamentoPuestosId}/puestos`) : Promise.resolve([]),
    [nuevo, departamentoPuestosId],
  );
  const esJefe = esJefeArea(empleadoElegido?.puesto?.nombre);
  const paraOtro = esJefe && destinoJefe.paraOtro;
  // Con un jefe de área se revisa lo que ya tiene para avisar antes de guardar.
  const jefe = useCarga(
    () => nuevo && esJefe ? api<EmpleadoDetalle>(`/empleados/${v.empleadoId}`) : Promise.resolve(null),
    [nuevo, esJefe, v.empleadoId],
  );
  const tipos = useCarga(() => api<TipoEquipoCatalogo[]>('/catalogos/tipos-equipo'), []);
  const marcas = useCarga(() => api<Ref[]>('/catalogos/marcas'), []);

  const tipo = v.tipo as Tipo;
  const ambito = v.ambito as AmbitoEquipo;
  const destino = paraOtro && destinoJefe.puestoId ? Number(destinoJefe.puestoId) : null;
  const persona = destinoJefe.persona.trim();
  const puestoNombre = puestos.datos?.find((p) => p.id === destino)?.nombre;
  const jefeDatos = jefe.datos;
  // Un equipo por tipo para cada quien: el jefe o cada persona de su departamento a su cargo.
  const yaTiene = jefeDatos && tipo !== 'OTRO' && (!paraOtro || destino)
    ? jefeDatos.equiposActuales.find((x) => x.estatus === 'ASIGNADO' && x.tipo === tipo && claveDestinoDe(jefeDatos, x.id) === claveDestino(destino, persona))
    : undefined;
  const quien = destino ? (persona ? `${persona} (${puestoNombre})` : `El puesto ${puestoNombre} (sin nombre)`) : empleadoElegido?.nombre;
  const aplica = CAMPOS.filter((c) => !c.tipos || c.tipos.includes(tipo));
  const poner = (k: string) => (ev: { target: { value: string } }) => setV((p) => ({ ...p, [k]: ev.target.value }));
  const empleadosFiltrados = (empleados.datos ?? []).filter((e) => !departamentoId || String(e.departamentoId) === departamentoId);

  const enviar = async () => {
    if (!tipos.datos) throw new Error(tipos.error ?? 'No se pudieron cargar los tipos de equipo.');
    if (!marcas.datos) throw new Error(marcas.error ?? 'No se pudieron cargar las marcas.');
    const cuerpo: Record<string, unknown> = { tipo, ambito, codigoBarras: v.codigoBarras, notas: v.notas };
    if (codigoFijo) delete cuerpo.codigoBarras;
    CAMPOS.forEach((c) => { cuerpo[c.clave] = aplica.includes(c) ? v[c.clave] : ''; });
    if (tipo !== 'ADAPTADOR') delete cuerpo.tipoAdaptador;
    if (!['marca', 'modelo', 'serie', 'descripcion'].some((k) => String(cuerpo[k] ?? '').trim())) {
      throw new Error('Escribe al menos la marca, el modelo, la serie o una descripción.');
    }
    let r: Equipo;
    if (nuevo) {
      // Al crear no se mandan campos vacíos.
      Object.keys(cuerpo).forEach((k) => { if (cuerpo[k] === '') delete cuerpo[k]; });
      if (ambito === 'USUARIO' && v.empleadoId) {
        cuerpo.empleadoId = Number(v.empleadoId);
        cuerpo.fechaEntrega = v.fechaEntrega || undefined;
        if (paraOtro) {
          if (!destino) throw new Error('Selecciona el puesto de quien usará el equipo.');
          cuerpo.puestoDestinatarioId = destino;
          if (persona) cuerpo.nombreDestinatario = persona;
        }
      }
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
        <select value={ambito} onChange={(e) => { setV((prev) => ({ ...prev, ambito: e.target.value, empleadoId: '' })); setDestinoJefe(DESTINO_PROPIO); }}>
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
        <Campo etiqueta={codigoFijo ? "Código de barras (único, no se puede modificar)" : "Código de barras"} opcional={nuevo} ancho>
          <div className="fila">
            <input className="mono" value={v.codigoBarras} onChange={poner('codigoBarras')} readOnly={codigoFijo} title={codigoFijo ? 'El código de barras es único y no se puede modificar' : undefined} placeholder={nuevo ? 'Vacío = se genera el siguiente consecutivo' : 'Escanéalo o escríbelo'} autoComplete="off" spellCheck={false} />
            {!codigoFijo && <button type="button" className="btn ghost sm" onClick={() => setV((p) => ({ ...p, codigoBarras: p.serie }))} disabled={!v.serie}>Usar serie</button>}
          </div>
        </Campo>
        {nuevo && (
          <>
            {ambito === 'USUARIO' && (
              <>
                <Campo etiqueta="Departamento">
                  <select value={departamentoId} onChange={(e) => { setDepartamentoId(e.target.value); setV((prev) => ({ ...prev, empleadoId: '' })); setDestinoJefe(DESTINO_PROPIO); }}>
                    <option value="">Todos los departamentos</option>
                    {(departamentos.datos ?? []).map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
                  </select>
                </Campo>
                <Campo etiqueta="Asignar a" opcional>
                  <select value={v.empleadoId} onChange={(e) => { setV((prev) => ({ ...prev, empleadoId: e.target.value })); setDestinoJefe(DESTINO_PROPIO); }}>
                    <option value="">Equipo disponible en inventario</option>
                    {empleadosFiltrados.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}{e.puesto ? ` — ${e.puesto.nombre}` : ''}
                      </option>
                    ))}
                  </select>
                </Campo>
                {esJefe && empleadoElegido && (
                  <DestinoJefe
                    jefe={empleadoElegido.nombre}
                    puestos={puestos.datos}
                    destino={destinoJefe}
                    onCambio={setDestinoJefe}
                  />
                )}
                {yaTiene && (
                  <p className="aviso ya" style={{ gridColumn: '1 / -1', margin: 0 }}>
                    <b>{quien} ya tiene {etiquetaTipo(tipo).toLowerCase()} asignado:</b> {nombreEquipo(yaTiene)}.
                    <span className="sub" style={{ display: 'block' }}>
                      Solo puede recibir otro si el anterior está dañado, en reparación, en resguardo o dado de baja.
                      {destino
                        ? !persona && ' Si es para otra persona del mismo puesto, escribe su nombre.'
                        : ' Si el equipo es para alguien más, elige “Para otra persona de su departamento”.'}
                    </span>
                  </p>
                )}
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
      {nuevo && puestos.error && <ErrorCarga mensaje={puestos.error} reintentar={puestos.recargar} />}
      {nuevo && jefe.error && <ErrorCarga mensaje={jefe.error} reintentar={jefe.recargar} />}
      {tipos.error && <ErrorCarga mensaje={tipos.error} reintentar={tipos.recargar} />}
      {marcas.error && <ErrorCarga mensaje={marcas.error} reintentar={marcas.recargar} />}
    </FormModal>
  );
}
