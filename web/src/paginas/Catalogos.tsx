import { useState } from 'react';
import { api } from '../api';
import { useCarga } from '../usar';
import { etiquetaTipo, TipoEquipoCatalogo } from '../tipos';
import { Campo, Cargando, ErrorCarga, FormModal, useAvisos } from '../ui';

interface Marca { id: number; nombre: string }

export function TiposEquipoCatalogoVista() {
  const { datos, error, recargar } = useCarga(() => api<TipoEquipoCatalogo[]>('/catalogos/tipos-equipo'), []);
  const [editar, setEditar] = useState<TipoEquipoCatalogo | 'nuevo' | null>(null);
  const { avisar, confirmar } = useAvisos();

  const eliminar = async (tipo: TipoEquipoCatalogo) => {
    if (!await confirmar({ titulo: 'Eliminar tipo de equipo', mensaje: `Se eliminará “${tipo.nombre}”. No se puede borrar mientras existan equipos de ese tipo.`, boton: 'Eliminar tipo', peligro: true })) return;
    try {
      await api(`/catalogos/tipos-equipo/${encodeURIComponent(tipo.nombre)}`, { metodo: 'DELETE' });
      avisar('Tipo eliminado');
      recargar();
    } catch (e) { avisar((e as Error).message); }
  };

  return (
    <>
      <div className="encabezado">
        <div><h1>Tipos de equipo</h1><p className="sub" style={{ margin: '4px 0 0' }}>Agrega categorías para clasificar equipos del inventario.</p></div>
        <button className="btn" onClick={() => setEditar('nuevo')}>Agregar tipo</button>
      </div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : (
        <section className="panel desliza">
          <table className="tabla">
            <thead><tr><th>Tipo de equipo</th><th>Origen</th><th></th></tr></thead>
            <tbody>{datos.map((t) => (
              <tr key={t.nombre}>
                <td>{etiquetaTipo(t.nombre)}</td>
                <td>{t.predeterminado ? 'Incluido en el sistema' : 'Agregado'}</td>
                <td className="n"><div className="acciones">
                  {!t.predeterminado && <button className="btn ghost sm" onClick={() => setEditar(t)}>Editar</button>}
                  {!t.predeterminado && <button className="btn peligro sm" onClick={() => eliminar(t)}>Eliminar</button>}
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
      {editar && <FormularioCatalogo
        titulo={editar === 'nuevo' ? 'Agregar tipo de equipo' : 'Editar tipo de equipo'}
        ruta="/catalogos/tipos-equipo"
        valor={editar === 'nuevo' ? undefined : { id: editar.nombre, nombre: editar.nombre }}
        onCerrar={() => setEditar(null)}
        onGuardado={() => { setEditar(null); recargar(); }}
      />}
    </>
  );
}

export function MarcasCatalogoVista() {
  const { datos, error, recargar } = useCarga(() => api<Marca[]>('/catalogos/marcas'), []);
  const [editar, setEditar] = useState<Marca | 'nuevo' | null>(null);
  const { avisar, confirmar } = useAvisos();

  const eliminar = async (marca: Marca) => {
    if (!await confirmar({ titulo: 'Eliminar marca', mensaje: `Se eliminará “${marca.nombre}”. No se puede borrar mientras esté asociada a equipos.`, boton: 'Eliminar marca', peligro: true })) return;
    try {
      await api(`/catalogos/marcas/${marca.id}`, { metodo: 'DELETE' });
      avisar('Marca eliminada');
      recargar();
    } catch (e) { avisar((e as Error).message); }
  };

  return (
    <>
      <div className="encabezado">
        <div><h1>Marcas</h1><p className="sub" style={{ margin: '4px 0 0' }}>Las marcas registradas aquí aparecen en el formulario de equipos.</p></div>
        <button className="btn" onClick={() => setEditar('nuevo')}>Agregar marca</button>
      </div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : (
        <section className="panel desliza">
          <table className="tabla">
            <thead><tr><th>Marca</th><th></th></tr></thead>
            <tbody>{datos.map((m) => (
              <tr key={m.id}>
                <td>{m.nombre}</td>
                <td className="n"><div className="acciones">
                  <button className="btn ghost sm" onClick={() => setEditar(m)}>Editar</button>
                  <button className="btn peligro sm" onClick={() => eliminar(m)}>Eliminar</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      )}
      {editar && <FormularioCatalogo
        titulo={editar === 'nuevo' ? 'Agregar marca' : 'Editar marca'}
        ruta="/catalogos/marcas"
        valor={editar === 'nuevo' ? undefined : editar}
        onCerrar={() => setEditar(null)}
        onGuardado={() => { setEditar(null); recargar(); }}
      />}
    </>
  );
}

function FormularioCatalogo({ titulo, ruta, valor, onCerrar, onGuardado }: {
  titulo: string;
  ruta: string;
  valor?: { id: number | string; nombre: string };
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { avisar } = useAvisos();
  const [nombre, setNombre] = useState(valor?.nombre ?? '');
  return (
    <FormModal titulo={titulo} boton={valor ? 'Guardar cambios' : 'Agregar'} onCerrar={onCerrar} onEnviar={async () => {
      if (valor) {
        const id = typeof valor.id === 'string' ? encodeURIComponent(valor.id) : valor.id;
        await api(`${ruta}/${id}`, { metodo: 'PATCH', cuerpo: { nombre } });
        avisar('Cambios guardados');
      } else {
        await api(ruta, { cuerpo: { nombre } });
        avisar('Catálogo actualizado');
      }
      onGuardado();
    }}>
      <Campo etiqueta="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} autoComplete="off" /></Campo>
    </FormModal>
  );
}
