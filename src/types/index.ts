export type Puesto = 'muelle' | 'labarthe' | 'despacho';

export interface ProductoBuque {
  id: string;
  producto: string;
  cantidadBuque: number;
}

export interface ItemProductoCarga {
  producto: string;
  bolsones: number;
}

export interface Buque {
  id: string;
  nombre: string;
  muelle: string;
  estado: 'activo' | 'finalizado' | 'en_espera';
  fechaArribo: string;
  productos: ProductoBuque[];
}

export interface RegistroViaje {
  id: string;
  idempotencyKey: string;
  viajeId: string;
  buqueId: string;
  buqueNombre: string;
  puesto: Puesto;
  tt: string;
  conductor?: string;
  bolsones: number;
  productos: string;
  itemsProductos?: ItemProductoCarga[];
  fechaHora: string;
  timestamp: number;
  fotos: string[];
  baseViajeId: string;
  editadoPor?: {
    dni: string;
    fechaHora: string;
    bolsonesPrevios: number;
    productoPrevio: string;
  };
}

export interface Conductor {
  id: string;
  nombre: string;
  placa: string;
}

export type ThemeId =
  | 'normal'
  | 'navidad'
  | 'fiestas_patrias'
  | 'primavera'
  | 'san_valentin'
  | 'dia_madre'
  | 'dia_padre'
  | 'ano_nuevo';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  icon: string;
  description: string;
  autoMonth?: number; // 0-11
  headerBg: string;
  headerBorder: string;
  accentBg: string;
  accentText: string;
  cardBorder: string;
  badgeStyle: string;
  festiveEmoji: string;
  particleType?: 'snow' | 'confetti' | 'petals' | 'hearts' | 'sparkles';
}

export interface TelemetriaPing {
  puesto: string;
  inspectorNombre: string;
  fechaHora: string;
  timestamp: number;
  buqueId: string;
  estadoRed: 'online' | 'weak' | 'offline';
  pendientesCola: number;
  bateria?: number;
}

export interface TelemetriaLog {
  id: string;
  puesto: string;
  tipoError: string;
  detalle: string;
  fechaHora: string;
  buqueNombre: string;
}
