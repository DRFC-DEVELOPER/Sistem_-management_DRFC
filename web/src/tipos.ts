export type Rol = 'ADMIN' | 'TECNICO' | 'CONSULTA';
export type Tipo = 'LAPTOP' | 'TECLADO' | 'MOUSE' | 'MONITOR' | 'ADAPTADOR' | 'MULTIFUNCIONAL' | 'SOPORTE' | 'ACCESS_POINT' | 'OTRO';
export type Estatus = 'DISPONIBLE' | 'ASIGNADO' | 'EN_REPARACION' | 'DANADO' | 'BAJA';

export const TIPOS: Record<Tipo, string> = {
  LAPTOP: 'Laptop', TECLADO: 'Teclado', MOUSE: 'Mouse', MONITOR: 'Monitor', ADAPTADOR: 'Adaptador',
  MULTIFUNCIONAL: 'Multifuncional', SOPORTE: 'Soporte', ACCESS_POINT: 'Access Point', OTRO: 'Otro',
};
export const TIPOS_PLURAL: Record<Tipo, string> = {
  LAPTOP: 'laptops', TECLADO: 'teclados', MOUSE: 'mouse', MONITOR: 'monitores', ADAPTADOR: 'adaptadores',
  MULTIFUNCIONAL: 'multifuncionales', SOPORTE: 'soportes', ACCESS_POINT: 'access points', OTRO: 'otros equipos',
};
export const ESTATUS: Record<Estatus, { nombre: string; plural: string; clase: string }> = {
  DISPONIBLE: { nombre: 'Disponible', plural: 'Disponibles', clase: 'c-disp' },
  ASIGNADO: { nombre: 'Asignado', plural: 'Asignados', clase: 'c-asig' },
  EN_REPARACION: { nombre: 'En reparación', plural: 'En reparación', clase: 'c-rep' },
  DANADO: { nombre: 'Dañado', plural: 'Dañados', clase: 'c-dan' },
  BAJA: { nombre: 'Baja', plural: 'Dados de baja', clase: 'c-baja' },
};
// Cómo terminó una asignación, según el estatus en que quedó el equipo.
export const RESULTADOS: Partial<Record<Estatus, string>> = {
  DISPONIBLE: 'Devuelto', DANADO: 'Devuelto dañado', EN_REPARACION: 'Enviado a reparación', BAJA: 'Dado de baja',
};
export const ROLES: Record<Rol, string> = { ADMIN: 'Administrador', TECNICO: 'Técnico', CONSULTA: 'Consulta' };

export interface Usuario { id: number; nombre: string; usuario: string; correo: string | null; rol: Rol }

export interface Ref { id: number; nombre: string }

