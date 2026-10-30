import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { BarraPestanas } from '@/componentes/BarraPestanas';
import { ENCABEZADO } from '@/componentes/encabezado';
import { COLOR } from '@/lib/tipos';
import { useResumenSoporte } from '@/lib/usar';

// Si se entra directo a otra pantalla (por ejemplo, desde una notificación), al regresar se llega a Inicio.
export const unstable_settings = { initialRouteName: 'index' };

/** Pestañas del personal: escáner, inicio, solicitudes de soporte y su perfil. */
export default function Pestanas() {
  const { pendientes, enAtencion } = useResumenSoporte();
  const abiertas = pendientes + enAtencion;
  return (
    <Tabs
      tabBar={(props) => <BarraPestanas {...props} />}
      screenOptions={{ ...ENCABEZADO, sceneStyle: { backgroundColor: COLOR.fondo } }}
    >
      <Tabs.Screen
        name="escanear"
        options={{ title: 'Escanear equipo', tabBarAccessibilityLabel: 'Escanear', tabBarIcon: ({ size }) => <Ionicons name="qr-code-outline" size={size} color="#fff" /> }}
      />
      <Tabs.Screen
        name="index"
        options={{ title: 'Inicio', tabBarIcon: ({ size }) => <Ionicons name="home-outline" size={size} color="#fff" /> }}
      />
      <Tabs.Screen
        name="avisos"
        options={{
          title: 'Solicitudes de soporte', tabBarAccessibilityLabel: `Solicitudes de soporte, ${abiertas} sin cerrar`,
          tabBarBadge: abiertas || undefined,
          tabBarIcon: ({ size }) => <Ionicons name="chatbox-ellipses-outline" size={size} color="#fff" />,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Mi perfil', tabBarIcon: ({ size }) => <Ionicons name="person-circle-outline" size={size} color="#fff" /> }}
      />
    </Tabs>
  );
}
