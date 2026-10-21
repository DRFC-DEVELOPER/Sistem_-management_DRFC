export type Rol = 'ADMIN' | 'TECNICO' | 'CONSULTA';
export type Tipo = 'LAPTOP' | 'TECLADO' | 'MOUSE' | 'MONITOR' | 'ADAPTADOR' | 'MULTIFUNCIONAL' | 'ACCESS_POINT' | 'OTRO';
export type Estatus = 'DISPONIBLE' | 'ASIGNADO' | 'EN_REPARACION' | 'DANADO' | 'BAJA';

export const TIPOS: Record<Tipo, string> = {
  LAPTOP: 'Laptop', TECLADO: 'Teclado', MOUSE: 'Mouse', MONITOR: 'Monitor', ADAPTADOR: 'Adaptador',
  MULTIFUNCIONAL: 'Multifuncional', ACCESS_POINT: 'Access Point', OTRO: 'Otro',
};
export const ESTATUS: Record<Estatus, { nombre: string; plural: string; clase: string }> = {
  DISPONIBLE: { nombre: 'Disponible', plural: 'Disponibles', clase: 'c-disp' },
  ASIGNADO: { nombre: 'Asignado', plural: 'Asignados', clase: 'c-asig' },
  EN_REPARACION: { nombre: 'En reparación', plural: 'En reparación', clase: 'c-rep' },
  DANADO: { nombre: 'Dañado', plural: 'Dañados', clase: 'c-dan' },
  BAJA: { nombre: 'Baja', plural: 'Dados de baja', clase: 'c-baja' },
};
export const ROLES: Record<Rol, string> = { ADMIN: 'Administrador', TECNICO: 'Técnico', CONSULTA: 'Consulta' };

export interface Usuario { id: number; nombre: string; correo: string; rol: Rol }

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
}

export interface Asignacion {
  id: number;
  equipoId: number;
  empleadoId: number;
  fechaEntrega: string | null;
  fechaDevolucion: string | null;
  notas: string | null;
  empleado?: { id: number; nombre: string; departamento?: { nombre: string } | null };
  equipo?: Pick<Equipo, 'id' | 'tipo' | 'marca' | 'modelo' | 'serie'> & { estatus?: Estatus };
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
  equipo?: Pick<Equipo, 'id' | 'tipo' | 'marca' | 'modelo' | 'serie' | 'estatus'>;
  creadoPor?: { nombre: string } | null;
}

export interface EquipoDetalle extends Equipo {
  empleado: { id: number; nombre: string; numero: string | null; departamento: Ref | null } | null;
  asignaciones: Asignacion[];
  reparaciones: Reparacion[];
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
  { clave: 'descripcion', etiqueta: 'Equipo / descripción', tipos: ['MULTIFUNCIONAL', 'ACCESS_POINT', 'OTRO', 'ADAPTADOR'] },
  { clave: 'tipoAdaptador', etiqueta: 'Tipo de adaptador', tipos: ['ADAPTADOR'], opciones: [['RED', 'Red'], ['MULTIPUERTOS', 'Multipuertos']] },
  { clave: 'marca', etiqueta: 'Marca' },
  { clave: 'modelo', etiqueta: 'Modelo' },
  { clave: 'serie', etiqueta: 'Número de serie', mono: true },
  { clave: 'color', etiqueta: 'Color', tipos: ['LAPTOP', 'TECLADO', 'MOUSE', 'MONITOR', 'OTRO'] },
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
export const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
