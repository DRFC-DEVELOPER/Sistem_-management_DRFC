export type Rol = 'ADMIN' | 'TECNICO' | 'CONSULTA' | 'EMPLEADO';
export type Tipo = string;
export type AmbitoEquipo = 'USUARIO' | 'INFRAESTRUCTURA';
export type Estatus = 'DISPONIBLE' | 'ASIGNADO' | 'EN_REPARACION' | 'DANADO' | 'RESGUARDO' | 'BAJA';

export const TIPOS: Record<string, string> = {
  LAPTOP: 'Laptop', TECLADO: 'Teclado', MOUSE: 'Mouse', MONITOR: 'Monitor', ADAPTADOR: 'Adaptador',
  MULTIFUNCIONAL: 'Multifuncional', SOPORTE: 'Soporte', ACCESS_POINT: 'Access Point', OTRO: 'Otro',
  TELEFONO_MOVIL: 'Teléfono móvil',
};
export const TIPOS_PLURAL: Record<string, string> = {
  LAPTOP: 'laptops', TECLADO: 'teclados', MOUSE: 'mouse', MONITOR: 'monitores', ADAPTADOR: 'adaptadores',
  MULTIFUNCIONAL: 'multifuncionales', SOPORTE: 'soportes', ACCESS_POINT: 'access points', OTRO: 'otros equipos',
  TELEFONO_MOVIL: 'teléfonos móviles',
};
export const etiquetaTipo = (tipo: Tipo) => TIPOS[tipo] ?? tipo;
export const pluralTipo = (tipo: Tipo) => TIPOS_PLURAL[tipo] ?? `equipos de tipo ${etiquetaTipo(tipo).toLowerCase()}`;
export const esJefeArea = (puesto?: string | null) =>
  puesto?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase() === 'jefe de area';
export const AMBITOS_EQUIPO: Record<AmbitoEquipo, string> = {
  USUARIO: 'Equipo de usuario',
  INFRAESTRUCTURA: 'Infraestructura',
};
export const ESTATUS: Record<Estatus, { nombre: string; plural: string; clase: string }> = {
  DISPONIBLE: { nombre: 'Disponible', plural: 'Disponibles', clase: 'c-disp' },
  ASIGNADO: { nombre: 'Asignado', plural: 'Asignados', clase: 'c-asig' },
  EN_REPARACION: { nombre: 'En reparación', plural: 'En reparación', clase: 'c-rep' },
  DANADO: { nombre: 'Dañado', plural: 'Dañados', clase: 'c-dan' },
  RESGUARDO: { nombre: 'En resguardo', plural: 'En resguardo', clase: 'c-resg' },
  BAJA: { nombre: 'Baja', plural: 'Dados de baja', clase: 'c-baja' },
};
// Cómo terminó una asignación, según el estatus en que quedó el equipo.
export const RESULTADOS: Partial<Record<Estatus, string>> = {
  DISPONIBLE: 'Devuelto', DANADO: 'Devuelto dañado', EN_REPARACION: 'Enviado a reparación', RESGUARDO: 'En resguardo', BAJA: 'Dado de baja',
};
export const ROLES: Record<Rol, string> = { ADMIN: 'Administrador', TECNICO: 'Técnico', CONSULTA: 'Consulta', EMPLEADO: 'Empleado' };
/** Roles que se asignan desde Usuarios; las cuentas de empleados se crean en su ficha. */
export const ROLES_PERSONAL = ['ADMIN', 'TECNICO', 'CONSULTA'] as const;

export interface Usuario { id: number; nombre: string; usuario: string; correo: string | null; rol: Rol; empleadoId?: number | null; debeCambiarPassword?: boolean }

/** Cuenta con la que el empleado entra a la app móvil. `passwordTemporal` solo llega al crearla o restablecerla. */
export interface AccesoEmpleado {
  id: number; usuario: string; activo: boolean; ultimoAcceso: string | null; creadoEn: string; debeCambiarPassword: boolean; passwordTemporal?: string;
}

export type EstadoReporte = 'PENDIENTE' | 'EN_ATENCION' | 'CERRADO';
export const ESTADOS_REPORTE: Record<EstadoReporte, { nombre: string; clase: string }> = {
  PENDIENTE: { nombre: 'Pendiente', clase: 'c-dan' },
  EN_ATENCION: { nombre: 'En atención', clase: 'c-rep' },
  CERRADO: { nombre: 'Cerrado', clase: 'c-disp' },
};
/** Falla que un empleado reportó desde la app. */
export interface ReporteFalla {
  id: number; equipoId: number; empleadoId: number; descripcion: string; estado: EstadoReporte; respuesta: string | null;
  reparacionId: number | null; atendidoEn: string | null; cerradoEn: string | null; creadoEn: string;
  equipo: { id: number; tipo: Tipo; marca: string | null; modelo: string | null; serie: string | null; codigoBarras: string | null; estatus: Estatus } | null;
  empleado: { id: number; nombre: string; departamento: { nombre: string } | null } | null;
  atendidoPor: { nombre: string } | null;
  reparacion: { id: number; fechaEnvio: string; fechaRecepcion: string | null; proveedor: string | null } | null;
}

