import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

// Medidas tomadas del diseño (392 × 680); todo se escala al ancho de la pantalla.
const ANCHO_DISENO = 392;
const AZUL_FONDO = '#003e58';
const AZUL_TEXTO = '#2d719d';
// En total dura 5 s: aparece, se queda y se desvanece.
const APARECER = 800;
const DESVANECER = 900;
const DURACION_MINIMA = 5000 - DESVANECER;

/**
 * Presentación al abrir la app. Se queda al menos `DURACION_MINIMA` y hasta que la sesión termina de cargar;
 * tocarla la cierra antes. Usa el mismo azul que la pantalla de arranque nativa para que no haya salto.
 */
export function Bienvenida({ listo, onFin }: { listo: boolean; onFin: () => void }) {
  const { width, height } = useWindowDimensions();
  const s = width / ANCHO_DISENO;
  const opacidad = useRef(new Animated.Value(1)).current;
  const entrada = useRef(new Animated.Value(0)).current;
  const [tiempoCumplido, setTiempoCumplido] = useState(false);
  const cerrando = useRef(false);

  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: APARECER, useNativeDriver: true }).start();
    const t = setTimeout(() => setTiempoCumplido(true), DURACION_MINIMA);
    return () => clearTimeout(t);
  }, [entrada]);

  const cerrar = () => {
    if (cerrando.current || !listo) return;
    cerrando.current = true;
    Animated.timing(opacidad, { toValue: 0, duration: DESVANECER, useNativeDriver: true }).start(() => onFin());
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (tiempoCumplido && listo) cerrar(); }, [tiempoCumplido, listo]);

  // La franja blanca ocupa al menos el 30 % de la pantalla, como en el diseño.
  const altoBlanco = Math.max(204 * s, height * 0.3);
  const diametroNube = 264 * s;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad }]}>
      <Pressable style={e.fondo} onPress={cerrar} accessibilityLabel="Bienvenido a SIGECI. Toca para continuar.">
        <Animated.View style={[e.zonaLogo, { bottom: altoBlanco + 10 * s, opacity: entrada }]}>
          <Image source={require('../../assets/logo-drfc-blanco.png')} style={{ width: 221 * s, height: 221 * s * (389 / 852) }} resizeMode="contain" accessibilityLabel="DRFC Ingeniería S.A. de C.V." />
        </Animated.View>

        <View style={[e.blanco, { height: altoBlanco, borderTopRightRadius: 40 * s }]}>
          {/* Bulto redondo de la "nube" a la izquierda. */}
          <View style={[e.nube, { width: diametroNube, height: diametroNube, borderRadius: diametroNube / 2, left: -14 * s, top: -62 * s }]} />
          <Animated.View style={[e.contenido, { paddingLeft: 40 * s, paddingRight: 42 * s, paddingTop: 39 * s, opacity: entrada }]}>
            <Text style={[e.texto, { fontSize: 26 * s, lineHeight: 36 * s }]}>{'Bienvenido!\na SIGECI'}</Text>
            <Image source={require('../../assets/emblema-drfc.png')} style={{ width: 100 * s, height: 100 * s }} resizeMode="contain" />
          </Animated.View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: AZUL_FONDO },
  zonaLogo: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  blanco: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff' },
  nube: { position: 'absolute', backgroundColor: '#fff' },
  contenido: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  texto: { color: AZUL_TEXTO, fontWeight: '600' },
});
