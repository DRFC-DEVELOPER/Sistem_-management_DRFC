import { Alert, Pressable, Text } from 'react-native';
import { useSesion } from '@/lib/sesion';

/** Va en el encabezado de las pantallas de inicio. */
export function BotonSalir() {
  const { salir } = useSesion();
  const preguntar = () => Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: salir },
  ]);
  return (
    <Pressable onPress={preguntar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar sesión">
      <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Salir</Text>
    </Pressable>
  );
}
