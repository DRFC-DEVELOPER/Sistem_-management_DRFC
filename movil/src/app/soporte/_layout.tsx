import { Stack } from 'expo-router';
import { ENCABEZADO } from '@/componentes/encabezado';
import { COLOR } from '@/lib/tipos';

/** Personal de soporte: las pestañas y, encima de ellas, la ficha del equipo. */
export default function LayoutSoporte() {
  return (
    <Stack screenOptions={{ ...ENCABEZADO, contentStyle: { backgroundColor: COLOR.fondo } }}>
      <Stack.Screen name="(pestanas)" options={{ headerShown: false }} />
      <Stack.Screen name="equipo/[id]" options={{ title: 'Equipo' }} />
    </Stack>
  );
}
