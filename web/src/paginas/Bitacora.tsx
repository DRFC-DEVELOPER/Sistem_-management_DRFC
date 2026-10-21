import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useCarga } from '../usar';
import { Pagina } from '../tipos';
import { Cargando, ErrorCarga, Paginacion } from '../ui';

interface Registro { id: number; accion: string; entidad: string; entidadId: number | null; fecha: string; usuario: { nombre: string } | null }
const ENLACE: Record<string, string> = { equipo: '/equipos/', empleado: '/empleados/' };
const hora = (iso: string) => new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

export default function Bitacora() {
  const [pagina, setPagina] = useState(1);
  const { datos, error, recargar } = useCarga(() => api<Pagina<Registro>>(`/bitacora?pagina=${pagina}&limite=50`), [pagina]);
  return (
    <>
      <div className="encabezado"><div><h1>Bitácora</h1><p className="sub" style={{ margin: '4px 0 0' }}>Quién hizo cada cambio y cuándo.</p></div></div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : (
        <>
          <section className="panel desliza">
            <table className="tabla">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th></tr></thead>
              <tbody>
                {datos.datos.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{hora(r.fecha)}</td>
                    <td>{r.usuario?.nombre ?? 'Sistema'}</td>
                    <td>{r.entidadId && ENLACE[r.entidad] ? <Link to={`${ENLACE[r.entidad]}${r.entidadId}`}>{r.accion}</Link> : r.accion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <Paginacion total={datos.total} pagina={datos.pagina} limite={datos.limite} onCambiar={setPagina} />
        </>
      )}
    </>
  );
}
