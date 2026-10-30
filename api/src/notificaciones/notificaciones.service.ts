import { Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DB, InjectDb } from '../db/db.module';
import { dispositivosPush, usuariosSistema } from '../db/esquema';

const URL_EXPO = 'https://exp.host/--/api/v2/push/send';
// Expo acepta hasta 100 mensajes por petición.
const POR_PETICION = 100;

interface Aviso { titulo: string; cuerpo: string; datos?: Record<string, unknown> }
interface Ticket { status: 'ok' | 'error'; message?: string; details?: { error?: string } }

/** Notificaciones push a la app móvil mediante el servicio de Expo. Nunca hace fallar la operación que las dispara. */
@Injectable()
export class NotificacionesService {
  private log = new Logger('Notificaciones');

  constructor(@InjectDb() private db: DB) {}

  /** Liga el celular a quien inició sesión; si otra cuenta lo usaba antes, pasa a esta. */
  async registrar(usuarioId: number, token: string, plataforma?: string) {
    await this.db
      .insert(dispositivosPush)
      .values({ usuarioId, token, plataforma: plataforma ?? null })
      .onConflictDoUpdate({ target: dispositivosPush.token, set: { usuarioId, plataforma: plataforma ?? null, actualizadoEn: new Date() } });
    return { ok: true };
  }

  /** Al cerrar sesión el celular deja de recibir avisos de esa cuenta. */
  async quitar(usuarioId: number, token: string) {
    await this.db.delete(dispositivosPush).where(and(eq(dispositivosPush.usuarioId, usuarioId), eq(dispositivosPush.token, token)));
    return { ok: true };
  }

  /** Avisa a soporte (administradores y técnicos activos). */
  aSoporte(aviso: Aviso) {
    this.enSegundoPlano(async () => {
      const filas = await this.db
        .select({ token: dispositivosPush.token })
        .from(dispositivosPush)
        .innerJoin(usuariosSistema, eq(usuariosSistema.id, dispositivosPush.usuarioId))
        .where(and(eq(usuariosSistema.activo, true), inArray(usuariosSistema.rol, ['ADMIN', 'TECNICO'])));
      await this.enviar(filas.map((f) => f.token), aviso);
    });
  }

  /** Avisa al empleado en los celulares donde tiene sesión iniciada. */
  aEmpleado(empleadoId: number, aviso: Aviso) {
    this.enSegundoPlano(async () => {
      const filas = await this.db
        .select({ token: dispositivosPush.token })
        .from(dispositivosPush)
        .innerJoin(usuariosSistema, eq(usuariosSistema.id, dispositivosPush.usuarioId))
        .where(and(eq(usuariosSistema.empleadoId, empleadoId), eq(usuariosSistema.activo, true)));
      await this.enviar(filas.map((f) => f.token), aviso);
    });
  }

  // La respuesta al usuario no espera al servicio de Expo.
  private enSegundoPlano(tarea: () => Promise<void>) {
    tarea().catch((e) => this.log.warn(`No se pudo enviar la notificación: ${(e as Error).message}`));
  }

  private async enviar(tokens: string[], { titulo, cuerpo, datos }: Aviso) {
    if (!tokens.length) return;
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
    // Opcional: solo si se activa la seguridad de push en el panel de EAS.
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    for (let i = 0; i < tokens.length; i += POR_PETICION) {
      const lote = tokens.slice(i, i + POR_PETICION);
      const mensajes = lote.map((to) => ({ to, title: titulo, body: cuerpo, data: datos ?? {}, sound: 'default', channelId: 'default', priority: 'high' }));
      const res = await fetch(URL_EXPO, { method: 'POST', headers, body: JSON.stringify(mensajes), signal: AbortSignal.timeout(10_000) });
      const json = (await res.json().catch(() => null)) as { data?: Ticket[]; errors?: { message: string }[] } | null;
      if (!res.ok) throw new Error(json?.errors?.map((e) => e.message).join('; ') || `Expo respondió ${res.status}`);
      // Los tickets vienen en el mismo orden que los mensajes; los celulares que ya no existen se dan de baja.
      const invalidos = (json?.data ?? []).flatMap((t, j) => (t.status === 'error' && t.details?.error === 'DeviceNotRegistered' ? [lote[j]] : []));
      if (invalidos.length) await this.db.delete(dispositivosPush).where(inArray(dispositivosPush.token, invalidos));
      const otros = (json?.data ?? []).filter((t) => t.status === 'error' && t.details?.error !== 'DeviceNotRegistered');
      if (otros.length) this.log.warn(`Expo rechazó ${otros.length} notificación(es): ${otros[0].message}`);
    }
  }
}
