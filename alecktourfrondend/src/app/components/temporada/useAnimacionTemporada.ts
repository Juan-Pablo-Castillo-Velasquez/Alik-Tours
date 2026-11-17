import { useCallback, useEffect, useState } from "react";

// Preferencia del visitante: puede pausar la animación de temporada (nieve,
// confeti...) desde el footer. Se guarda en este navegador y se propaga a
// todos los componentes montados con un evento propio.
const CLAVE = "alik:animacion-temporada";
const EVENTO = "alik:animacion-temporada-cambio";

function leer(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== "off";
  } catch {
    return true;
  }
}

function prefiereMenosMovimiento(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useAnimacionTemporada() {
  const [activa, setActiva] = useState<boolean>(leer);
  const [reducida, setReducida] = useState<boolean>(prefiereMenosMovimiento);

  useEffect(() => {
    const alCambiar = () => setActiva(leer());
    window.addEventListener(EVENTO, alCambiar);
    window.addEventListener("storage", alCambiar);

    const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    const alCambiarMq = () => setReducida(!!mq?.matches);
    mq?.addEventListener?.("change", alCambiarMq);

    return () => {
      window.removeEventListener(EVENTO, alCambiar);
      window.removeEventListener("storage", alCambiar);
      mq?.removeEventListener?.("change", alCambiarMq);
    };
  }, []);

  const alternar = useCallback(() => {
    const siguiente = !leer();
    try {
      localStorage.setItem(CLAVE, siguiente ? "on" : "off");
    } catch {
      /* sin almacenamiento: el cambio dura lo que dure la pestaña */
    }
    setActiva(siguiente);
    window.dispatchEvent(new Event(EVENTO));
  }, []);

  return { activa, reducida, alternar };
}