export interface Equipo {
  id: number;
  tipo: Tipo;
  descripcion: string | null;
  marca: string | null;
  modelo: string | null;
  serie: string | null;
  codigoBarras: string | null;
  color: string | null;
  memoriaGb: string | null;
  procesador: string | null;
  disco: string | null;
  sistemaOperativo: string | null;
  ipGestion: string | null;
  tipoAdaptador: 'RED' | 'MULTIPUERTOS' | null;
  estatus: Estatus;
  notas: string | null;
  fechaBaja: string | null;
  motivoBaja: string | null;
  empleadoId: number | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface EquipoListado extends Equipo {
  empleado: { id: number; nombre: string; numero: string | null } | null;
  departamento: Ref | null;
  /** Asignado temporalmente en lugar de un equipo dañado o en reparación. */
  temporal: boolean;
}

export type EquipoBreve = Pick<Equipo, 'id' | 'tipo' | 'marca' | 'modelo' | 'serie' | 'estatus'>;

export interface Asignacion {
  id: number;
  equipoId: number;
  empleadoId: number;
  fechaEntrega: string | null;
  fechaDevolucion: string | null;
  notas: string | null;
  /** Estatus en que quedó el equipo al cerrar la asignación. */
  resultado?: Estatus | null;
  /** Equipo dañado o en reparación al que sustituye mientras la asignación es temporal. */
  sustituyeEquipoId?: number | null;
  empleado?: { id: number; nombre: string; departamento?: { nombre: string } | null };
  equipo?: Pick<Equipo, 'id' | 'tipo' | 'marca' | 'modelo' | 'serie'> & { estatus?: Estatus; empleadoId?: number | null };
  entregadoPor?: { nombre: string } | null;
  recibidoPor?: { nombre: string } | null;
}

export interface Reparacion {
  id: number;
  equipoId: number;
  fechaEnvio: string;
  motivo: string;
  proveedor: string | null;
  fechaRecepcion: string | null;
  solucion: string | null;
  resultado: Estatus | null;
  equipo?: Pick<Equipo, 'id' | 'tipo' | 'marca' | 'modelo' | 'serie' | 'estatus'> & { empleado?: { id: number; nombre: string } | null };
  creadoPor?: { nombre: string } | null;
}

export interface EquipoDetalle extends Equipo {
  empleado: { id: number; nombre: string; numero: string | null; departamento: Ref | null } | null;
  asignaciones: Asignacion[];
  reparaciones: Reparacion[];
  /** Si está asignado temporalmente, el equipo dañado al que sustituye. */
  sustituye: EquipoBreve | null;
  /** Si está dañado o en reparación, los equipos que lo sustituyen temporalmente. */
  temporales: EquipoBreve[];
}

export interface Empleado {
  id: number;
  numero: string | null;
  nombre: string;
  correo: string | null;
  notas: string | null;
  activo: boolean;
  fechaBaja: string | null;
  departamentoId: number | null;
  creadoEn: string;
}
export interface EmpleadoListado extends Empleado { departamento: Ref | null; equiposAsignados: number }
export interface EmpleadoDetalle extends Empleado {
  departamento: Ref | null;
  equiposActuales: Equipo[];
  asignaciones: Asignacion[];
}

export interface Pagina<T> { total: number; pagina: number; limite: number; datos: T[] }

// Campos que aplican a cada tipo de equipo (sin lista = todos los tipos).
export const CAMPOS: { clave: keyof Equipo; etiqueta: string; tipos?: Tipo[]; opciones?: [string, string][]; mono?: boolean }[] = [
  { clave: 'descripcion', etiqueta: 'Equipo / descripción', tipos: ['MULTIFUNCIONAL', 'SOPORTE', 'ACCESS_POINT', 'OTRO', 'ADAPTADOR'] },
  { clave: 'tipoAdaptador', etiqueta: 'Tipo de adaptador', tipos: ['ADAPTADOR'], opciones: [['RED', 'Red'], ['MULTIPUERTOS', 'Multipuertos']] },
  { clave: 'marca', etiqueta: 'Marca' },
  { clave: 'modelo', etiqueta: 'Modelo' },
  { clave: 'serie', etiqueta: 'Número de serie', mono: true },
  { clave: 'color', etiqueta: 'Color', tipos: ['LAPTOP', 'TECLADO', 'MOUSE', 'MONITOR', 'SOPORTE', 'OTRO'] },
  { clave: 'memoriaGb', etiqueta: 'Memoria (GB)', tipos: ['LAPTOP'] },
  { clave: 'procesador', etiqueta: 'Procesador', tipos: ['LAPTOP'] },
  { clave: 'disco', etiqueta: 'Tamaño de disco', tipos: ['LAPTOP'] },
  { clave: 'sistemaOperativo', etiqueta: 'Sistema operativo', tipos: ['LAPTOP'] },
  { clave: 'ipGestion', etiqueta: 'IP de gestión', tipos: ['MULTIFUNCIONAL', 'ACCESS_POINT', 'OTRO'], mono: true },
];

export const nombreEquipo = (e: Pick<Equipo, 'tipo' | 'marca' | 'modelo'> & { descripcion?: string | null }) =>
  [e.descripcion && e.tipo !== 'ADAPTADOR' ? e.descripcion : TIPOS[e.tipo], e.marca, e.modelo].filter(Boolean).join(' ');

export const fecha = (iso?: string | null) => {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d ? `${d}/${m}/${a}` : iso;
};
export const hoy = () => {
  const d = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};
/** Orden de las listas por fecha de registro. */
export const ORDENES: [string, string][] = [['recientes', 'Más recientes'], ['antiguos', 'Más antiguos']];

export const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
