import { FormEvent, useState } from 'react';
import { useSesion } from '../sesion';
import { Campo } from '../ui';

export default function Acceso() {
  const { entrar } = useSesion();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    setError('');
    setOcupado(true);
    try { await entrar(usuario, password); } catch (e) { setError((e as Error).message); } finally { setOcupado(false); }
  };

  return (
    <div className="acceso">
      <div className="acceso__marco">
        <section className="acceso__bienvenida" aria-label="Bienvenida">
          <div>
            <h1>¡Bienvenido!</h1>
            <span className="acceso__raya" aria-hidden="true" />
          </div>
          <p>Sistema de Gestión y Control de Inventario Informático para el Personal de la DRFC.</p>
        </section>
        <form className="acceso__formulario form" onSubmit={enviar} noValidate>
          <h2>Iniciar sesión</h2>
          <span className="acceso__avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0z" /></svg>
          </span>
          <Campo etiqueta="Usuario o correo">
            <input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoFocus />
          </Campo>
          <Campo etiqueta="Contraseña">
            <span className="acceso__password">
              <input type={mostrarPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" onClick={() => setMostrarPassword(!mostrarPassword)} aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={mostrarPassword}>
                {mostrarPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a14.8 14.8 0 0 1-3.1 3.9M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.2 0 2.3-.3 3.3-.7" /></svg>
                )}
              </button>
            </span>
          </Campo>
          {error && <p className="acceso__error" role="alert">{error}</p>}
          <button className="acceso__entrar" disabled={ocupado || !usuario || !password}>{ocupado ? 'Entrando…' : 'Iniciar'}</button>
        </form>
      </div>
    </div>
  );
}
