import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import * as bcrypt from 'bcryptjs';
import { DB, InjectDb } from '../db/db.module';
import { usuariosSistema } from '../db/esquema';
import { BitacoraService } from '../bitacora/bitacora.service';
import { ActualizarUsuarioSistemaDto, CrearUsuarioSistemaDto } from './dto/usuario-sistema.dto';

const publico = {
  id: usuariosSistema.id, nombre: usuariosSistema.nombre, correo: usuariosSistema.correo, rol: usuariosSistema.rol,
  activo: usuariosSistema.activo, ultimoAcceso: usuariosSistema.ultimoAcceso, creadoEn: usuariosSistema.creadoEn,
};

@Injectable()
export class UsuariosSistemaService {
  constructor(@InjectDb() private db: DB, private bitacora: BitacoraService) {}

  listar() {
    return this.db.select(publico).from(usuariosSistema).orderBy(asc(usuariosSistema.nombre));
  }

  async crear(dto: CrearUsuarioSistemaDto, autorId: number) {
    const correo = dto.correo.toLowerCase().trim();
    if (await this.db.query.usuariosSistema.findFirst({ where: eq(usuariosSistema.correo, correo) })) {
      throw new ConflictException('Ya existe un usuario con ese correo.');
    }
    const [u] = await this.db
      .insert(usuariosSistema)
      .values({ nombre: dto.nombre.trim(), correo, rol: dto.rol, passwordHash: await bcrypt.hash(dto.password, 12) })
      .returning(publico);
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Creó el usuario ${u.correo} (${u.rol})`, entidad: 'usuario', entidadId: u.id });
    return u;
  }

  async actualizar(id: number, dto: ActualizarUsuarioSistemaDto, autorId: number) {
    if (id === autorId && (dto.activo === false || (dto.rol && dto.rol !== 'ADMIN'))) {
      throw new BadRequestException('No puedes desactivarte ni quitarte el rol de administrador.');
    }
    const data: Partial<typeof usuariosSistema.$inferInsert> = {};
    if (dto.nombre) data.nombre = dto.nombre.trim();
    if (dto.correo) data.correo = dto.correo.toLowerCase().trim();
    if (dto.rol) data.rol = dto.rol;
    if (dto.activo !== undefined) data.activo = dto.activo;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);
    if (!Object.keys(data).length) throw new BadRequestException('No enviaste cambios.');
    const [u] = await this.db.update(usuariosSistema).set(data).where(eq(usuariosSistema.id, id)).returning(publico);
    if (!u) throw new NotFoundException('El usuario no existe.');
    const cambios = Object.keys(data).map((k) => (k === 'passwordHash' ? 'password' : k));
    await this.bitacora.registrar({ usuarioId: autorId, accion: `Modificó el usuario ${u.correo}`, entidad: 'usuario', entidadId: id, detalle: { cambios } });
    return u;
  }
}
