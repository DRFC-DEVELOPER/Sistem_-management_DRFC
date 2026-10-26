import { useState } from 'react';
import Departamentos from './Departamentos';
import { MarcasCatalogoVista, TiposEquipoCatalogoVista } from './Catalogos';

type SeccionAlta = 'departamentos' | 'tipos' | 'marcas';

const SECCIONES: { id: SeccionAlta; nombre: string }[] = [
  { id: 'departamentos', nombre: 'Departamentos y puestos' },
  { id: 'tipos', nombre: 'Tipos de equipo' },
  { id: 'marcas', nombre: 'Marcas' },
];

export default function Altas() {
  const [seccion, setSeccion] = useState<SeccionAlta>('departamentos');
  return (
    <>
      <div className="chips" role="tablist" aria-label="Catálogos de altas">
        {SECCIONES.map((s) => (
          <button key={s.id} className="chip" role="tab" aria-selected={seccion === s.id} onClick={() => setSeccion(s.id)}>{s.nombre}</button>
        ))}
      </div>
      {seccion === 'departamentos' && <Departamentos />}
      {seccion === 'tipos' && <TiposEquipoCatalogoVista />}
      {seccion === 'marcas' && <MarcasCatalogoVista />}
    </>
  );
}
