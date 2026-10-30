// Tipos y textos que comparte la app con la API (ver web/src/tipos.ts).

export type Rol = 'ADMIN' | 'TECNICO' | 'CONSULTA' | 'EMPLEADO';
export type Estatus = 'DISPONIBLE' | 'ASIGNADO' | 'EN_REPARACION' | 'DANADO' | 'RESGUARDO' | 'BAJA';
export type EstadoReporte = 'PENDIENTE' | 'EN_ATENCION' | 'CERRADO';

export interface Usuario {
  id: number; nombre: string; usuario: string; correo: string | null; rol: Rol; empleadoId: number | null; debeCambiarPassword: boolean;
}
export interface Ref { id: number; nombre: string }

export const COLOR = {
  fondo: '#e4e4e4', superficie: '#ffffff', superficie2: '#eef0f3', tinta: '#0b3a52', texto: '#333333', tenue: '#6b7280', linea: '#d9dde2',
  acento: '#2f6fa8', acentoSuave: '#e2ecf5', ok: '#16a34a', alerta: '#d97706', mal: '#b91c1c', apagado: '#4b5563', temporal: '#7c3aed',
};

export const ESTATUS: Record<Estatus, { nombre: string; color: string }> = {
  DISPONIBLE: { nombre: 'Disponible', color: COLOR.ok },
  ASIGNADO: { nombre: 'Asignado', color: COLOR.acento },
  EN_REPARACION: { nombre: 'En reparación', color: COLOR.alerta },
  DANADO: { nombre: 'Dañado', color: COLOR.mal },
  RESGUARDO: { nombre: 'En resguardo', color: COLOR.temporal },
  BAJA: { nombre: 'Baja', color: COLOR.apagado },
};
export const ESTADOS_REPORTE: Record<EstadoReporte, { nombre: string; color: string }> = {
  PENDIENTE: { nombre: 'Pendiente', color: COLOR.mal },
  EN_ATENCION: { nombre: 'En atención', color: COLOR.alerta },
  CERRADO: { nombre: 'Cerrado', color: COLOR.ok },
};

const TIPOS: Record<string, string> = {
  LAPTOP: 'Laptop', TECLADO: 'Teclado', MOUSE: 'Mouse', MONITOR: 'Monitor', ADAPTADOR: 'Adaptador', MULTIFUNCIONAL: 'Multifuncional',
  SOPORTE: 'Soporte', ACCESS_POINT: 'Access Point', OTRO: 'Otro', TELEFONO_MOVIL: 'Teléfono móvil',
};
export const etiquetaTipo = (tipo: string) => TIPOS[tipo] ?? tipo;

export interface EquipoBase {
  id: number; tipo: string; descripcion: string | null; marca: string | null; modelo: string | null; serie: string | null; codigoBarras: string | null;
  color: string | null; memoriaGb: string | null; procesador: string | null; disco: string | null; sistemaOperativo: string | null; estatus: Estatus;
}
export const nombreEquipo = (e: Pick<EquipoBase, 'tipo' | 'marca' | 'modelo'> & { descripcion?: string | null }) =>
  [e.descripcion && e.tipo !== 'ADAPTADOR' ? e.descripcion : etiquetaTipo(e.tipo), e.marca, e.modelo].filter(Boolean).join(' ');

/** Campos que se muestran en la ficha, en el mismo orden que el formulario de la web. */
export const CARACTERISTICAS: [keyof EquipoBase, string][] = [
  ['marca', 'Marca'], ['modelo', 'Modelo'], ['serie', 'Número de serie'], ['codigoBarras', 'Código de barras'], ['color', 'Color'],
  ['memoriaGb', 'Memoria (GB)'], ['procesador', 'Procesador'], ['disco', 'Tamaño de disco (GB)'], ['sistemaOperativo', 'Sistema operativo'],
];

// ---------- Empleado ----------

export interface MiPerfil {
  id: number; numero: string | null; nombre: string; correo: string | null; activo: boolean; departamento: Ref | null; puesto: Ref | null;
}
export interface MiEquipo extends EquipoBase {
  fechaEntrega: string | null;
  /** Si es jefe de área: puesto y persona de su departamento que usa el equipo. */
  paraPuesto: Ref | null; paraPersona: string | null;
  temporal: boolean;
  reporteAbierto: { id: number; estado: EstadoReporte; descripcion: string; respuesta: string | null; creadoEn: string } | null;
}
export interface MiReporte {
  id: number; equipoId: number; descripcion: string; estado: EstadoReporte; respuesta: string | null; creadoEn: string; atendidoEn: string | null; cerradoEn: string | null;
  equipo: Pick<EquipoBase, 'id' | 'tipo' | 'marca' | 'modelo' | 'serie' | 'codigoBarras' | 'estatus'> & { descripcion?: string | null } | null;
}

// ---------- Personal de soporte (escáner) ----------

export interface EquipoDetalle extends EquipoBase {
  notas: string | null;
  empleado: { id: number; nombre: string; numero: string | null; departamento: Ref | null } | null;
  asignaciones: { id: number; fechaEntrega: string | null; fechaDevolucion: string | null; nombreDestinatario: string | null; puestoDestinatario: Ref | null }[];
  reparaciones: { id: number; fechaEnvio: string; fechaRecepcion: string | null; motivo: string; proveedor: string | null }[];
  reportesFalla?: { id: number; estado: EstadoReporte; descripcion: string; creadoEn: string; empleado: { id: number; nombre: string } | null }[];
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** "2026-10-29" o una fecha ISO → "29 oct 2026". */
export const fecha = (f?: string | null) => {
  if (!f) return '';
  const [a, m, d] = f.slice(0, 10).split('-').map(Number);
  return `${d} ${MESES[m - 1]} ${a}`;
};
