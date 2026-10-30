import { useState } from 'react';
import { Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Aviso, Boton, Campo, Pantalla, Sub, Tarjeta, Titulo } from '@/componentes/ui';
import { api } from '@/lib/api';

/** El empleado describe la falla; a soporte le llega a su bandeja. El estatus del equipo no cambia. */
export default function Reportar() {
  const { id, nombre } = useLocalSearchParams<{ id: string; nombre?: string }>();
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    if (descripcion.trim().length < 5) return setError('Describe la falla (al menos 5 caracteres).');
    setError('');
    setOcupado(true);
    try {
      await api('/mi/reportes', { cuerpo: { equipoId: Number(id), descripcion: descripcion.trim() } });
      Alert.alert('Reporte enviado', 'Soporte ya recibió tu reporte. Aquí verás su respuesta.');
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Pantalla>
      <Tarjeta>
        <Titulo>{nombre ?? 'Equipo'}</Titulo>
        <Sub>Cuéntanos qué le pasa al equipo. Soporte recibirá tu reporte y te responderá aquí mismo.</Sub>
        <Campo etiqueta="¿Qué falla tiene?" value={descripcion} onChangeText={setDescripcion} multiline maxLength={1000} placeholder="Por ejemplo: no enciende, la pantalla parpadea, la batería no carga…" />
        {error ? <Aviso tipo="error">{error}</Aviso> : null}
        <Boton texto="Enviar reporte" onPress={enviar} ocupado={ocupado} />
        <Boton texto="Cancelar" variante="secundario" onPress={() => router.back()} />
      </Tarjeta>
    </Pantalla>
  );
}
