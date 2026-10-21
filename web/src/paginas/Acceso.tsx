import { FormEvent, useState } from 'react';
import { useSesion } from '../sesion';
import { Marca } from '../App';
import { Campo } from '../ui';

export default function Acceso() {
  const { entrar } = useSesion();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    setOcupado(true);
    try { await entrar(correo, password); } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  };

  return (
    <div className="acceso">
      <div className="caja">
        <Marca />
        <form className="panel form" onSubmit={enviar} noValidate>
          <div>
            <h1>Inicia sesión</h1>
            <p className="sub" style={{ margin: 0 }}>Usa la cuenta que te dio el administrador del sistema.</p>
          </div>
          <Campo etiqueta="Correo">
            <input type="email" autoComplete="username" value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus />
          </Campo>
          <Campo etiqueta="Contraseña">
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Campo>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="btn" disabled={ocupado || !correo || !password}>{ocupado ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}
