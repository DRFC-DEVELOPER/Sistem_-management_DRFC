import { ReactNode, Ref, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputInstance, TextInputProps, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Aviso } from '@/componentes/ui';
import { useSesion } from '@/lib/sesion';

// Medidas del diseño (326 × 567); se escalan al ancho, con tope para tablets.
const ANCHO_DISENO = 326;
const AZUL = '#003e58';
const GRIS_TEXTO = '#b2b2b2';
const GRIS_ICONO = '#8a8a8a';

export default function Entrar() {
  const { entrar } = useSesion();
  const { width, height } = useWindowDimensions();
  const s = Math.min(width, 480) / ANCHO_DISENO;
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const campoClave = useRef<TextInputInstance>(null);

  const enviar = async () => {
    if (!usuario.trim() || !password) return setError('Escribe tu usuario y tu contraseña.');
    setError('');
    setOcupado(true);
    try {
      await entrar(usuario.trim(), password);
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  // La tarjeta blanca empieza al 38 % de la pantalla y llega hasta abajo.
  const inicioTarjeta = Math.max(height * 0.38, 190);
  const radio = 36 * s;
  const anchoCampo = 234 * s;

  return (
    <KeyboardAvoidingView style={e.raiz} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[e.encabezado, { height: inicioTarjeta + radio }]}>
          <View style={{ height: inicioTarjeta, justifyContent: 'center', alignItems: 'center', paddingTop: 24 }}>
            <Image
              source={require('../../assets/logo-drfc-blanco.png')}
              style={{ width: 157 * s, height: 157 * s * (389 / 852) }}
              resizeMode="contain"
              accessibilityLabel="DRFC Ingeniería S.A. de C.V."
            />
          </View>
        </View>

        <View style={[e.tarjeta, { marginTop: inicioTarjeta, borderTopLeftRadius: radio, borderTopRightRadius: radio, minHeight: height - inicioTarjeta }]}>
          <Text style={[e.titulo, { fontSize: 26 * s, marginTop: 38 * s, marginBottom: 27 * s }]}>Bienvenido!</Text>

          <Entrada
            ancho={anchoCampo} s={s}
            icono={<Ionicons name="person-outline" size={22 * s} color={GRIS_ICONO} />}
            placeholder="Usuario" value={usuario} onChangeText={setUsuario}
            autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username"
            returnKeyType="next" onSubmitEditing={() => campoClave.current?.focus()} submitBehavior="submit"
          />
          <View style={{ height: 32 * s }} />
          <Entrada
            ref={campoClave}
            ancho={anchoCampo} s={s}
            icono={
              <Pressable onPress={() => setVerClave((v) => !v)} hitSlop={10} accessibilityRole="button" accessibilityLabel={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                <Ionicons name={verClave ? 'eye-outline' : 'eye-off'} size={22 * s} color={GRIS_ICONO} />
              </Pressable>
            }
            placeholder="Contraseña" value={password} onChangeText={setPassword}
            secureTextEntry={!verClave} autoCapitalize="none" autoCorrect={false} autoComplete="password" textContentType="password"
            returnKeyType="go" onSubmitEditing={enviar}
          />

          <Pressable
            onPress={enviar}
            disabled={ocupado}
            accessibilityRole="button"
            style={({ pressed }) => [e.boton, { width: 186 * s, minHeight: Math.max(44, 30 * s), borderRadius: 10 * s, marginTop: 51 * s }, (pressed || ocupado) && { opacity: 0.85 }]}
          >
            {ocupado ? <ActivityIndicator color="#fff" /> : <Text style={[e.botonTexto, { fontSize: 17 * s }]}>Iniciar</Text>}
          </Pressable>

          {error ? <View style={{ width: anchoCampo, marginTop: 20 }}><Aviso tipo="error">{error}</Aviso></View> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Campo con sombra e ícono a la derecha, como en el diseño. */
function Entrada({ ancho, s, icono, ref, ...props }: { ancho: number; s: number; icono: ReactNode; ref?: Ref<TextInputInstance> } & TextInputProps) {
  return (
    <View style={[e.campo, { width: ancho, minHeight: Math.max(46, 43 * s), borderRadius: 12 * s }]}>
      <TextInput ref={ref} placeholderTextColor={GRIS_TEXTO} style={[e.campoTexto, { fontSize: 16 * s }]} {...props} />
      {icono}
    </View>
  );
}

const e = StyleSheet.create({
  // Blanco detrás, para que al deslizar o con el teclado abierto no asome otro color abajo.
  raiz: { flex: 1, backgroundColor: '#fff' },
  encabezado: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: AZUL },
  tarjeta: { flexGrow: 1, backgroundColor: '#fff', alignItems: 'center', paddingBottom: 32 },
  titulo: { color: AZUL, fontWeight: '700' },
  campo: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#dcdcdc', paddingHorizontal: 14, gap: 8,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  campoTexto: { flex: 1, color: '#333', paddingVertical: 10 },
  boton: {
    backgroundColor: AZUL, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  botonTexto: { color: '#fff', fontWeight: '700' },
});
