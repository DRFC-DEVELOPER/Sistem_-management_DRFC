import { useEffect, useRef, useState } from 'react';
import { Animated, Image, LayoutChangeEvent, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Proporciones medidas del diseño (pantalla de 185 × 335). Los tamaños van en fracciones de una medida
// base (el ancho, sin pasar del 56 % del alto para que en tablets o pantallas bajas no se agranden de más);
// la altura de la franja blanca y la posición del logo, en fracciones del alto.
const AZUL_FONDO = '#003e58';
const AZUL_TEXTO = '#2d719d';
// En total dura 5 s: aparece, se queda y se desvanece.
const APARECER = 800;
const DESVANECER = 900;
const DURACION_MINIMA = 5000 - DESVANECER;

/**
 * Contorno de la parte blanca como una sola figura: borde izquierdo, arco del bulto, franja recta,
 * esquina superior derecha redondeada y cierre por abajo. Al ser un solo vector se desvanece parejo
 * (dos figuras encimadas dejaban ver el círculo durante la transparencia).
 */
function contornoNube(w: number, h: number, top: number, base: number) {
  const r = base * 0.323;
  const cx = base * 0.28;
  const cy = top - base * 0.162 + r;
  const rEsquina = base * 0.085;
  // Donde el círculo del bulto corta la línea recta de la franja.
  const dx = Math.sqrt(r * r - (cy - top) ** 2);
  const xDer = cx + dx;
  let inicio: string;
  if (cx - dx <= 0) {
    // El bulto sale por el borde izquierdo: el trazo sube por el borde hasta tocar el círculo.
    const yIzq = cy - Math.sqrt(r * r - cx * cx);
    inicio = `M0 ${h} L0 ${yIzq}`;
  } else {
    inicio = `M0 ${h} L0 ${top} L${cx - dx} ${top}`;
  }
  return [
    inicio,
    `A${r} ${r} 0 0 1 ${xDer} ${top}`,
    `L${w - rEsquina} ${top}`,
    `A${rEsquina} ${rEsquina} 0 0 1 ${w} ${top + rEsquina}`,
    `L${w} ${h}`,
    'Z',
  ].join(' ');
}

/**
 * Presentación al abrir la app. Se queda al menos `DURACION_MINIMA` y hasta que la sesión termina de cargar;
 * tocarla la cierra antes. Usa el mismo azul que la pantalla de arranque nativa para que no haya salto.
 */
export function Bienvenida({ listo, onFin }: { listo: boolean; onFin: () => void }) {
  // Se mide el espacio real ocupado: en Android de borde a borde la "ventana" puede no incluir
  // la barra de navegación, y la parte blanca debe llegar hasta el borde inferior.
  const ventana = useWindowDimensions();
  const [medida, setMedida] = useState<{ w: number; h: number } | null>(null);
  const w = medida?.w ?? ventana.width;
  const h = medida?.h ?? ventana.height;
  const base = Math.min(w, h * 0.56);
  const alMedir = (ev: LayoutChangeEvent) => {
    const { width, height } = ev.nativeEvent.layout;
    if (width !== medida?.w || height !== medida?.h) setMedida({ w: width, h: height });
  };
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

  // La franja blanca ocupa el 29 % inferior; el logo queda centrado al 37 % de la altura.
  const inicioBlanco = h - Math.max(h * 0.293, base * 0.53);
  const centroLogo = h * 0.367;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacidad }]} onLayout={alMedir}>
      <Pressable style={e.fondo} onPress={cerrar} accessibilityLabel="Bienvenido a SIGECI. Toca para continuar.">
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path d={contornoNube(w, h, inicioBlanco, base)} fill="#fff" />
        </Svg>

        <Animated.View style={[e.zonaLogo, { height: centroLogo * 2, opacity: entrada }]}>
          <Image source={require('../../assets/logo-drfc-blanco.png')} style={{ width: base * 0.55, height: base * 0.55 * (389 / 852) }} resizeMode="contain" accessibilityLabel="DRFC Ingeniería S.A. de C.V." />
        </Animated.View>

        <Animated.View style={[e.contenido, { top: inicioBlanco, paddingHorizontal: base * 0.097, opacity: entrada }]}>
          <Text style={[e.texto, { fontSize: base * 0.079, lineHeight: base * 0.1, marginTop: base * 0.1 }]}>{'Bienvenido!\na SIGECI'}</Text>
          <Image source={require('../../assets/emblema-drfc.png')} style={{ width: base * 0.245, height: base * 0.245, marginTop: base * 0.094 }} resizeMode="contain" />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: AZUL_FONDO },
  zonaLogo: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  contenido: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  texto: { color: AZUL_TEXTO, fontWeight: '600' },
});

