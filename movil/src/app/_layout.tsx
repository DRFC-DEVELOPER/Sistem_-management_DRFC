import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Bienvenida } from '@/componentes/Bienvenida';
import { useNotificaciones } from '@/lib/notificaciones';
import { ProveedorSesion, useSesion } from '@/lib/sesion';
import { COLOR } from '@/lib/tipos';

// La pantalla de arranque nativa se mantiene hasta que se dibuja la bienvenida, que tiene el mismo fondo.
SplashScreen.preventAutoHideAsync();

export default function Raiz() {
  useEffect(() => { SplashScreen.hide(); }, []);
  return (
    <SafeAreaProvider>
      <ProveedorSesion>
        <StatusBar style="light" />
        <Navegacion />
      </ProveedorSesion>
    </SafeAreaProvider>
  );
}

/**
 * Cada grupo de pantallas solo existe para quien le corresponde:
 * sin sesión → entrar; con contraseña temporal → cambiarla; empleado → sus equipos; personal → escáner.
 */
function Navegacion() {
  const { usuario, cargando } = useSesion();
  useNotificaciones(usuario);
  // La bienvenida se muestra cada vez que se abre la app y cubre la carga de la sesión.
  const [bienvenidaVista, setBienvenidaVista] = useState(false);
  const listo = !!usuario && !usuario.debeCambiarPassword;
  const esEmpleado = usuario?.rol === 'EMPLEADO';
  return (
    <View style={{ flex: 1, backgroundColor: COLOR.tinta }}>
      {!cargando && <Pantallas usuario={!!usuario} debeCambiar={!!usuario?.debeCambiarPassword} listo={listo} esEmpleado={esEmpleado} />}
      {!bienvenidaVista && <Bienvenida listo={!cargando} onFin={() => setBienvenidaVista(true)} />}
    </View>
  );
}

function Pantallas({ usuario, debeCambiar, listo, esEmpleado }: { usuario: boolean; debeCambiar: boolean; listo: boolean; esEmpleado: boolean }) {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLOR.tinta },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: COLOR.fondo },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={!usuario}>
        <Stack.Screen name="entrar" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={usuario && debeCambiar}>
        <Stack.Screen name="cambiar-clave" options={{ title: 'Nueva contraseña' }} />
      </Stack.Protected>
      <Stack.Protected guard={listo && esEmpleado}>
        <Stack.Screen name="empleado/index" options={{ title: 'Mis equipos' }} />
        <Stack.Screen name="empleado/reportar" options={{ title: 'Reportar falla', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={listo && !esEmpleado}>
        <Stack.Screen name="soporte/index" options={{ title: 'Escanear equipo' }} />
        <Stack.Screen name="soporte/equipo/[id]" options={{ title: 'Equipo' }} />
      </Stack.Protected>
    </Stack>
  );
}
