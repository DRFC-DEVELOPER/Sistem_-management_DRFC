import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { Canvas, Group, Skia, Skottie, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';

// Animación "Live chatbot" (LottieFiles). Se reproduce con Skottie de Skia porque
// lottie-react-native no viene incluido en Expo Go; el .lottie es un zip y aquí está su JSON.
const ANIMACION = require('../../assets/animaciones/cargando.json');
const ANCHO_ANIMACION = 952;
const ALTO_ANIMACION = 784;
const AZUL_FONDO = '#003e58';

/** Pantalla de carga al iniciar sesión. Aparece y desaparece desvaneciéndose. */
export function CargaSesion({ visible }: { visible: boolean }) {
  const { width } = useWindowDimensions();
  const [montada, setMontada] = useState(visible);
  const opacidad = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMontada(true);
    Animated.timing(opacidad, { toValue: visible ? 1 : 0, duration: visible ? 250 : 450, useNativeDriver: true }).start(({ finished }) => {
      if (finished && !visible) setMontada(false);
    });
  }, [visible, opacidad]);

  if (!montada) return null;
  const ancho = Math.min(width * 0.75, 340);
  return (
    <Animated.View style={[StyleSheet.absoluteFill, e.fondo, { opacity: opacidad }]} accessibilityLabel="Iniciando sesión" accessibilityLiveRegion="polite">
      <Animacion ancho={ancho} />
      <Text style={e.texto}>Iniciando sesión…</Text>
    </Animated.View>
  );
}

function Animacion({ ancho }: { ancho: number }) {
  const animacion = useMemo(() => Skia.Skottie.Make(JSON.stringify(ANIMACION)), []);
  const cuadros = animacion.duration() * animacion.fps();
  const fps = animacion.fps();
  // Repite la animación en bucle mientras la pantalla está abierta.
  const reloj = useClock();
  const cuadro = useDerivedValue(() => ((reloj.value / 1000) * fps) % cuadros);
  const escala = ancho / ANCHO_ANIMACION;
  return (
    <Canvas style={{ width: ancho, height: ALTO_ANIMACION * escala }}>
      <Group transform={[{ scale: escala }]}>
        <Skottie animation={animacion} frame={cuadro} />
      </Group>
    </Canvas>
  );
}

const e = StyleSheet.create({
  fondo: { backgroundColor: AZUL_FONDO, alignItems: 'center', justifyContent: 'center', gap: 12 },
  texto: { color: '#fff', fontSize: 17, fontWeight: '600' },
});
