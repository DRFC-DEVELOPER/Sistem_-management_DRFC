import { useState } from 'react';
import { api } from '../api';
import { Campo, FormModal, useAvisos } from '../ui';

export default function CambiarPassword({ onCerrar }: { onCerrar: () => void }) {
  const { avisar } = useAvisos();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  return (
    <FormModal titulo="Cambiar contraseña" boton="Guardar contraseña" onCerrar={onCerrar} onEnviar={async () => {
      if (nueva !== repetir) throw new Error('La contraseña nueva no coincide en los dos campos.');
      await api('/auth/password', { metodo: 'PATCH', cuerpo: { actual, nueva } });
      avisar('Contraseña actualizada');
      onCerrar();
    }}>
      <Campo etiqueta="Contraseña actual"><input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} /></Campo>
      <Campo etiqueta="Contraseña nueva (mínimo 10 caracteres)"><input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} /></Campo>
      <Campo etiqueta="Repite la contraseña nueva"><input type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} /></Campo>
    </FormModal>
  );
}
