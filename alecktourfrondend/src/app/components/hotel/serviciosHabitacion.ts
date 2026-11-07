import {
  Accessibility,
  AlarmClock,
  Armchair,
  Baby,
  Bath,
  BedDouble,
  Blinds,
  Cigarette,
  Coffee,
  ConciergeBell,
  CookingPot,
  Croissant,
  Droplets,
  Fan,
  Flame,
  GlassWater,
  Lamp,
  type LucideIcon,
  Microwave,
  MonitorPlay,
  PawPrint,
  Phone,
  Plug,
  Refrigerator,
  Shirt,
  ShowerHead,
  Snowflake,
  Sofa,
  Sparkles,
  Sun,
  Tv,
  Vault,
  Waves,
  Wifi,
  Wind,
} from "lucide-react";
import type { CondicionHabitacion } from "../../services/hotel.service";

export interface ServicioHabitacion {
  clave: string;
  etiqueta: string;
  icono: LucideIcon;
}

export interface CategoriaServicios {
  titulo: string;
  servicios: ServicioHabitacion[];
}

/**
 * Catálogo de lo que puede incluir una habitación. Las claves deben coincidir
 * con SERVICIOS_HABITACION en backend/app/schemas/hotel_schema.py (el backend
 * rechaza con 422 cualquier clave que no esté allá).
 */
export const CATALOGO_SERVICIOS: CategoriaServicios[] = [
  {
    titulo: "Baño",
    servicios: [
      { clave: "ducha", etiqueta: "Ducha", icono: ShowerHead },
      { clave: "banera", etiqueta: "Bañera", icono: Bath },
      { clave: "agua_caliente", etiqueta: "Agua caliente", icono: Flame },
      { clave: "secador", etiqueta: "Secador de pelo", icono: Wind },
      { clave: "articulos_aseo", etiqueta: "Artículos de aseo", icono: Droplets },
      { clave: "toallas", etiqueta: "Toallas", icono: Sparkles },
      { clave: "bata_pantuflas", etiqueta: "Bata y pantuflas", icono: Shirt },
    ],
  },
  {
    titulo: "Dormitorio",
    servicios: [
      { clave: "ropa_cama", etiqueta: "Ropa de cama", icono: BedDouble },
      { clave: "almohadas_extra", etiqueta: "Almohadas extra", icono: BedDouble },
      { clave: "cortinas_blackout", etiqueta: "Cortinas blackout", icono: Blinds },
      { clave: "armario", etiqueta: "Armario o clóset", icono: Shirt },
      { clave: "cuna", etiqueta: "Cuna (bajo petición)", icono: Baby },
    ],
  },
  {
    titulo: "Clima",
    servicios: [
      { clave: "aire_acondicionado", etiqueta: "Aire acondicionado", icono: Snowflake },
      { clave: "ventilador", etiqueta: "Ventilador", icono: Fan },
      { clave: "calefaccion", etiqueta: "Calefacción", icono: Flame },
    ],
  },
  {
    titulo: "Tecnología",
    servicios: [
      { clave: "wifi", etiqueta: "Wi-Fi gratis", icono: Wifi },
      { clave: "tv", etiqueta: "TV de pantalla plana", icono: Tv },
      { clave: "tv_cable", etiqueta: "Canales por cable", icono: Tv },
      { clave: "streaming", etiqueta: "Streaming (Netflix, etc.)", icono: MonitorPlay },
      { clave: "telefono", etiqueta: "Teléfono", icono: Phone },
      { clave: "enchufes_cama", etiqueta: "Enchufes junto a la cama", icono: Plug },
    ],
  },
  {
    titulo: "Comida y bebida",
    servicios: [
      { clave: "minibar", etiqueta: "Minibar", icono: GlassWater },
      { clave: "nevera", etiqueta: "Nevera", icono: Refrigerator },
      { clave: "cafetera", etiqueta: "Cafetera", icono: Coffee },
      { clave: "hervidor", etiqueta: "Hervidor de agua", icono: Coffee },
      { clave: "microondas", etiqueta: "Microondas", icono: Microwave },
      { clave: "cocineta", etiqueta: "Cocineta", icono: CookingPot },
      { clave: "agua_cortesia", etiqueta: "Agua de cortesía", icono: GlassWater },
    ],
  },
  {
    titulo: "Comodidad",
    servicios: [
      { clave: "escritorio", etiqueta: "Escritorio", icono: Lamp },
      { clave: "caja_fuerte", etiqueta: "Caja fuerte", icono: Vault },
      { clave: "plancha", etiqueta: "Plancha", icono: Shirt },
      { clave: "sofa", etiqueta: "Sofá", icono: Sofa },
      { clave: "zona_estar", etiqueta: "Zona de estar", icono: Armchair },
      { clave: "balcon", etiqueta: "Balcón", icono: Sun },
      { clave: "terraza", etiqueta: "Terraza", icono: Sun },
      { clave: "jacuzzi", etiqueta: "Jacuzzi", icono: Waves },
    ],
  },
  {
    titulo: "Servicio",
    servicios: [
      { clave: "limpieza_diaria", etiqueta: "Limpieza diaria", icono: Sparkles },
      { clave: "servicio_habitacion", etiqueta: "Servicio a la habitación", icono: ConciergeBell },
      { clave: "despertador", etiqueta: "Servicio de despertador", icono: AlarmClock },
    ],
  },
];

/** Condiciones sí/no. `si`/`no` es el texto que ve el cliente en cada caso. */
export const CONDICIONES_HABITACION: {
  clave: CondicionHabitacion;
  etiqueta: string;
  si: string;
  no: string;
  icono: LucideIcon;
}[] = [
  { clave: "desayuno_incluido", etiqueta: "Desayuno", si: "Desayuno incluido", no: "Desayuno no incluido", icono: Croissant },
  { clave: "cama_extra", etiqueta: "Cama extra", si: "Se puede pedir cama extra", no: "No admite cama extra", icono: BedDouble },
  { clave: "accesible", etiqueta: "Accesible", si: "Accesible en silla de ruedas", no: "No adaptada para silla de ruedas", icono: Accessibility },
  { clave: "admite_mascotas", etiqueta: "Mascotas", si: "Se admiten mascotas", no: "No se admiten mascotas", icono: PawPrint },
  { clave: "permite_fumar", etiqueta: "Fumar", si: "Se permite fumar", no: "Habitación para no fumadores", icono: Cigarette },
];

const POR_CLAVE = new Map(CATALOGO_SERVICIOS.flatMap((c) => c.servicios.map((s) => [s.clave, s] as const)));

/** Servicios marcados, agrupados por categoría (en el orden del catálogo). */
export function serviciosAgrupados(claves?: string[] | null): CategoriaServicios[] {
  const marcados = new Set(claves ?? []);
  return CATALOGO_SERVICIOS.map((c) => ({
    titulo: c.titulo,
    servicios: c.servicios.filter((s) => marcados.has(s.clave)),
  })).filter((c) => c.servicios.length > 0);
}

export function servicioPorClave(clave: string): ServicioHabitacion | undefined {
  return POR_CLAVE.get(clave);
}

