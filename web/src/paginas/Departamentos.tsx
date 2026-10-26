import { useState } from 'react';
import { api } from '../api';
import { useCarga } from '../usar';
import { Campo, Cargando, ErrorCarga, FormModal, Modal, useAvisos } from '../ui';

interface Departamento { id: number; nombre: string; empleadosActivos: number }

export default function Departamentos() {
  const { datos, error, recargar } = useCarga(() => api<Departamento[]>('/departamentos'), []);
  const [editar, setEditar] = useState<Departamento | 'nuevo' | null>(null);
  const [puestosDe, setPuestosDe] = useState<Departamento | null>(null);
  const { confirmar, avisar } = useAvisos();

  const eliminar = async (departamento: Departamento) => {
    if (!await confirmar({
      titulo: 'Eliminar departamento',
      mensaje: `Se eliminará ${departamento.nombre}. Solo se puede eliminar si no tiene empleados asignados.`,
      boton: 'Eliminar departamento',
      peligro: true,
    })) return;
    try {
      await api(`/departamentos/${departamento.id}`, { metodo: 'DELETE' });
      avisar('Departamento eliminado');
      recargar();
    } catch (e) {
      avisar((e as Error).message);
    }
  };

  return (
    <>
      <div className="encabezado">
        <div>
          <h1>Departamentos</h1>
          <p className="sub" style={{ margin: '4px 0 0' }}>Organiza a los empleados por área.</p>
        </div>
        <button className="btn" onClick={() => setEditar('nuevo')}>Agregar departamento</button>
      </div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : (
        <section className="panel desliza">
          <table className="tabla">
            <thead><tr><th>Departamento</th><th>Empleados activos</th><th></th></tr></thead>
            <tbody>
              {datos.map((d) => (
                <tr key={d.id}>
                  <td>{d.nombre}</td>
                  <td>{d.empleadosActivos}</td>
                  <td className="n">
                    <div className="acciones">
                      <button className="btn ghost sm" onClick={() => setPuestosDe(d)}>Puestos</button>
                      <button className="btn ghost sm" onClick={() => setEditar(d)}>Editar</button>
                      <button className="btn peligro sm" onClick={() => eliminar(d)}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!datos.length && <p className="sub">Aún no hay departamentos. Agrega uno para organizar a los empleados.</p>}
        </section>
      )}
      {editar && (
        <FormularioDepartamento
          departamento={editar === 'nuevo' ? undefined : editar}
          onCerrar={() => setEditar(null)}
          onGuardado={() => { setEditar(null); recargar(); }}
        />
      )}
      {puestosDe && <PuestosDepartamento departamento={puestosDe} onCerrar={() => setPuestosDe(null)} />}
    </>
  );
}

interface Puesto { id: number; nombre: string }

function PuestosDepartamento({ departamento, onCerrar }: { departamento: Departamento; onCerrar: () => void }) {
  const ruta = `/departamentos/${departamento.id}/puestos`;
  const { datos, error, recargar } = useCarga(() => api<Puesto[]>(ruta), [ruta]);
  const [editar, setEditar] = useState<Puesto | 'nuevo' | null>(null);
  const { avisar, confirmar } = useAvisos();
  const eliminar = async (puesto: Puesto) => {
    if (!await confirmar({ titulo: 'Eliminar puesto', mensaje: `Se eliminará “${puesto.nombre}”. Solo se puede eliminar si ningún empleado lo tiene asignado.`, boton: 'Eliminar puesto', peligro: true })) return;
    try {
      await api(`${ruta}/${puesto.id}`, { metodo: 'DELETE' });
      avisar('Puesto eliminado');
      recargar();
    } catch (e) { avisar((e as Error).message); }
  };
  return (
    <Modal titulo={`Puestos de ${departamento.nombre}`} sub="Los puestos se pueden asignar a empleados de este departamento." onCerrar={onCerrar} ancho>
      <div className="acciones" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => setEditar('nuevo')}>Agregar puesto</button>
      </div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : (
        <section className="panel desliza">
          <table className="tabla">
            <thead><tr><th>Puesto</th><th></th></tr></thead>
            <tbody>{datos.map((p) => (
              <tr key={p.id}><td>{p.nombre}</td><td className="n"><div className="acciones">
                <button className="btn ghost sm" onClick={() => setEditar(p)}>Editar</button>
                <button className="btn peligro sm" onClick={() => eliminar(p)}>Eliminar</button>
              </div></td></tr>
            ))}</tbody>
          </table>
          {!datos.length && <p className="sub">Aún no hay puestos para este departamento.</p>}
        </section>
      )}
      {editar && <FormularioPuesto
        departamentoId={departamento.id}
        puesto={editar === 'nuevo' ? undefined : editar}
        onCerrar={() => setEditar(null)}
        onGuardado={() => { setEditar(null); recargar(); }}
      />}
    </Modal>
  );
}

function FormularioPuesto({ departamentoId, puesto, onCerrar, onGuardado }: {
  departamentoId: number;
  puesto?: Puesto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { avisar } = useAvisos();
  const [nombre, setNombre] = useState(puesto?.nombre ?? '');
  const ruta = `/departamentos/${departamentoId}/puestos`;
  return (
    <FormModal titulo={puesto ? 'Editar puesto' : 'Agregar puesto'} boton={puesto ? 'Guardar cambios' : 'Agregar puesto'} onCerrar={onCerrar} onEnviar={async () => {
      if (puesto) {
        await api(`${ruta}/${puesto.id}`, { metodo: 'PATCH', cuerpo: { nombre } });
        avisar('Puesto actualizado');
      } else {
        await api(ruta, { cuerpo: { nombre } });
        avisar('Puesto agregado');
      }
      onGuardado();
    }}>
      <Campo etiqueta="Nombre del puesto"><input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoComplete="organization-title" /></Campo>
    </FormModal>
  );
}

function FormularioDepartamento({ departamento, onCerrar, onGuardado }: {
  departamento?: Departamento; onCerrar: () => void; onGuardado: () => void;
}) {
  const { avisar } = useAvisos();
  const [nombre, setNombre] = useState(departamento?.nombre ?? '');
  return (
    <FormModal
      titulo={departamento ? 'Editar departamento' : 'Agregar departamento'}
      boton={departamento ? 'Guardar cambios' : 'Agregar departamento'}
      onCerrar={onCerrar}
      onEnviar={async () => {
        if (departamento) {
          await api(`/departamentos/${departamento.id}`, { metodo: 'PATCH', cuerpo: { nombre } });
          avisar('Departamento actualizado');
        } else {
          await api('/departamentos', { cuerpo: { nombre } });
          avisar('Departamento agregado');
        }
        onGuardado();
      }}
    >
      <Campo etiqueta="Nombre del departamento">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoComplete="organization" />
      </Campo>
    </FormModal>
  );
}
