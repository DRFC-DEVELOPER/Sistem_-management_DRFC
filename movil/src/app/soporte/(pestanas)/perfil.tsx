import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FotoPerfil } from '@/componentes/FotoPerfil';
import { Aviso, Boton, Campo, Dato, Pantalla, Sub, Tarjeta, Titulo } from '@/componentes/ui';
import { useSesion } from '@/lib/sesion';
import { COLOR, Rol } from '@/lib/tipos';

const ROLES: Record<Rol, string> = { ADMIN: 'Administrador', TECNICO: 'Técnico', CONSULTA: 'Consulta', EMPLEADO: 'Empleado' };

/** Datos de la cuenta del personal, cambio de contraseña y cierre de sesión. */
export default function Perfil() {
  const { usuario, salir } = useSesion();
  const [cambiando, setCambiando] = useState(false);
  const [hecho, setHecho] = useState(false);
  if (!usuario) return null;

  const preguntarSalir = () => Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Salir', style: 'destructive', onPress: salir },
  ]);

  return (
    <Pantalla>
      <Tarjeta estilo={{ alignItems: 'center' }}>
        <FotoPerfil nombre={usuario.nombre} ancho={170} />
        <Titulo>{usuario.nombre}</Titulo>
        <View style={e.rol}>
          <Ionicons name="shield-checkmark-outline" size={14} color={COLOR.acento} />
          <Text style={e.rolTexto}>{ROLES[usuario.rol]}</Text>
        </View>
      </Tarjeta>

      <Tarjeta>
        <Text style={e.seccion}>Datos de la cuenta</Text>
        <Dato etiqueta="Usuario" valor={usuario.usuario} mono />
        <Dato etiqueta="Correo" valor={usuario.correo} />
        <Dato etiqueta="Rol" valor={ROLES[usuario.rol]} />
      </Tarjeta>

      {hecho && <Aviso tipo="ok">Tu contraseña se cambió.</Aviso>}
      {cambiando
        ? <CambiarClave onListo={() => { setCambiando(false); setHecho(true); }} onCancelar={() => setCambiando(false)} />
        : <Boton texto="Cambiar contraseña" variante="secundario" onPress={() => { setHecho(false); setCambiando(true); }} />}
      <Boton texto="Cerrar sesión" variante="peligro" onPress={preguntarSalir} />
      <Sub>Para cambiar tu nombre, correo o rol, pídelo a un administrador desde la web.</Sub>
    </Pantalla>
  );
}

function CambiarClave({ onListo, onCancelar }: { onListo: () => void; onCancelar: () => void }) {
  const { cambiarPassword } = useSesion();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    if (!actual) return setError('Escribe tu contraseña actual.');
    if (nueva.length < 10) return setError('La contraseña nueva debe tener al menos 10 caracteres.');
    if (nueva !== confirmar) return setError('Las contraseñas nuevas no coinciden.');
    setError('');
    setOcupado(true);
    try {
      await cambiarPassword(actual, nueva);
      onListo();
    } catch (err) {
      setError((err as Error).message);
      setOcupado(false);
    }
  };

  return (
    <Tarjeta>
      <Text style={e.seccion}>Cambiar contraseña</Text>
      <Campo etiqueta="Contraseña actual" value={actual} onChangeText={setActual} secureTextEntry autoComplete="current-password" />
      <Campo etiqueta="Contraseña nueva (mínimo 10 caracteres)" value={nueva} onChangeText={setNueva} secureTextEntry autoComplete="new-password" />
      <Campo etiqueta="Repite la contraseña nueva" value={confirmar} onChangeText={setConfirmar} secureTextEntry autoComplete="new-password" onSubmitEditing={enviar} />
      {error ? <Aviso tipo="error">{error}</Aviso> : null}
      <Boton texto="Guardar contraseña" onPress={enviar} ocupado={ocupado} />
      <Boton texto="Cancelar" variante="secundario" onPress={onCancelar} deshabilitado={ocupado} />
    </Tarjeta>
  );
}

const e = StyleSheet.create({
  rol: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLOR.acentoSuave, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  rolTexto: { color: COLOR.acento, fontWeight: '700', fontSize: 13 },
  seccion: { fontWeight: '700', color: COLOR.tinta },
});
