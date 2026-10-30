import { BASE_URL } from "../../api/v1/api";

// Convierte una ruta relativa de foto de perfil (ej. "/uploads/perfiles/xxx.jpg",
// tal como la devuelve Usuario.foto_perfil / Cliente.foto_perfil /
// Empleado.foto_perfil) en una URL completa que un <img> pueda cargar. Los
// componentes de avatar la usan para decidir si muestran la foto real o
// caen de vuelta a las iniciales — nunca inventa una URL cuando no hay foto.
export function resolveFotoUrl(foto_perfil?: string | null): string | undefined {
  if (!foto_perfil) return undefined;
  return foto_perfil.startsWith("http") ? foto_perfil : `${BASE_URL}${foto_perfil}`;
}

// Identificadores de cada pantalla del admin — compartido por
// Admindashboard.tsx (qué módulo renderizar) y AdminSidebar.tsx (qué ítem
// de navegación resaltar). Los que todavía no tienen módulo real construido
// (cancelaciones, empresas, pagos, notificaciones, roles, actividad,
// configuracion) muestran un EmptyState en vez de datos inventados — se
// van habilitando fase a fase del rediseño del panel.
export type Module =
  | "dashboard"
  | "reservas"
  | "crear-reserva"
  | "hoteles"
  | "paquetes"
  | "clientes"
  | "cancelaciones"
  | "empresas"
  | "pagos"
  | "usuarios"
  | "notificaciones"
  | "roles"
  | "actividad"
  | "configuracion"
  | "mi-cuenta"
  | "banners"
  | "temas"
  | "mensajes";

export interface Reserva {
  id_reserva: number;
  id_cliente: number;
  id_paquete: number;
  id_empleado?: number;           // null = reserva hecha en web sin asesor
  // Ya existía en ReservaResponse (Reserva.fecha_reserva, timestamp real de
  // creación) — solo faltaba declararse acá. Distinta de fecha_inicio (el
  // check-in del viaje): esta es cuándo se HIZO la reserva.
  fecha_reserva: string;
  fecha_inicio: string;
  fecha_fin: string;
  numero_personas: number;
  estado: string;
  // El backend (ReservaResponse) ya devuelve estos campos calculados desde
  // Reserva.hotel_nombre / Reserva.destino (ver reserva_model.py) — se
  // agregan aquí para el ranking "Hoteles más reservados" del Dashboard,
  // sin pedir ningún endpoint nuevo.
  hotel_nombre?: string | null;
  destino?: string | null;
  // precio_total ya existía en ReservaResponse; fecha_ultima_actualizacion
  // es nueva (ver Reserva.fecha_ultima_actualizacion en reserva_model.py) —
  // ambos para las columnas "Total" y "Última actualización" del módulo
  // de Reservas del admin.
  precio_total?: number;
  fecha_ultima_actualizacion?: string | null;
  // BUG real corregido en el backend (ver ReservaResponse en
  // reserva_schema.py): antes GET /reservas nunca devolvía canal_origen
  // (solo el detalle lo hacía), así que la columna "Canal" del módulo de
  // Reservas siempre mostraba "Web" para todas las filas sin importar el
  // valor real. Ahora sí viaja en la lista.
  canal_origen?: CanalOrigen | null;
}

export type CanalOrigen = "web" | "empleado" | "telefono";

// Extiende Reserva con el campo canal_origen
// Recomendado: agregar esta columna a la tabla `reservas` en la DB
// ALTER TABLE reservas ADD COLUMN canal_origen VARCHAR(20) DEFAULT 'web'
//   CHECK (canal_origen IN ('web', 'empleado', 'telefono'));
export interface ReservaExtended extends Reserva {
  canal_origen?: CanalOrigen;
}

export interface TipoHabitacionAdmin {
  id_tipo_habitacion: number;
  nombre_tipo: string;
  descripcion?: string | null;
  capacidad_personas: number;
}

// Antes solo declaraba { id_habitacion: number } — el backend (HotelDetailResponse)
// ya manda la habitación completa en cada hotel de GET /hoteles/, solo faltaba
// declararlo acá. Usado por el selector de hotel/habitación de Crear Reserva.
export interface HabitacionAdmin {
  id_habitacion: number;
  id_hotel: number;
  numero_habitacion: string;
  precio_noche: number;
  estado: "disponible" | "ocupada" | "mantenimiento";
  tipo_habitacion?: TipoHabitacionAdmin | null;
}

export interface HotelData {
  id_hotel: number;
  nombre_hotel: string;
  calificacion: number;
  ciudad: string;
  pais: string;
  correo_electronico: string;
  telefono: string;
  descripcion?: string | null;
  politicas?: string | null;
  // GET /hoteles/ ya responde con HotelDetailResponse — estos campos ya
  // viajan en cada hotel de la lista, solo faltaba declararlos acá.
  // total_resenas/calificacion_promedio: reales, calculados en el backend
  // desde la tabla resenas (ver Hotel.total_resenas en hotel_model.py).
  total_resenas?: number;
  calificacion_promedio?: number | null;
  habitaciones?: HabitacionAdmin[];
  imagen_url?: string | null;
  // Galería de fotos reales (distinta de imagen_url, la portada) -- ver
  // POST/DELETE /hoteles/{id}/galeria en hotel_route.py.
  imagenes?: { id_imagen: number; url: string; orden: number }[];
}

