import { useT } from "../../i18n";

/** Primer elemento enfocable de cada página: lleva el foco al contenido
 * principal sin recorrer toda la barra de navegación con Tab. */
export default function SaltarContenido() {
  const t = useT();
  return (
    <a
      href="#contenido-principal"
      className="saltar-contenido"
      onClick={(e) => {
        e.preventDefault();
        const destino =
          document.getElementById("contenido-principal") ??
          document.querySelector<HTMLElement>("main") ??
          document.querySelector<HTMLElement>("h1");
        if (!destino) return;
        if (!destino.hasAttribute("tabindex")) destino.setAttribute("tabindex", "-1");
        destino.focus();
        destino.scrollIntoView({ block: "start" });
      }}
    >
      {t("comun.saltarContenido")}
    </a>
  );
}