export interface Ref { id: number; nombre: string }
export interface TipoEquipoCatalogo { nombre: Tipo; predeterminado: boolean }

export interface Equipo {
  id: number;
  tipo: Tipo;
  ambito: AmbitoEquipo;
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
  puestoDestinatario: (Ref & { persona: string | null }) | null;
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
  puestoDestinatarioId?: number | null;
  puestoDestinatario?: Ref | null;
  nombreDestinatario?: string | null;
  /** Estatus en que quedó el equipo al cerrar la asignación. */
  resultado?: Estatus | null;
  /** Equipo dañado o en reparación al que sustituye mientras la asignación es temporal. */
  sustituyeEquipoId?: number | null;
  empleado?: { id: number; nombre: string; departamento?: { nombre: string } | null };
  equipo?: Pick<Equipo, 'id' | 'tipo' | 'marca' | 'modelo' | 'serie' | 'color' | 'descripcion' | 'codigoBarras' | 'tipoAdaptador'> & { estatus?: Estatus; empleadoId?: number | null };
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
  /** Solicitud de soporte sin cerrar que un empleado mandó desde la app (como máximo una). */
  reportesFalla?: { id: number; estado: EstadoReporte; descripcion: string; creadoEn: string; empleado: { id: number; nombre: string } | null }[];
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
  puestoId: number | null;
  creadoEn: string;
}
export interface EmpleadoListado extends Empleado { departamento: Ref | null; puesto: Ref | null; equiposAsignados: number }
export interface EmpleadoDetalle extends Empleado {
  departamento: Ref | null;
  puesto: Ref | null;
  equiposActuales: Equipo[];
  asignaciones: Asignacion[];
}

/** Identifica a quién va un equipo: '' = uso propio; si no, puesto + nombre de la persona a cargo del jefe de área. */
export const claveDestino = (puestoId?: number | null, persona?: string | null) =>
  puestoId ? `${puestoId}|${(persona ?? '').replace(/\s+/g, ' ').trim().toLocaleLowerCase()}` : '';
/** Destinatario de un equipo del empleado, según su asignación vigente o la más reciente. */
export const claveDestinoDe = (emp: EmpleadoDetalle, equipoId: number) => {
  const a = emp.asignaciones.find((x) => x.equipoId === equipoId && !x.fechaDevolucion) ?? emp.asignaciones.find((x) => x.equipoId === equipoId);
  return claveDestino(a?.puestoDestinatarioId, a?.nombreDestinatario);
};
/** "Almacenista · Juan Pérez", o solo el puesto si no se capturó el nombre. */
export const textoDestinatario = (puesto: string, persona?: string | null) => (persona ? `${puesto} · ${persona}` : puesto);

export interface Pagina<T> { total: number; pagina: number; limite: number; datos: T[] }

// Campos que aplican a cada tipo de equipo (sin lista = todos los tipos).
export const CAMPOS: { clave: keyof Equipo; etiqueta: string; tipos?: Tipo[]; opciones?: [string, string][]; mono?: boolean }[] = [
  { clave: 'descripcion', etiqueta: 'Equipo / descripción' },
  { clave: 'tipoAdaptador', etiqueta: 'Tipo de adaptador', tipos: ['ADAPTADOR'], opciones: [['RED', 'Red'], ['MULTIPUERTOS', 'Multipuertos']] },
  { clave: 'marca', etiqueta: 'Marca' },
  { clave: 'modelo', etiqueta: 'Modelo' },
  { clave: 'serie', etiqueta: 'Número de serie', mono: true },
  { clave: 'color', etiqueta: 'Color', tipos: ['LAPTOP', 'TECLADO', 'MOUSE', 'MONITOR', 'SOPORTE', 'OTRO'] },
  { clave: 'memoriaGb', etiqueta: 'Memoria (GB)', tipos: ['LAPTOP'] },
  { clave: 'procesador', etiqueta: 'Procesador', tipos: ['LAPTOP'] },
  { clave: 'disco', etiqueta: 'Tamaño de disco (GB)', tipos: ['LAPTOP'] },
  { clave: 'sistemaOperativo', etiqueta: 'Sistema operativo', tipos: ['LAPTOP'] },
  { clave: 'ipGestion', etiqueta: 'IP de gestión', tipos: ['MULTIFUNCIONAL', 'ACCESS_POINT', 'OTRO'], mono: true },
];

export const nombreEquipo = (e: Pick<Equipo, 'tipo' | 'marca' | 'modelo'> & { descripcion?: string | null }) =>
  [e.descripcion && e.tipo !== 'ADAPTADOR' ? e.descripcion : etiquetaTipo(e.tipo), e.marca, e.modelo].filter(Boolean).join(' ');

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
