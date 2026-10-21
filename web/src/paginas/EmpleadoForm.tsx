import { useEffect, useState } from 'react';
import { api } from '../api';
import { Empleado, EmpleadoDetalle, Ref } from '../tipos';
import { Campo, FormModal, useAvisos } from '../ui';

export default function EmpleadoForm({ empleado, onCerrar, onGuardado }: { empleado?: EmpleadoDetalle; onCerrar: () => void; onGuardado: (e: Empleado) => void }) {
  const { avisar } = useAvisos();
  const [v, setV] = useState({
    nombre: empleado?.nombre ?? '', departamento: empleado?.departamento?.nombre ?? '', numero: empleado?.numero ?? '',
    correo: empleado?.correo ?? '', notas: empleado?.notas ?? '',
  });
  const [deptos, setDeptos] = useState<Ref[]>([]);
  useEffect(() => { api<Ref[]>('/departamentos').then(setDeptos).catch(() => undefined); }, []);
  const poner = (k: keyof typeof v) => (ev: { target: { value: string } }) => setV((p) => ({ ...p, [k]: ev.target.value }));

  return (
    <FormModal titulo={empleado ? 'Editar empleado' : 'Dar de alta empleado'} boton={empleado ? 'Guardar cambios' : 'Dar de alta'} onCerrar={onCerrar} onEnviar={async () => {
      if (!v.nombre.trim()) throw new Error('Escribe el nombre del empleado.');
      const cuerpo = empleado ? v : Object.fromEntries(Object.entries(v).filter(([, x]) => x.trim()));
      const r = empleado
        ? await api<Empleado>(`/empleados/${empleado.id}`, { metodo: 'PATCH', cuerpo })
        : await api<Empleado>('/empleados', { cuerpo });
      avisar(empleado ? 'Cambios guardados' : 'Empleado dado de alta');
      onGuardado(r);
    }}>
      <Campo etiqueta="Nombre completo"><input value={v.nombre} onChange={poner('nombre')} autoComplete="off" /></Campo>
      <div className="dos-col">
        <Campo etiqueta="Departamento">
          <input value={v.departamento} onChange={poner('departamento')} list="lista-deptos" autoComplete="off" />
          <datalist id="lista-deptos">{deptos.map((d) => <option key={d.id} value={d.nombre} />)}</datalist>
        </Campo>
        <Campo etiqueta="Número de empleado o extensión" opcional><input value={v.numero} onChange={poner('numero')} autoComplete="off" /></Campo>
        <Campo etiqueta="Correo" opcional ancho><input type="email" value={v.correo} onChange={poner('correo')} autoComplete="off" /></Campo>
        <Campo etiqueta="Notas" ancho><textarea value={v.notas} onChange={poner('notas')} rows={2} /></Campo>
      </div>
    </FormModal>
  );
}
