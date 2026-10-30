import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { router, Stack, useFocusEffect } from 'expo-router';
import { BotonSalir } from '@/componentes/BotonSalir';
import { Aviso, Boton, Campo, Pantalla, Sub, Tarjeta } from '@/componentes/ui';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';

// La etiqueta del equipo trae el mismo código (DRFC000123) en QR y en código de barras CODE128.
const TIPOS_CODIGO = ['qr', 'code128', 'code39', 'ean13'] as const;

/** Escáner del personal de soporte: lee la etiqueta y abre la ficha del equipo. */
export default function Escanear() {
  const { usuario } = useSesion();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const [activa, setActiva] = useState(true);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [buscando, setBuscando] = useState(false);
  // La cámara reporta el mismo código muchas veces por segundo; solo se atiende el primero.
  const ocupado = useRef(false);

  // Al regresar de la ficha, la cámara vuelve a leer.
  useFocusEffect(useCallback(() => {
    ocupado.current = false;
    setActiva(true);
    return () => setActiva(false);
  }, []));

  const buscar = async (texto: string) => {
    const c = texto.trim();
    if (!c || ocupado.current) return;
    ocupado.current = true;
    setError('');
    setBuscando(true);
    try {
      const e = await api<{ id: number }>(`/equipos/codigo/${encodeURIComponent(c)}`);
      setCodigo('');
      router.push({ pathname: '/soporte/equipo/[id]', params: { id: String(e.id) } });
    } catch (err) {
      setError((err as Error).message);
      // Espera un momento antes de volver a leer para no repetir el mismo error.
      setTimeout(() => { ocupado.current = false; }, 1500);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <Pantalla>
      <Stack.Screen options={{ headerRight: () => <BotonSalir /> }} />
      <Sub>Hola, {usuario?.nombre.split(' ')[0]}. Apunta la cámara al código QR o de barras de la etiqueta del equipo.</Sub>
      {!permiso ? null : permiso.granted ? (
        <View style={e.marco}>
          {activa && (
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: [...TIPOS_CODIGO] }}
              onBarcodeScanned={(r: BarcodeScanningResult) => buscar(r.data)}
            />
          )}
          <View style={e.guia} pointerEvents="none" />
          {buscando && <Text style={e.estado}>Buscando…</Text>}
        </View>
      ) : (
        <Tarjeta>
          <Sub>Para escanear, la app necesita permiso para usar la cámara.</Sub>
          {permiso.canAskAgain
            ? <Boton texto="Permitir cámara" onPress={pedirPermiso} />
            : <Aviso>El permiso está bloqueado. Actívalo en Ajustes del teléfono → Aplicaciones → Expo Go (o Inventario DRFC) → Permisos.</Aviso>}
        </Tarjeta>
      )}
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Tarjeta>
        <Campo etiqueta="O escribe el código o la serie" value={codigo} onChangeText={setCodigo} autoCapitalize="characters" autoCorrect={false} placeholder="DRFC000123" onSubmitEditing={() => buscar(codigo)} returnKeyType="search" />
        <Boton texto="Buscar" variante="secundario" onPress={() => buscar(codigo)} ocupado={buscando} />
      </Tarjeta>
    </Pantalla>
  );
}

const e = StyleSheet.create({
  marco: { height: 320, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  guia: { width: '70%', height: 150, borderWidth: 3, borderColor: '#fff', borderRadius: 12, opacity: 0.85 },
  estado: { position: 'absolute', bottom: 12, color: '#fff', fontWeight: '700', backgroundColor: 'rgba(0,0,0,.5)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999 },
});

