import type { Tema } from "../../services/tema.service";

// Qué decoración ambiental trae cada tema de temporada. La paleta sigue
// viviendo en el tema (TemaContext.tsx); esto decide SOLO lo decorativo:
// qué cae por la pantalla, si hay guirnalda de luces bajo el navbar y si
// las tarjetas llevan gorro de nieve.
export type EfectoTemporada = "nieve" | "corazones" | "confeti" | "hojas" | "petalos" | "destellos";

export interface DecoracionTemporada {
  efecto: EfectoTemporada | null;
  /** Tira de luces colgando bajo el navbar. */
  guirnalda: boolean;
  /** Borde de nieve acumulada sobre fotos de tarjetas y sobre el footer. */
  nieveAcumulada: boolean;
  /** Texto corto para la insignia ("Especial de Navidad"). */
  etiqueta: string;
}

const SIN_DECORACION: DecoracionTemporada = {
  efecto: null,
  guirnalda: false,
  nieveAcumulada: false,
  etiqueta: "",
};

// Temas sembrados de fábrica (ver migración 6c564b92474a).
const POR_CLAVE: Record<string, Omit<DecoracionTemporada, "etiqueta">> = {
  navidad: { efecto: "nieve", guirnalda: true, nieveAcumulada: true },
  "fin-de-anio": { efecto: "confeti", guirnalda: true, nieveAcumulada: false },
  "amor-amistad": { efecto: "corazones", guirnalda: false, nieveAcumulada: false },
  halloween: { efecto: "hojas", guirnalda: false, nieveAcumulada: false },
  "semana-santa": { efecto: "petalos", guirnalda: false, nieveAcumulada: false },
  "vacaciones-mitad-anio": { efecto: "destellos", guirnalda: false, nieveAcumulada: false },
};

// Temas creados por el administrador: no tienen una clave conocida, así que
// la decoración se deduce del ícono que eligió (catálogo de temaIconos.tsx).
const POR_ICONO: Record<string, Omit<DecoracionTemporada, "etiqueta">> = {
  snowflake: { efecto: "nieve", guirnalda: false, nieveAcumulada: true },
  "cloud-snow": { efecto: "nieve", guirnalda: false, nieveAcumulada: true },
  "tree-pine": { efecto: "nieve", guirnalda: true, nieveAcumulada: true },
  gift: { efecto: "nieve", guirnalda: true, nieveAcumulada: false },
  heart: { efecto: "corazones", guirnalda: false, nieveAcumulada: false },
  "party-popper": { efecto: "confeti", guirnalda: true, nieveAcumulada: false },
  leaf: { efecto: "hojas", guirnalda: false, nieveAcumulada: false },
  ghost: { efecto: "hojas", guirnalda: false, nieveAcumulada: false },
  flower2: { efecto: "petalos", guirnalda: false, nieveAcumulada: false },
  star: { efecto: "destellos", guirnalda: false, nieveAcumulada: false },
  sparkles: { efecto: "destellos", guirnalda: false, nieveAcumulada: false },
  sun: { efecto: "destellos", guirnalda: false, nieveAcumulada: false },
};

export function decoracionDeTema(tema: Tema | null | undefined): DecoracionTemporada {
  // El tema de marca (todo el año) nunca lleva decoración.
  if (!tema || tema.es_predeterminado) return SIN_DECORACION;
  const base = POR_CLAVE[tema.clave] ?? (tema.icono ? POR_ICONO[tema.icono] : undefined);
  if (!base) return SIN_DECORACION;
  return { ...base, etiqueta: `Especial de ${tema.nombre}` };
}

// Páginas donde la animación estorba más de lo que aporta: el panel de
// trabajo del personal y los pasos donde el cliente paga o llena datos.
const RUTAS_SIN_AMBIENTE = [/^\/admin/, /^\/checkout/, /^\/pagar/, /^\/reservar/, /^\/confirmation/];

export function rutaPermiteAmbiente(pathname: string): boolean {
  return !RUTAS_SIN_AMBIENTE.some((r) => r.test(pathname));
}
