import { useState } from 'react';
import { router } from 'expo-router';
import { Aviso, Boton, Campo, Pantalla, Sub, Tarjeta } from '@/componentes/ui';
import { useSesion } from '@/lib/sesion';

/** Obligatoria cuando el admin dio una contraseña temporal; la API no deja hacer nada más mientras tanto. */
export default function CambiarClave() {
  const { usuario, claveIngresada, cambiarPassword, salir } = useSesion();
  // Si se acaba de entrar con la temporal, no se vuelve a pedir; si la sesión venía guardada, sí.
  const [actual, setActual] = useState(claveIngresada ?? '');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    if (nueva.length < 10) return setError('La contraseña nueva debe tener al menos 10 caracteres.');
    if (nueva !== confirmar) return setError('Las contraseñas nuevas no coinciden.');
    setError('');
    setOcupado(true);
    try {
      await cambiarPassword(actual, nueva);
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Pantalla>
      <Tarjeta>
        <Sub>Hola, {usuario?.nombre}. Por seguridad, cambia la contraseña temporal que te dio soporte por una que solo tú conozcas.</Sub>
        {!claveIngresada && <Campo etiqueta="Contraseña temporal" value={actual} onChangeText={setActual} secureTextEntry />}
        <Campo etiqueta="Contraseña nueva (mínimo 10 caracteres)" value={nueva} onChangeText={setNueva} secureTextEntry autoComplete="new-password" />
        <Campo etiqueta="Repite la contraseña nueva" value={confirmar} onChangeText={setConfirmar} secureTextEntry autoComplete="new-password" onSubmitEditing={enviar} />
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        <Boton texto="Guardar contraseña" onPress={enviar} ocupado={ocupado} />
        <Boton texto="Salir" variante="secundario" onPress={salir} />
      </Tarjeta>
    </Pantalla>
  );
}
