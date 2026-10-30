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
}

// NUEVO: representa una habitación específica dentro de una reserva
export interface HabitacionReservaCreate {
  id_habitacion: number;
  fecha_checkin: string;
  fecha_checkout: string;
}

export interface ReservaCreate {
  id_cliente: number;
  id_empleado?: number;
  id_paquete?: number;
  fecha_inicio: string;
  fecha_fin: string;
  numero_personas: number;
  estado?: string;
  // NUEVO: si se está reservando una habitación de hotel, va aquí.
  // El precio NO se manda desde el frontend: el backend lo calcula con el precio real de la BD.
  habitaciones?: HabitacionReservaCreate[];
  /** Versión de los términos aceptada en el checkout (content/terminos.ts). */
  terminos_version?: string;
}

export interface ReservaUpdate extends Partial<ReservaCreate> { }