import { useEffect, useState } from 'react';
import { api } from '../api';
import { CAMPOS, Equipo, EquipoDetalle, EmpleadoListado, hoy, Tipo, TIPOS } from '../tipos';
import { Campo, FormModal, useAvisos } from '../ui';

type Valores = Record<string, string>;

/** Alta o edición de un equipo. Al crear se puede asignar de inmediato. */
export default function EquipoForm({ equipo, onCerrar, onGuardado, empleadoInicial }: {
  equipo?: Equipo; onCerrar: () => void; onGuardado: (e: Equipo) => void; empleadoInicial?: number;
}) {
  const { avisar } = useAvisos();
  const nuevo = !equipo;
  const [v, setV] = useState<Valores>(() => {
    const base: Valores = { tipo: equipo?.tipo ?? 'LAPTOP', codigoBarras: equipo?.codigoBarras ?? '', notas: equipo?.notas ?? '' };
    CAMPOS.forEach((c) => (base[c.clave] = (equipo?.[c.clave] as string | null) ?? (c.opciones ? c.opciones[0][0] : '')));
    if (equipo?.tipoAdaptador) base.tipoAdaptador = equipo.tipoAdaptador;
    return { ...base, estatusInicial: 'DISPONIBLE', empleadoId: empleadoInicial ? String(empleadoInicial) : '', fechaEntrega: hoy() };
  });
  const [empleados, setEmpleados] = useState<EmpleadoListado[]>([]);
  useEffect(() => { if (nuevo) api<EmpleadoListado[]>('/empleados').then(setEmpleados).catch(() => undefined); }, [nuevo]);

  const tipo = v.tipo as Tipo;
  const aplica = CAMPOS.filter((c) => !c.tipos || c.tipos.includes(tipo));
  const poner = (k: string) => (ev: { target: { value: string } }) => setV((p) => ({ ...p, [k]: ev.target.value }));

  const enviar = async () => {
    const cuerpo: Record<string, unknown> = { tipo, codigoBarras: v.codigoBarras, notas: v.notas };
    CAMPOS.forEach((c) => { cuerpo[c.clave] = aplica.includes(c) ? v[c.clave] : ''; });
    if (tipo !== 'ADAPTADOR') delete cuerpo.tipoAdaptador;
    if (!['marca', 'modelo', 'serie', 'descripcion'].some((k) => String(cuerpo[k] ?? '').trim())) {
      throw new Error('Escribe al menos la marca, el modelo, la serie o una descripción.');
    }
    let r: Equipo;
    if (nuevo) {
      // Al crear no se mandan campos vacíos.
      Object.keys(cuerpo).forEach((k) => { if (cuerpo[k] === '') delete cuerpo[k]; });
      if (v.empleadoId) { cuerpo.empleadoId = Number(v.empleadoId); cuerpo.fechaEntrega = v.fechaEntrega || undefined; }
      else cuerpo.estatusInicial = v.estatusInicial;
      r = await api<EquipoDetalle>('/equipos', { cuerpo });
      avisar(v.empleadoId ? 'Equipo registrado y asignado' : 'Equipo registrado');
    } else {
      r = await api<Equipo>(`/equipos/${equipo.id}`, { metodo: 'PATCH', cuerpo });
      avisar('Cambios guardados');
    }
    onGuardado(r);
  };

  return (
    <FormModal titulo={nuevo ? 'Registrar equipo' : 'Editar equipo'} boton={nuevo ? 'Guardar equipo' : 'Guardar cambios'} onCerrar={onCerrar} onEnviar={enviar} ancho>
      <Campo etiqueta="Tipo de equipo">
        <select value={tipo} onChange={poner('tipo')}>
          {Object.entries(TIPOS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </Campo>
      <div className="dos-col">
        {aplica.map((c) => (
          <Campo key={c.clave} etiqueta={c.etiqueta}>
            {c.opciones ? (
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
            <Campo etiqueta="Asignar a" opcional>
              <select value={v.empleadoId} onChange={poner('empleadoId')}>
                <option value="">Sin asignar</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}{e.departamento ? ` (${e.departamento.nombre})` : ''}</option>)}
              </select>
            </Campo>
            {v.empleadoId ? (
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
    </FormModal>
  );
}
