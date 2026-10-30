import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { api } from './api';
import { Usuario } from './tipos';

const CLAVE_DISPOSITIVO = 'inventario.push';

// Con la app abierta la notificación también se muestra.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Expo Go ya no permite notificaciones remotas en Android (desde el SDK 53); hace falta una build propia. */
const esExpoGoAndroid = Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * Pide permiso, obtiene el token de Expo de este celular y lo registra en la API para la cuenta actual.
 * Devuelve el motivo si no se pudo; nunca lanza, para no bloquear el uso de la app.
 */
async function registrar(): Promise<string | null> {
  if (!Device.isDevice) return 'Las notificaciones solo funcionan en un celular real.';
  if (esExpoGoAndroid) return 'Expo Go no recibe notificaciones en Android; instala la versión propia de la app.';
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'Falta ligar la app a un proyecto de EAS (npx eas-cli init).';
  if (Platform.OS === 'android') {
    // El canal debe existir antes de pedir permiso; la API manda los avisos al canal "default".
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Soporte', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 250, 250, 250], lightColor: '#2f6fa8',
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return 'No diste permiso para mostrar notificaciones.';
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api('/dispositivos', { cuerpo: { token, plataforma: Platform.OS === 'ios' ? 'ios' : 'android' } });
  await SecureStore.setItemAsync(CLAVE_DISPOSITIVO, token);
  return null;
}

/** Al cerrar sesión: este celular deja de recibir los avisos de la cuenta. */
export async function quitarDispositivo() {
  const token = await SecureStore.getItemAsync(CLAVE_DISPOSITIVO);
  if (!token) return;
  await api('/dispositivos', { metodo: 'DELETE', cuerpo: { token } }).catch(() => {});
  await SecureStore.deleteItemAsync(CLAVE_DISPOSITIVO);
}

/** Registra el celular cuando la sesión está lista y abre la pantalla que corresponde al tocar una notificación. */
export function useNotificaciones(usuario: Usuario | null) {
  const listo = !!usuario && !usuario.debeCambiarPassword;
  const esEmpleado = usuario?.rol === 'EMPLEADO';

  useEffect(() => {
    if (!listo) return;
    registrar()
      .then((motivo) => { if (motivo) console.info(`Notificaciones desactivadas: ${motivo}`); })
      .catch((e) => console.warn(`No se pudo registrar el celular para notificaciones: ${(e as Error).message}`));
  }, [listo, usuario?.id]);

  // Incluye la notificación que abrió la app estando cerrada.
  const respuesta = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!listo || !respuesta) return;
    const datos = respuesta.notification.request.content.data as { tipo?: string; equipoId?: number } | undefined;
    if (datos?.tipo !== 'reporte') return;
    if (esEmpleado) router.navigate('/empleado');
    else if (datos.equipoId) router.push({ pathname: '/soporte/equipo/[id]', params: { id: String(datos.equipoId) } });
    Notifications.clearLastNotificationResponse();
  }, [respuesta, listo, esEmpleado]);
}
