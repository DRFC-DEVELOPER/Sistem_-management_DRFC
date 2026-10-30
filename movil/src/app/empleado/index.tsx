import { useCallback, useRef } from 'react';
import { Text, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { BotonSalir } from '@/componentes/BotonSalir';
import { Aviso, Boton, Cargando, Dato, ErrorCarga, Etiqueta, EtiquetaEstatus, estilos, Pantalla, Sub, Tarjeta, Titulo } from '@/componentes/ui';
import { api } from '@/lib/api';
import { CARACTERISTICAS, COLOR, ESTADOS_REPORTE, fecha, MiEquipo, MiPerfil, MiReporte, nombreEquipo } from '@/lib/tipos';
import { useCarga } from '@/lib/usar';

/** Inicio del empleado: sus datos, sus equipos y sus reportes. Todo es de solo lectura. */
export default function MisEquipos() {
  const { datos, error, cargando, recargar } = useCarga(
    () => Promise.all([api<MiPerfil>('/mi/perfil'), api<MiEquipo[]>('/mi/equipos'), api<MiReporte[]>('/mi/reportes')]),
    [],
  );
  // Al volver de reportar una falla se actualiza la lista (la primera vez ya cargó useCarga).
  const primera = useRef(true);
  useFocusEffect(useCallback(() => {
    if (primera.current) primera.current = false;
    else recargar();
  }, [recargar]));

  const [perfil, equipos, reportes] = datos ?? [];
  const propios = equipos?.filter((x) => !x.paraPuesto) ?? [];
  const paraOtros = equipos?.filter((x) => x.paraPuesto) ?? [];

  return (
    <Pantalla recargar={recargar} cargando={cargando && !!datos}>
      <Stack.Screen options={{ headerRight: () => <BotonSalir /> }} />
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !perfil ? <Cargando /> : (
        <>
          <Tarjeta>
            <Titulo>{perfil.nombre}</Titulo>
            <Dato etiqueta="Número de empleado" valor={perfil.numero} mono />
            <Dato etiqueta="Departamento" valor={perfil.departamento?.nombre} />
            <Dato etiqueta="Puesto" valor={perfil.puesto?.nombre} />
            <Dato etiqueta="Correo" valor={perfil.correo} />
          </Tarjeta>

          <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.tinta }}>Mis equipos ({propios.length})</Text>
          {propios.length ? propios.map((x) => <TarjetaEquipo key={x.id} e={x} />) : <Aviso>No tienes equipos asignados.</Aviso>}

          {paraOtros.length > 0 && (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.tinta }}>A mi cargo para mi departamento ({paraOtros.length})</Text>
              {paraOtros.map((x) => <TarjetaEquipo key={x.id} e={x} />)}
            </>
          )}

          {!!reportes?.length && (
            <>
              <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.tinta }}>Mis reportes</Text>
              {reportes.map((r) => (
                <Tarjeta key={r.id}>
                  <View style={estilos.fila}>
                    <Text style={{ flex: 1, fontWeight: '600', color: COLOR.texto }}>{r.equipo ? nombreEquipo(r.equipo) : 'Equipo'}</Text>
                    <Etiqueta texto={ESTADOS_REPORTE[r.estado].nombre} color={ESTADOS_REPORTE[r.estado].color} />
                  </View>
                  <Sub>“{r.descripcion}” · {fecha(r.creadoEn)}</Sub>
                  {r.respuesta && <Aviso tipo={r.estado === 'CERRADO' ? 'ok' : 'info'}>Soporte: {r.respuesta}</Aviso>}
                </Tarjeta>
              ))}
            </>
          )}
        </>
      )}
    </Pantalla>
  );
}

function TarjetaEquipo({ e }: { e: MiEquipo }) {
  const reporte = e.reporteAbierto;
  return (
    <Tarjeta>
      <View style={estilos.fila}>
        <Titulo>{nombreEquipo(e)}</Titulo>
        <EtiquetaEstatus estatus={e.estatus} />
      </View>
      {e.paraPuesto && <Sub>Lo usa: {e.paraPersona ? `${e.paraPersona} (${e.paraPuesto.nombre})` : e.paraPuesto.nombre}. Tú eres responsable.</Sub>}
      {e.temporal && <Aviso>Equipo temporal mientras se resuelve tu equipo anterior.</Aviso>}
      {CARACTERISTICAS.filter(([k]) => e[k]).map(([k, etiqueta]) => (
        <Dato key={k} etiqueta={etiqueta} valor={String(e[k])} mono={k === 'serie' || k === 'codigoBarras'} />
      ))}
      {e.fechaEntrega && <Dato etiqueta="Entregado" valor={fecha(e.fechaEntrega)} />}
      {reporte ? (
        <Aviso tipo="error">
          Falla reportada ({ESTADOS_REPORTE[reporte.estado].nombre.toLowerCase()}): “{reporte.descripcion}”
          {reporte.respuesta ? `\nSoporte: ${reporte.respuesta}` : ''}
        </Aviso>
      ) : e.estatus !== 'BAJA' && (
        <Boton texto="Reportar una falla" variante="secundario" onPress={() => router.push({ pathname: '/empleado/reportar', params: { id: String(e.id), nombre: nombreEquipo(e) } })} />
      )}
    </Tarjeta>
  );
}
