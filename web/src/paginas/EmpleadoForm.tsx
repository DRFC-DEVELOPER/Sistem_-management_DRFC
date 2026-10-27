import { useEffect, useState } from 'react';
import { api } from '../api';
import { agregarAColaResponsivas } from '../responsiva';
import { Empleado, EmpleadoDetalle, Ref } from '../tipos';
import { Campo, FormModal, useAvisos } from '../ui';

export default function EmpleadoForm({ empleado, onCerrar, onGuardado }: { empleado?: EmpleadoDetalle; onCerrar: () => void; onGuardado: (e: Empleado) => void }) {
  const { avisar } = useAvisos();
  const [v, setV] = useState({
    nombre: empleado?.nombre ?? '', departamento: empleado?.departamento?.nombre ?? '', numero: empleado?.numero ?? '',
    correo: empleado?.correo ?? '', notas: empleado?.notas ?? '', puestoId: empleado?.puestoId ? String(empleado.puestoId) : '',
  });
  const [deptos, setDeptos] = useState<Ref[]>([]);
  const [puestos, setPuestos] = useState<Ref[]>([]);
  const [errorPuestos, setErrorPuestos] = useState('');
  const [agregarCartaACola, setAgregarCartaACola] = useState(!empleado);
  useEffect(() => { api<Ref[]>('/departamentos').then(setDeptos).catch((e: Error) => avisar(e.message)); }, []);
  const departamento = deptos.find((d) => d.nombre.toLocaleLowerCase() === v.departamento.trim().toLocaleLowerCase());
  useEffect(() => {
    let cancelado = false;
    setPuestos([]);
    setErrorPuestos('');
    if (!departamento) return () => { cancelado = true; };
    api<Ref[]>(`/departamentos/${departamento.id}/puestos`)
      .then((r) => { if (!cancelado) setPuestos(r); })
      .catch((e: Error) => { if (!cancelado) setErrorPuestos(e.message); });
    return () => { cancelado = true; };
  }, [departamento?.id]);
  const poner = (k: keyof typeof v) => (ev: { target: { value: string } }) => setV((p) => ({ ...p, [k]: ev.target.value }));
  const ponerDepartamento = (ev: { target: { value: string } }) => setV((p) => ({ ...p, departamento: ev.target.value, puestoId: '' }));

  return (
    <FormModal titulo={empleado ? 'Editar empleado' : 'Dar de alta empleado'} boton={empleado ? 'Guardar cambios' : 'Dar de alta'} onCerrar={onCerrar} onEnviar={async () => {
      if (!v.nombre.trim()) throw new Error('Escribe el nombre del empleado.');
      const cuerpo = {
        nombre: v.nombre,
        departamento: v.departamento,
        numero: v.numero,
        correo: v.correo,
        notas: v.notas,
        puestoId: v.puestoId ? Number(v.puestoId) : null,
      };
      const r = empleado
        ? await api<Empleado>(`/empleados/${empleado.id}`, { metodo: 'PATCH', cuerpo })
        : await api<Empleado>('/empleados', { cuerpo });
      if (!empleado) {
        const enCola = !agregarCartaACola || agregarAColaResponsivas(r.id);
        avisar(agregarCartaACola
          ? enCola ? 'Empleado dado de alta y agregado a la cola de cartas' : 'Empleado dado de alta, pero no se pudo guardar en la cola de cartas'
          : 'Empleado dado de alta');
      } else {
        avisar('Cambios guardados');
      }
      onGuardado(r);
    }}>
      <Campo etiqueta="Nombre completo"><input value={v.nombre} onChange={poner('nombre')} autoComplete="off" /></Campo>
      <div className="dos-col">
        <Campo etiqueta="Departamento">
          <input value={v.departamento} onChange={ponerDepartamento} list="lista-deptos" autoComplete="off" />
          <datalist id="lista-deptos">{deptos.map((d) => <option key={d.id} value={d.nombre} />)}</datalist>
        </Campo>
        <Campo etiqueta="Puesto" opcional>
          <select value={v.puestoId} onChange={poner('puestoId')} disabled={!departamento || !puestos.length}>
            <option value="">{departamento ? 'Sin puesto' : 'Primero elige un departamento'}</option>
            {puestos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Número de empleado o extensión" opcional><input value={v.numero} onChange={poner('numero')} autoComplete="off" /></Campo>
        <Campo etiqueta="Correo" opcional ancho><input type="email" value={v.correo} onChange={poner('correo')} autoComplete="off" /></Campo>
        <Campo etiqueta="Notas" ancho><textarea value={v.notas} onChange={poner('notas')} rows={2} /></Campo>
      </div>
      {!empleado && (
        <label className="casilla">
          <input type="checkbox" checked={agregarCartaACola} onChange={(e) => setAgregarCartaACola(e.target.checked)} />
          Agregar a la cola para generar su carta responsiva
        </label>
      )}
      {errorPuestos && <p className="error" role="alert">{errorPuestos}</p>}
    </FormModal>
  );
}
