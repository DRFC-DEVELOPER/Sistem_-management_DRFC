import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { COLOR } from '@/lib/tipos';

// La pestaña activa sube en un círculo con borde blanco que se desliza a su lugar, como en el diseño.
const ALTO = 64;
const DIAMETRO = 64;
const BORDE = 4;
const AZUL = '#0b3a52';
const TAM_ICONO = 32;

export function BarraPestanas({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const [ancho, setAncho] = useState(0);
  const n = state.routes.length;
  const anchoPestana = ancho / n;
  const posicion = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(posicion, { toValue: state.index, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
  }, [state.index, posicion]);

  const alMedir = (ev: LayoutChangeEvent) => setAncho(ev.nativeEvent.layout.width);
  const icono = (i: number): ReactNode => descriptors[state.routes[i].key].options.tabBarIcon?.({ focused: i === state.index, color: '#fff', size: TAM_ICONO });
  const insignia = (i: number) => descriptors[state.routes[i].key].options.tabBarBadge;
  const x = Animated.add(Animated.multiply(posicion, anchoPestana), anchoPestana / 2 - DIAMETRO / 2);

  return (
    <View style={[e.barra, { paddingBottom: insets.bottom }]} onLayout={alMedir} role="tablist">
      {ancho > 0 && (
        <Animated.View style={[e.burbuja, { transform: [{ translateX: x }] }]} pointerEvents="none">
          {icono(state.index)}
          <Insignia valor={insignia(state.index)} />
        </Animated.View>
      )}
      {state.routes.map((ruta, i) => {
        const { options } = descriptors[ruta.key];
        const activa = i === state.index;
        const tocar = () => {
          const evento = emitter.emit({ type: 'tabPress', target: ruta.key, canPreventDefault: true });
          if (!activa && !evento.defaultPrevented) navigateToTab(ruta.key);
        };
        return (
          <Pressable
            key={ruta.key}
            onPress={tocar}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: ruta.key })}
            role="tab"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
            style={e.pestana}
          >
            {/* El ícono de la pestaña activa lo muestra la burbuja. */}
            <View style={{ opacity: activa ? 0 : 0.9 }}>
              {icono(i)}
              <Insignia valor={insignia(i)} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Insignia({ valor }: { valor?: string | number }) {
  if (valor === undefined || valor === '' || valor === 0) return null;
  return <Text style={e.insignia}>{typeof valor === 'number' && valor > 99 ? '99+' : valor}</Text>;
}

const e = StyleSheet.create({
  barra: { flexDirection: 'row', backgroundColor: AZUL },
  pestana: { flex: 1, height: ALTO, alignItems: 'center', justifyContent: 'center' },
  burbuja: {
    position: 'absolute', left: 0, top: -DIAMETRO / 2 + 4, width: DIAMETRO, height: DIAMETRO, borderRadius: DIAMETRO / 2,
    backgroundColor: AZUL, borderWidth: BORDE, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 1,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  insignia: {
    position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, overflow: 'hidden',
    backgroundColor: COLOR.mal, color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 18,
  },
});
