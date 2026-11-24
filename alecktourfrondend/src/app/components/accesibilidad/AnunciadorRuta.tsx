import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useAccesibilidad } from "../../context/AccesibilidadContext";
import { useIdioma } from "../../i18n";
import { hablar } from "./lecturaVoz";

/**
 * Al navegar dentro del sitio (sin recargar), los lectores de pantalla no
 * se enteran del cambio de página. Este componente:
 * - anuncia "Página: <título>" en una región aria-live,
 * - lleva el foco al título principal (h1) o al contenido principal, para
 *   que el teclado y el lector empiecen desde arriba de la nueva página,
 * - y, con "leer al enfocar o tocar", lo dice en voz alta.
 */
export default function AnunciadorRuta() {
  const { pathname } = useLocation();
  const { t, idioma } = useIdioma();
  const { prefs } = useAccesibilidad();
  const [mensaje, setMensaje] = useState("");
  const primera = useRef(true);

  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const id = window.setTimeout(() => {
      if (document.querySelector("[role='dialog'][data-state='open']")) return;
      const h1 = document.querySelector<HTMLElement>("main h1, h1");
      const destino = h1 ?? document.querySelector<HTMLElement>("#contenido-principal, main");
      const titulo = (h1?.textContent ?? document.title).replace(/\s+/g, " ").trim();
      if (destino) {
        if (!destino.hasAttribute("tabindex")) destino.setAttribute("tabindex", "-1");
        destino.focus({ preventScroll: true });
      }
      const texto = t("a11y.pagina", { titulo });
      setMensaje(texto);
      if (prefs.leerAlEnfocar) hablar(texto, idioma, { anuncio: true });
    }, 450);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {mensaje}
    </div>
  );
}
