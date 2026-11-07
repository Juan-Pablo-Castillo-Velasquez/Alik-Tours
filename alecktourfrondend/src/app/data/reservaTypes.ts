export interface ReservaResponse {
  id_reserva: number;
  id_cliente: number;
  id_empleado: number;
  id_paquete: number;
  fecha_reserva: string;
  fecha_inicio: string;
  fecha_fin: string;
  numero_personas: number;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'finalizada';
  precio_total?: number;
  /** Suma de pagos aprobados y lo que falta por pagar (backend). */
  total_pagado?: number;
  saldo_pendiente?: number;
  // Nombre del paquete y ciudad/país del hotel — resueltos por el backend
  // (Reserva.nombre_paquete / Reserva.destino) para no mostrar solo el
  // id_paquete crudo en el historial de reservas.
  nombre_paquete?: string | null;
  destino?: string | null;
  // Nombre del hotel — respaldo cuando la reserva no tiene paquete (reserva
  // directa de habitación); ver Reserva.hotel_nombre en el backend.
  hotel_nombre?: string | null;
  // El backend YA manda esto embebido (ReservaResponse.pagos en
  // reserva_schema.py) desde antes -- este tipo simplemente nunca lo había
  // declarado. Lo usa TabFacturas.tsx para armar el historial de facturas
  // sin pedir un endpoint nuevo. `import type` evita el ciclo real en
  // tiempo de ejecución con reserva.service.ts (que importa de este mismo
  // archivo) -- se borra por completo al compilar.
  pagos?: import('../services/reserva.service').PagoResponse[];
  tipo_producto?: TipoProducto | null;
  adultos?: number | null;
  ninos?: number | null;
  infantes?: number | null;
  id_salida?: number | null;
  id_oferta_vuelo?: number | null;
  estado_vuelo?: string | null;
  solicitudes_especiales?: string | null;
}

export type TipoProducto = 'hotel' | 'paquete' | 'vuelo';

export interface ViajeroInput {
  tipo: 'adulto' | 'nino' | 'infante';
  nombres: string;
  apellidos: string;
  fecha_nacimiento?: string | null;
  nacionalidad?: string | null;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  es_titular?: boolean;
}

export interface Viajero extends ViajeroInput {
  id_viajero: number;
}

/** Lo que eligió el cliente: el backend calcula el precio a partir de esto. */
export interface SeleccionProducto {
  tipo_producto: TipoProducto;
  id_paquete?: number | null;
  id_salida?: number | null;
  id_oferta_vuelo?: number | null;
  incluir_vuelo?: boolean;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  adultos?: number;
  ninos?: number;
  infantes?: number;
  habitaciones?: HabitacionReservaCreate[];
  servicios_opcionales?: number[];
  descuento?: { monto: number; motivo: string } | null;
}

export interface Concepto {
  tipo: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  incluido: boolean;
}

export interface Cotizacion {
  tipo_producto: TipoProducto;
  fecha_inicio: string;
  fecha_fin: string;
  noches: number;
  adultos: number;
  ninos: number;
  infantes: number;
  conceptos: Concepto[];
  total: number;
  estado_vuelo?: string | null;
  advertencias: string[];
}

// NUEVO: representa una habitación específica dentro de una reserva
export interface HabitacionReservaCreate {
  id_habitacion: number;
  fecha_checkin: string;
  fecha_checkout: string;
}

export interface ReservaCreate extends Partial<Omit<SeleccionProducto, 'tipo_producto' | 'fecha_inicio' | 'fecha_fin' | 'id_paquete'>> {
  id_cliente: number;
  id_empleado?: number;
  id_paquete?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  numero_personas?: number;
  /** Flujo nuevo (desglose, viajeros, vuelo). */
  tipo_producto?: TipoProducto;
  viajeros?: ViajeroInput[];
  solicitudes_especiales?: string | null;
  notas_internas?: string | null;
  precio_esperado?: number;
  estado_inicial?: 'pendiente' | 'confirmada';
  estado?: string;
  // NUEVO: si se está reservando una habitación de hotel, va aquí.
  // El precio NO se manda desde el frontend: el backend lo calcula con el precio real de la BD.
  habitaciones?: HabitacionReservaCreate[];
  /** Versión de los términos aceptada en el checkout (content/terminos.ts). */
  terminos_version?: string;
  /** Una por intento: el mismo intento enviado dos veces crea UNA reserva. */
  clave_idempotencia?: string;
}

export interface ReservaUpdate extends Partial<ReservaCreate> { }