export interface Paquete {
  id_paquete: number;
  nombre_paquete: string;
  descripcion: string;
  duracion_dias: number;
  precio_base: number;
  activo: boolean;
  // Ciudad de SALIDA del viaje — distinta de la ciudad de destino (esa sale
  // de los hoteles vinculados al paquete, ver paquete_hotel).
  ciudad_salida?: string | null;
  condiciones?: string | null;
  // Calculada en el backend (primer hotel vinculado) — null si el paquete
  // todavía no tiene ningún hotel real asociado.
  ciudad_destino?: string | null;
  // Portada del paquete (mismo patrón que Hotel.imagen_url) -- antes
  // Paquete no tenía ningún campo de imagen propio.
  imagen_url?: string | null;
}

export interface Cliente {
  id_cliente: number;
  nombre: string;
  apellido: string;
  cedula: string;
  correo: string;
  celular: string;
  direccion?: string;
  ciudad: string;
  pais: string;
  fecha_nacimiento?: string;
  // Real, tomada de la cuenta de Usuario vinculada (ver Cliente.foto_perfil
  // en cliente_model.py) — None si el cliente no tiene cuenta o no subió foto.
  foto_perfil?: string | null;
  // Ya existía en la tabla (Cliente.fecha_registro) — solo faltaba
  // exponerse en ClienteResponse. "Cliente desde" en el perfil de admin.
  fecha_registro?: string | null;
}

export interface Empleado {
  id_empleado: number;
  nombre: string;
  apellido: string;
  correo_electronico: string;
  celular?: string;
  // Ver Cliente.foto_perfil — mismo criterio, vía la cuenta de Usuario del asesor.
  foto_perfil?: string | null;
}

export interface Pago {
  id_pago: number;
  id_reserva: number;
  monto: number;
  // Enum real de Pago.estado (ver PagoUpdate en reserva_schema.py) — antes
  // este tipo solo tenía 3 de los 5 valores reales, así que un pago
  // 'procesando' o 'cancelado' no calzaba con el tipo declarado acá.
  estado: "pendiente" | "procesando" | "pagado" | "rechazado" | "cancelado";
  referencia?: string;
  fecha_pago?: string;
  // Asignado por el backend (FAC-000123, a partir del id_pago real) la
  // primera vez que el pago llega a 'pagado' — ver _asignar_numero_factura
  // en reserva_route.py. null/undefined hasta entonces.
  numero_factura?: string | null;
  // Voucher externo (transferencia/consignación) subido por un admin vía
  // POST /api/pagos/{id}/comprobante — ruta relativa, usar resolveFotoUrl().
  comprobante_url?: string | null;
  metodo_pago?: {
    id_metodo: number;
    nombre_metodo: string;
  };
}

export interface Usuario {
  id_usuario: number;
  username: string;
  correo_electronico: string;
  activo: boolean;
  verificado: boolean;
  nombre_completo: string | null;
  roles: string[];
  // Real (UsuarioAdminResponse.foto_perfil, ver usuario_route.py) — para
  // mostrar la foto real del usuario en vez de solo sus iniciales.
  foto_perfil?: string | null;
  // Reales (UsuarioAdminResponse.fecha_creacion / .ultimo_login, ver
  // usuario_route.py) — para el perfil detallado de ModuleUsuarios.tsx.
  // ultimo_login llega en null para las cuentas que no han iniciado sesión
  // desde que auth_service.py empezó a registrarlo.
  fecha_creacion?: string | null;
  ultimo_login?: string | null;
}

export interface Rol {
  id_rol: number;
  nombre_rol: string;
}

// Colores de estado consistentes con la paleta de marca (mismo criterio que
// ModuleDashboard: dorado/granate/rosa para los estados normales, rojo
// reservado solo para "cancelada"). Usan opacidad en vez de mapas dark/light
// separados para que se vean bien en ambos temas sin duplicar clases.
export const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-[#C9A227]/15 text-[#C9A227]",
  confirmada: "bg-primary/10 text-primary",
  cancelada: "bg-destructive/10 text-destructive",
  finalizada: "bg-[#A13B55]/15 text-[#A13B55]",
  // Estados de pagos (Pago.estado) y solicitudes de cancelación
  // (SolicitudCancelacion.estado) — mismos tokens de marca, para que
  // StatusBadge se vea consistente sin importar el dominio. pagado/aprobada/
  // activo usan --success (antes emerald-500 suelto, sin relación con la
  // paleta ni con el resto de estados "positivos" del panel).
  procesando: "bg-[#C9A227]/15 text-[#C9A227]",
  pagado: "bg-success/10 text-success",
  rechazado: "bg-destructive/10 text-destructive",
  rechazada: "bg-destructive/10 text-destructive",
  aprobada: "bg-success/10 text-success",
  cancelado: "bg-destructive/10 text-destructive",
  // Estados de Usuario.activo
  activo: "bg-success/10 text-success",
  inactivo: "bg-muted text-muted-foreground",
  // Estados de Usuario.verificado (ver ModuleUsuarios.tsx -- override manual
  // de admin para cuando el correo de verificación nunca llegó)
  verificado: "bg-[#C9A227]/15 text-[#C9A227]",
  no_verificado: "bg-muted text-muted-foreground",
};

export const inputCls =
  "w-full px-4 py-2.5 border border-border bg-input-background text-foreground rounded-xl focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none outline-none text-sm placeholder:text-muted-foreground/60";
export const labelCls = "block text-sm font-medium text-muted-foreground mb-1";

// Estilo de tarjeta compartido por todos los módulos de admin (misma
// convención visual que ModuleDashboard: tokens de marca, no grises sueltos).
export const cardCls = "bg-card rounded-2xl p-6 shadow-sm border border-border";
export const primaryBtnCls =
  "w-full py-2.5 bg-gradient-to-r from-primary to-[#A13B55] text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 text-sm";