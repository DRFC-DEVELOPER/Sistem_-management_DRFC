import { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Aviso, Boton, Campo, Cargando, ErrorCarga, Etiqueta, estilos, Pantalla, Sub, Tarjeta, Titulo } from '@/componentes/ui';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { COLOR, EstadoReporte, ESTADOS_REPORTE, ESTATUS, fecha, fechaHora, nombreEquipo, ReporteFalla } from '@/lib/tipos';
import { avisarCambioSoporte, useCarga } from '@/lib/usar';

type Filtro = 'ABIERTOS' | EstadoReporte | 'TODOS';
const FILTROS: [Filtro, string][] = [['ABIERTOS', 'Sin cerrar'], ['PENDIENTE', 'Pendientes'], ['EN_ATENCION', 'En atención'], ['CERRADO', 'Cerrados'], ['TODOS', 'Todos']];
type Accion = { tipo: 'atender' | 'reparacion' | 'cerrar'; reporte: ReporteFalla };

/** Bandeja de las fallas que reportan los empleados; la misma que "Soporte" en la web. */
export default function Solicitudes() {
  const { usuario } = useSesion();
  const puedeEditar = usuario?.rol === 'ADMIN' || usuario?.rol === 'TECNICO';
  const [filtro, setFiltro] = useState<Filtro>('ABIERTOS');
  const [accion, setAccion] = useState<Accion | null>(null);
  const [hecho, setHecho] = useState('');
  const estado = filtro === 'ABIERTOS' || filtro === 'TODOS' ? undefined : filtro;
  const { datos: cargados, error, cargando, recargar } = useCarga(
    () => api<ReporteFalla[]>(`/reportes-falla${estado ? `?estado=${estado}` : ''}`), [estado],
  );
  const datos = filtro === 'ABIERTOS' ? cargados?.filter((r) => r.estado !== 'CERRADO') : cargados;

  // Al volver a la pestaña se actualiza (la primera vez ya cargó useCarga).
  const primera = useRef(true);
  useFocusEffect(useCallback(() => {
    if (primera.current) primera.current = false;
    else recargar();
  }, [recargar]));

  const listo = (mensaje: string) => {
    setAccion(null);
    setHecho(mensaje);
    recargar();
    avisarCambioSoporte();
  };

  return (
    <Pantalla recargar={recargar} cargando={cargando && !!cargados}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTROS.map(([k, n]) => {
          const activo = filtro === k;
          return (
            <Pressable key={k} onPress={() => { setFiltro(k); setHecho(''); }} role="button" accessibilityState={{ selected: activo }} style={[e.chip, activo && e.chipActivo]}>
              <Text style={[e.chipTexto, activo && { color: '#fff' }]}>{n}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {hecho ? <Aviso tipo="ok">{hecho}</Aviso> : null}

      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : datos.length ? (
        datos.map((r) => <TarjetaReporte key={r.id} r={r} puedeEditar={puedeEditar} onAccion={(tipo) => { setHecho(''); setAccion({ tipo, reporte: r }); }} />)
      ) : (
        <Tarjeta>
          <Titulo>{filtro === 'ABIERTOS' ? 'No hay solicitudes pendientes' : 'Sin solicitudes'}</Titulo>
          <Sub>Cuando un empleado reporte una falla desde la app, aparecerá aquí.</Sub>
        </Tarjeta>
      )}

      {accion && <FormularioAccion accion={accion} onCerrar={() => setAccion(null)} onListo={listo} />}
    </Pantalla>
  );
}

function TarjetaReporte({ r, puedeEditar, onAccion }: { r: ReporteFalla; puedeEditar: boolean; onAccion: (tipo: Accion['tipo']) => void }) {
  const estado = ESTADOS_REPORTE[r.estado];
  return (
    <Tarjeta>
      <View style={[estilos.fila, { alignItems: 'flex-start' }]}>
        <Pressable
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/soporte/equipo/[id]', params: { id: String(r.equipoId) } })}
          role="link"
          accessibilityHint="Abre la ficha del equipo"
        >
          <Text style={e.equipo}>{r.equipo ? nombreEquipo(r.equipo) : 'Equipo'}</Text>
          <Sub>
            {[r.equipo?.codigoBarras, r.equipo && `Equipo ${ESTATUS[r.equipo.estatus].nombre.toLowerCase()}`].filter(Boolean).join(' | ')}
          </Sub>
        </Pressable>
        <Etiqueta texto={estado.nombre} color={estado.color} />
      </View>

      <Text style={e.falla}>“{r.descripcion}”</Text>
      <Sub>
        Reportó {r.empleado ? r.empleado.nombre : 'un empleado'}{r.empleado?.departamento ? ` (${r.empleado.departamento.nombre})` : ''} el {fechaHora(r.creadoEn)}
      </Sub>
      {r.respuesta && <Sub><Text style={{ fontWeight: '700' }}>Respuesta{r.atendidoPor ? ` de ${r.atendidoPor.nombre}` : ''}:</Text> {r.respuesta}</Sub>}
      {r.reparacion && (
        <Sub>
          Enviado a reparación el {fecha(r.reparacion.fechaEnvio)}{r.reparacion.proveedor ? ` con ${r.reparacion.proveedor}` : ''}
          {r.reparacion.fechaRecepcion ? `; regresó el ${fecha(r.reparacion.fechaRecepcion)}.` : '; aún no regresa.'}
        </Sub>
      )}
      {r.cerradoEn && <Sub>Cerrado el {fechaHora(r.cerradoEn)}.</Sub>}

      {puedeEditar && r.estado !== 'CERRADO' && (
        <View style={e.acciones}>
          {r.estado === 'PENDIENTE' && <View style={{ flex: 1 }}><Boton texto="Atender" variante="secundario" onPress={() => onAccion('atender')} /></View>}
          {!r.reparacionId && r.equipo?.estatus !== 'EN_REPARACION' && (
            <View style={{ flex: 1 }}><Boton texto="A reparación" variante="secundario" onPress={() => onAccion('reparacion')} /></View>
          )}
          <View style={{ flex: 1 }}><Boton texto="Cerrar" onPress={() => onAccion('cerrar')} /></View>
        </View>
      )}
    </Tarjeta>
  );
}

const TITULOS: Record<Accion['tipo'], { titulo: string; boton: string; hecho: string }> = {
  atender: { titulo: 'Atender solicitud', boton: 'Marcar en atención', hecho: 'Solicitud en atención.' },
  reparacion: { titulo: 'Mandar a reparación', boton: 'Mandar a reparación', hecho: 'Equipo enviado a reparación.' },
  cerrar: { titulo: 'Cerrar solicitud', boton: 'Cerrar solicitud', hecho: 'Solicitud cerrada.' },
};

/** Hoja que sube desde abajo con los campos de cada acción. */
function FormularioAccion({ accion: { tipo, reporte }, onCerrar, onListo }: { accion: Accion; onCerrar: () => void; onListo: (mensaje: string) => void }) {
  const [texto, setTexto] = useState(tipo === 'reparacion' ? reporte.descripcion : '');
  const [proveedor, setProveedor] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const t = TITULOS[tipo];

  const enviar = async () => {
    setError('');
    setOcupado(true);
    try {
      const cuerpo = tipo === 'atender' ? { respuesta: texto.trim() || undefined }
        : tipo === 'reparacion' ? { motivo: texto.trim() || undefined, proveedor: proveedor.trim() || undefined }
        : { respuesta: texto.trim() };
      await api(`/reportes-falla/${reporte.id}/${tipo === 'atender' ? 'atender' : tipo === 'reparacion' ? 'reparacion' : 'cerrar'}`, { cuerpo });
      onListo(t.hecho);
    } catch (err) {
      setError((err as Error).message);
      setOcupado(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onCerrar} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView style={e.fondoModal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCerrar} accessibilityLabel="Cancelar" />
        <View style={e.hoja}>
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled">
            <Titulo>{t.titulo}</Titulo>
            <Sub>{reporte.equipo ? nombreEquipo(reporte.equipo) : 'Equipo'} | {reporte.empleado?.nombre ?? ''}</Sub>

            {tipo === 'atender' && <>
              <Sub>El empleado verá en la app que su solicitud ya se está atendiendo.</Sub>
              <Campo etiqueta="Mensaje para el empleado (opcional)" value={texto} onChangeText={setTexto} multiline placeholder="Por ejemplo: pasa a soporte hoy a las 4" />
            </>}
            {tipo === 'reparacion' && <>
              {reporte.equipo?.estatus === 'ASIGNADO' && (
                <Aviso>Se registrará la devolución del equipo; seguirá ligado a {reporte.empleado?.nombre ?? 'el empleado'} mientras está en reparación.</Aviso>
              )}
              <Campo etiqueta="Falla" value={texto} onChangeText={setTexto} multiline />
              <Campo etiqueta="Proveedor (opcional)" value={proveedor} onChangeText={setProveedor} />
            </>}
            {tipo === 'cerrar' && <>
              {reporte.reparacion && !reporte.reparacion.fechaRecepcion && (
                <Aviso>El equipo sigue en reparación. Cerrar la solicitud no registra su regreso; hazlo desde la web.</Aviso>
              )}
              <Campo etiqueta="¿Cómo se resolvió?" value={texto} onChangeText={setTexto} multiline placeholder="El empleado verá esta respuesta en la app" />
            </>}

            {error ? <Aviso tipo="error">{error}</Aviso> : null}
            <Boton texto={t.boton} onPress={enviar} ocupado={ocupado} />
            <Boton texto="Cancelar" variante="secundario" onPress={onCerrar} deshabilitado={ocupado} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const e = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLOR.superficie, borderWidth: 1, borderColor: COLOR.linea },
  chipActivo: { backgroundColor: COLOR.tinta, borderColor: COLOR.tinta },
  chipTexto: { fontSize: 14, fontWeight: '600', color: COLOR.tinta },
  equipo: { fontSize: 16, fontWeight: '700', color: COLOR.acento },
  falla: { fontSize: 15, color: COLOR.texto, fontStyle: 'italic' },
  acciones: { flexDirection: 'row', gap: 8, marginTop: 4 },
  fondoModal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.45)' },
  hoja: { backgroundColor: COLOR.fondo, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32, maxHeight: '85%' },
});
