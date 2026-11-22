import { 
  Palmtree, Mountain, Music, Utensils, Compass, Coffee,
  User, Heart, Users, Sparkles, Wallet, CreditCard, Gem,
  Sun, CloudRain, MapPin, Car, Plane
} from "lucide-react";

export const interestCategories = [
  { id: "beach", label: "Playa y Relax", icon: Palmtree },
  { id: "nature", label: "Naturaleza", icon: Mountain },
  { id: "culture", label: "Cultura", icon: Music },
  { id: "food", label: "Gastronomía", icon: Utensils },
  { id: "adventure", label: "Aventura", icon: Compass },
  { id: "wellness", label: "Bienestar", icon: Coffee },
];

export const travelCompany = [
  { id: "solo", label: "Solo/a", icon: User },
  { id: "couple", label: "En Pareja", icon: Heart },
  { id: "family", label: "En Familia", icon: Users },
  { id: "friends", label: "Con Amigos", icon: Sparkles },
];

export const budgetOptions = [
  { id: "low", label: "Económico", desc: "Ahorro total", icon: Wallet },
  { id: "mid", label: "Estándar", desc: "Comodidad", icon: CreditCard },
  { id: "high", label: "Premium", desc: "Todo incluido", icon: Gem },
];

export const weatherPrefs = [
  { id: "warm", label: "Clima Cálido", desc: "Sol y brisa", icon: Sun },
  { id: "cold", label: "Clima Frío", desc: "Montaña y café", icon: CloudRain },
];

export const paceOptions = [
  { id: "relax", label: "Relajado", desc: "Sin afanes", icon: Coffee },
  { id: "active", label: "Explorador", desc: "A tope", icon: MapPin },
];

export const transportPrefs = [
  { id: "private", label: "Privado", desc: "Carro/Traslado", icon: Car },
  { id: "public", label: "Aéreo/Local", desc: "Vuelos/Botes", icon: Plane },
];
/** Opción de una pregunta del cuestionario de preferencias. */
export interface OpcionPreferencia {
  id: string;
  label: string;
  desc?: string;
  icon: typeof Sun;
}

/** Campos que guarda el backend (preferencias_route.py) y sus opciones. */
export const CAMPOS_PREFERENCIA = {
  intereses: interestCategories as OpcionPreferencia[],
  compania: travelCompany as OpcionPreferencia[],
  presupuesto: budgetOptions as OpcionPreferencia[],
  clima: weatherPrefs as OpcionPreferencia[],
  ritmo: paceOptions as OpcionPreferencia[],
  transporte: transportPrefs as OpcionPreferencia[],
};

export type CampoPreferencia = keyof typeof CAMPOS_PREFERENCIA;

/** Texto legible de un valor guardado ("mid" → "Estándar"). Valores que no
 * están en el catálogo (datos viejos) se muestran tal cual. */
export function etiquetaPreferencia(campo: CampoPreferencia, valor: string | null | undefined): string {
  if (!valor) return "";
  return CAMPOS_PREFERENCIA[campo].find((o) => o.id === valor)?.label ?? valor;
}
