import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLOR, Estatus, ESTATUS } from '@/lib/tipos';

/** Contenedor de cada pantalla, con scroll y "jalar para actualizar" opcional. */
export function Pantalla({ children, recargar, cargando, sinScroll }: { children: ReactNode; recargar?: () => void; cargando?: boolean; sinScroll?: boolean }) {
  if (sinScroll) return <SafeAreaView style={e.pantalla} edges={['bottom', 'left', 'right']}>{children}</SafeAreaView>;
  return (
    <SafeAreaView style={e.pantalla} edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={e.contenido}
        keyboardShouldPersistTaps="handled"
        refreshControl={recargar ? <RefreshControl refreshing={!!cargando} onRefresh={recargar} colors={[COLOR.acento]} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const Tarjeta = ({ children, estilo }: { children: ReactNode; estilo?: ViewStyle }) => <View style={[e.tarjeta, estilo]}>{children}</View>;
export const Titulo = ({ children }: { children: ReactNode }) => <Text style={e.titulo}>{children}</Text>;
export const Sub = ({ children }: { children: ReactNode }) => <Text style={e.sub}>{children}</Text>;

/** Par etiqueta / valor; los vacíos se muestran con un guion, como en la web. */
export function Dato({ etiqueta, valor, mono }: { etiqueta: string; valor?: string | null; mono?: boolean }) {
  return (
    <View style={e.dato}>
      <Text style={e.datoEtiqueta}>{etiqueta}</Text>
      <Text style={[e.datoValor, mono && e.mono, !valor && { color: COLOR.tenue }]}>{valor || '—'}</Text>
    </View>
  );
}

export function Etiqueta({ texto, color }: { texto: string; color: string }) {
  return <Text style={[e.etiqueta, { color, borderColor: color }]}>{texto}</Text>;
}
export const EtiquetaEstatus = ({ estatus }: { estatus: Estatus }) => <Etiqueta texto={ESTATUS[estatus].nombre} color={ESTATUS[estatus].color} />;

export function Boton({ texto, onPress, variante = 'principal', deshabilitado, ocupado }: {
  texto: string; onPress: () => void; variante?: 'principal' | 'secundario' | 'peligro'; deshabilitado?: boolean; ocupado?: boolean;
}) {
  const principal = variante === 'principal';
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado || ocupado}
      accessibilityRole="button"
      style={({ pressed }) => [e.boton, principal ? e.botonPrincipal : e.botonSecundario, (deshabilitado || ocupado) && { opacity: 0.55 }, pressed && { opacity: 0.8 }]}
    >
      {ocupado
        ? <ActivityIndicator color={principal ? '#fff' : COLOR.acento} />
        : <Text style={[e.botonTexto, { color: principal ? '#fff' : variante === 'peligro' ? COLOR.mal : COLOR.acento }]}>{texto}</Text>}
    </Pressable>
  );
}

export function Campo({ etiqueta, ...props }: { etiqueta: string } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={e.campoEtiqueta}>{etiqueta}</Text>
      <TextInput placeholderTextColor={COLOR.tenue} {...props} style={[e.campo, props.multiline && { minHeight: 110, textAlignVertical: 'top' }, props.style]} />
    </View>
  );
}

export function Aviso({ children, tipo = 'info' }: { children: ReactNode; tipo?: 'info' | 'error' | 'ok' }) {
  const color = tipo === 'error' ? COLOR.mal : tipo === 'ok' ? COLOR.ok : COLOR.acento;
  return <View style={[e.aviso, { borderLeftColor: color }]}><Text style={e.avisoTexto}>{children}</Text></View>;
}

export const Cargando = () => <View style={{ padding: 32 }}><ActivityIndicator size="large" color={COLOR.acento} /></View>;

export function ErrorCarga({ mensaje, reintentar }: { mensaje: string; reintentar?: () => void }) {
  return (
    <View style={{ gap: 12 }}>
      <Aviso tipo="error">{mensaje}</Aviso>
      {reintentar && <Boton texto="Reintentar" variante="secundario" onPress={reintentar} />}
    </View>
  );
}

export const estilos = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});

const e = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: COLOR.fondo },
  contenido: { padding: 16, gap: 14, paddingBottom: 40 },
  tarjeta: { backgroundColor: COLOR.superficie, borderRadius: 12, padding: 16, gap: 10 },
  titulo: { fontSize: 17, fontWeight: '700', color: COLOR.tinta },
  sub: { fontSize: 14, color: COLOR.tenue },
  dato: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLOR.linea },
  datoEtiqueta: { fontSize: 14, color: COLOR.tenue, flexShrink: 0 },
  datoValor: { fontSize: 14, color: COLOR.texto, flexShrink: 1, textAlign: 'right' },
  mono: { fontFamily: 'monospace' },
  etiqueta: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, overflow: 'hidden' },
  boton: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  botonPrincipal: { backgroundColor: COLOR.acento },
  botonSecundario: { backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.linea },
  botonTexto: { fontSize: 16, fontWeight: '600' },
  campoEtiqueta: { fontSize: 14, fontWeight: '600', color: COLOR.tinta },
  campo: { minHeight: 48, borderWidth: 1, borderColor: COLOR.linea, borderRadius: 10, backgroundColor: COLOR.superficie, paddingHorizontal: 12, fontSize: 16, color: COLOR.texto },
  aviso: { backgroundColor: COLOR.superficie, borderLeftWidth: 4, borderRadius: 8, padding: 12 },
  avisoTexto: { fontSize: 14, color: COLOR.texto, lineHeight: 20 },
});
