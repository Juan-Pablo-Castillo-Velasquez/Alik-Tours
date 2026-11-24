import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "./en";
import es from "./es";

/**
 * Multi idioma (español / inglés).
 *
 * - Los textos viven en es.ts (fuente) y en.ts (traducción), con claves
 *   planas tipo "auth.login.titulo". Si a en.ts le falta una clave, se usa
 *   la de español: nunca se ve una clave cruda.
 * - El idioma elegido se guarda en localStorage; por defecto, español.
 * - <html lang> se actualiza para que los lectores de pantalla pronuncien
 *   en el idioma correcto.
 * - Variables: t("pqr.vence", { n: 3 }) reemplaza {n}.
 */
export type Idioma = "es" | "en";
export type ClaveTexto = keyof typeof es;

export const IDIOMAS: { codigo: Idioma; nombre: string; corto: string }[] = [
  { codigo: "es", nombre: "Español", corto: "ES" },
  { codigo: "en", nombre: "English", corto: "EN" },
];

const DICCIONARIOS: Record<Idioma, Partial<Record<ClaveTexto, string>>> = { es, en };
const CLAVE_STORAGE = "alik_idioma";

function idiomaInicial(): Idioma {
  try {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    if (guardado === "es" || guardado === "en") return guardado;
  } catch {
    /* sin storage */
  }
  // Por defecto español (agencia colombiana); el inglés se elige con el
  // selector y queda guardado.
  return "es";
}

export function traducir(idioma: Idioma, clave: ClaveTexto | string, vars?: Record<string, string | number>) {
  const base = DICCIONARIOS[idioma][clave as ClaveTexto] ?? es[clave as ClaveTexto] ?? clave;
  if (!vars) return base;
  return base.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

type Contexto = {
  idioma: Idioma;
  setIdioma: (i: Idioma) => void;
  t: (clave: ClaveTexto | string, vars?: Record<string, string | number>) => string;
};

const IdiomaContext = createContext<Contexto>({
  idioma: "es",
  setIdioma: () => {},
  t: (c, v) => traducir("es", c, v),
});

export function IdiomaProvider({ children }: { children: ReactNode }) {
  const [idioma, setIdiomaEstado] = useState<Idioma>(idiomaInicial);

  useEffect(() => {
    document.documentElement.lang = idioma === "en" ? "en" : "es-CO";
  }, [idioma]);

  const setIdioma = useCallback((i: Idioma) => {
    setIdiomaEstado(i);
    try {
      localStorage.setItem(CLAVE_STORAGE, i);
    } catch {
      /* sin storage */
    }
  }, []);

  const t = useCallback((c: ClaveTexto | string, v?: Record<string, string | number>) => traducir(idioma, c, v), [idioma]);
  const valor = useMemo(() => ({ idioma, setIdioma, t }), [idioma, setIdioma, t]);
  return <IdiomaContext.Provider value={valor}>{children}</IdiomaContext.Provider>;
}

export const useIdioma = () => useContext(IdiomaContext);
export const useT = () => useContext(IdiomaContext).t;
