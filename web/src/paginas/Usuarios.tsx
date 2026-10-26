import { useState } from 'react';
import { api } from '../api';
import { useCarga } from '../usar';
import { useSesion } from '../sesion';
import { fecha, Rol, ROLES } from '../tipos';
import { Campo, Cargando, ErrorCarga, FormModal, useAvisos } from '../ui';

interface UsuarioSistema { id: number; nombre: string; usuario: string; correo: string | null; rol: Rol; activo: boolean; ultimoAcceso: string | null }

const DESCRIPCION: Record<Rol, string> = {
  ADMIN: 'Todo, incluido administrar usuarios y ver la bitácora',
  TECNICO: 'Altas, bajas, asignaciones, reparaciones e importación',
  CONSULTA: 'Solo puede ver la información',
};

export default function Usuarios() {
  const { usuario } = useSesion();
  const { datos, error, recargar } = useCarga(() => api<UsuarioSistema[]>('/usuarios-sistema'), []);
  const [editar, setEditar] = useState<UsuarioSistema | 'nuevo' | null>(null);
  return (
    <>
      <div className="encabezado">
        <div><h1>Usuarios del sistema</h1><p className="sub" style={{ margin: '4px 0 0' }}>Personas que pueden entrar a esta aplicación.</p></div>
        <button className="btn" onClick={() => setEditar('nuevo')}>Agregar usuario</button>
      </div>
      {error ? <ErrorCarga mensaje={error} reintentar={recargar} /> : !datos ? <Cargando /> : (
        <section className="panel desliza">
          <table className="tabla">
            <thead><tr><th>Nombre</th><th>Usuario</th><th>Correo</th><th>Rol</th><th>Último acceso</th><th></th></tr></thead>
            <tbody>
              {datos.map((u) => (
                <tr key={u.id} style={u.activo ? undefined : { opacity: 0.55 }}>
                  <td>{u.nombre}{u.id === usuario?.id && <span className="sub"> (tú)</span>}</td>
                  <td>{u.usuario}</td>
                  <td>{u.correo || '—'}</td>
                  <td>{ROLES[u.rol]}{!u.activo && <span className="sub"> | desactivado</span>}</td>
                  <td>{u.ultimoAcceso ? fecha(u.ultimoAcceso) : 'Nunca'}</td>
                  <td className="n"><button className="btn ghost sm" onClick={() => setEditar(u)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {editar && <FormUsuario u={editar === 'nuevo' ? undefined : editar} propio={editar !== 'nuevo' && editar.id === usuario?.id} onCerrar={() => setEditar(null)} onListo={() => { setEditar(null); recargar(); }} />}
    </>
  );
}

function FormUsuario({ u, propio, onCerrar, onListo }: { u?: UsuarioSistema; propio: boolean; onCerrar: () => void; onListo: () => void }) {
  const { avisar } = useAvisos();
  const [v, setV] = useState({ nombre: u?.nombre ?? '', usuario: u?.usuario ?? '', correo: u?.correo ?? '', rol: u?.rol ?? 'TECNICO', password: '', activo: u?.activo ?? true });
  return (
    <FormModal titulo={u ? 'Editar usuario' : 'Agregar usuario'} boton={u ? 'Guardar cambios' : 'Agregar usuario'} onCerrar={onCerrar} onEnviar={async () => {
      const cuerpo: Record<string, unknown> = { nombre: v.nombre, usuario: v.usuario, correo: v.correo || null, rol: v.rol };
      if (v.password) cuerpo.password = v.password;
      if (u) { if (!propio) cuerpo.activo = v.activo; await api(`/usuarios-sistema/${u.id}`, { metodo: 'PATCH', cuerpo }); }
      else await api('/usuarios-sistema', { cuerpo });
      avisar(u ? 'Usuario actualizado' : 'Usuario agregado');
      onListo();
    }}>
      <Campo etiqueta="Nombre"><input value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} /></Campo>
      <Campo etiqueta="Usuario (para iniciar sesión)"><input type="text" autoCapitalize="none" spellCheck={false} value={v.usuario} onChange={(e) => setV({ ...v, usuario: e.target.value })} autoComplete="off" /></Campo>
      <Campo etiqueta="Correo" opcional><input type="email" value={v.correo} onChange={(e) => setV({ ...v, correo: e.target.value })} autoComplete="off" /></Campo>
      <Campo etiqueta="Rol">
        <select value={v.rol} onChange={(e) => setV({ ...v, rol: e.target.value as Rol })} disabled={propio}>
          {(Object.keys(ROLES) as Rol[]).map((r) => <option key={r} value={r}>{ROLES[r]}: {DESCRIPCION[r]}</option>)}
        </select>
      </Campo>
      <Campo etiqueta={u ? 'Contraseña nueva (déjala vacía para no cambiarla)' : 'Contraseña (mínimo 10 caracteres)'}>
        <input type="password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} autoComplete="new-password" />
      </Campo>
      {u && !propio && <label className="casilla"><input type="checkbox" checked={v.activo} onChange={(e) => setV({ ...v, activo: e.target.checked })} /> Puede entrar al sistema</label>}
    </FormModal>
  );
}
