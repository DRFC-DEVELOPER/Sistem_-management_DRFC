import { Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Aviso, Boton, Cargando, Dato, ErrorCarga, EtiquetaEstatus, estilos, Pantalla, Sub, Tarjeta, Titulo } from '@/componentes/ui';
import { api } from '@/lib/api';
import { CARACTERISTICAS, COLOR, ESTADOS_REPORTE, etiquetaTipo, EquipoDetalle, fecha, nombreEquipo } from '@/lib/tipos';
import { useCarga } from '@/lib/usar';

/** Ficha del equipo escaneado: datos, quién lo tiene y si hay una solicitud de soporte abierta. */
export default function FichaEquipo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { datos: e, error, cargando, recargar } = useCarga(() => api<EquipoDetalle>(`/equipos/${id}`), [id]);
  const vigente = e?.asignaciones.find((a) => !a.fechaDevolucion);
  const reparacion = e?.reparaciones.find((r) => !r.fechaRecepcion);

  return (
    <Pantalla recargar={recargar} cargando={cargando && !!e}>
      <Stack.Screen options={{ title: e?.codigoBarras ?? 'Equipo' }} />
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !e ? <Cargando /> : (
        <>
          {e.reportesFalla?.map((r) => (
            <Aviso key={r.id} tipo="error">
              Solicitud de soporte {ESTADOS_REPORTE[r.estado].nombre.toLowerCase()}: “{r.descripcion}”{r.empleado ? ` (reportó ${r.empleado.nombre})` : ''}.
            </Aviso>
          ))}

          <Tarjeta>
            <View style={estilos.fila}>
              <Titulo>{nombreEquipo(e)}</Titulo>
              <EtiquetaEstatus estatus={e.estatus} />
            </View>
            <Sub>{etiquetaTipo(e.tipo)}</Sub>
          </Tarjeta>

          <Tarjeta>
            <Text style={{ fontWeight: '700', color: COLOR.tinta }}>¿Quién lo tiene?</Text>
            {e.empleado ? (
              <>
                <Titulo>{e.empleado.nombre}</Titulo>
                <Dato etiqueta="Número de empleado" valor={e.empleado.numero} mono />
                <Dato etiqueta="Departamento" valor={e.empleado.departamento?.nombre} />
                {vigente?.fechaEntrega && <Dato etiqueta="Entregado" valor={fecha(vigente.fechaEntrega)} />}
                {vigente?.puestoDestinatario && (
                  <Dato etiqueta="Lo usa" valor={vigente.nombreDestinatario ? `${vigente.nombreDestinatario} (${vigente.puestoDestinatario.nombre})` : vigente.puestoDestinatario.nombre} />
                )}
                {e.estatus !== 'ASIGNADO' && <Sub>Sigue ligado a esta persona mientras está {e.estatus === 'EN_REPARACION' ? 'en reparación' : e.estatus === 'RESGUARDO' ? 'en resguardo' : 'dañado'}.</Sub>}
              </>
            ) : <Sub>{e.estatus === 'BAJA' ? 'Dado de baja.' : 'No está asignado a nadie.'}</Sub>}
          </Tarjeta>

          {reparacion && (
            <Aviso>En reparación desde el {fecha(reparacion.fechaEnvio)}{reparacion.proveedor ? ` con ${reparacion.proveedor}` : ''}: {reparacion.motivo}</Aviso>
          )}

          <Tarjeta>
            <Text style={{ fontWeight: '700', color: COLOR.tinta }}>Características</Text>
            {CARACTERISTICAS.map(([k, etiqueta]) => (
              <Dato key={k} etiqueta={etiqueta} valor={e[k] ? String(e[k]) : null} mono={k === 'serie' || k === 'codigoBarras'} />
            ))}
            {e.notas && <Dato etiqueta="Notas" valor={e.notas} />}
          </Tarjeta>

          <Boton texto="Escanear otro equipo" onPress={() => router.back()} />
        </>
      )}
    </Pantalla>
  );
}
