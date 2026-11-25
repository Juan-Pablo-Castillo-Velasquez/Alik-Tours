import { useEffect } from "react";

/**
 * Cuando una foto no carga (enlace roto, archivo borrado, sin conexión),
 * el navegador muestra un ícono roto con el texto alternativo encima del
 * diseño. Este componente la reemplaza por un fondo neutro de la marca con
 * un ícono de imagen, del mismo tamaño, para que la tarjeta se vea completa.
 *
 * - Si el componente ya tiene su propio onError y cambia la foto, se respeta.
 * - Se puede desactivar en una imagen con data-sin-respaldo.
 */
const RESPALDO =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4ece8"/><stop offset="1" stop-color="#e9dcd6"/></linearGradient></defs>
      <rect width="400" height="300" fill="url(#g)"/>
      <g fill="none" stroke="#b9969f" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" transform="translate(170 120)">
        <rect x="0" y="0" width="60" height="48" rx="8"/>
        <circle cx="19" cy="17" r="6"/>
        <path d="M60 34 44 20 10 48"/>
      </g>
    </svg>`,
  );

export default function ImagenesRotas() {
  useEffect(() => {
    const alFallar = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.sinRespaldo !== undefined || img.dataset.respaldo === "1") return;
      const fallida = img.currentSrc || img.src;
      // Deja que el onError propio del componente actúe primero.
      window.setTimeout(() => {
        if (!img.isConnected || (img.currentSrc || img.src) !== fallida) return;
        img.dataset.respaldo = "1";
        img.removeAttribute("srcset");
        img.src = RESPALDO;
        img.style.objectFit = "cover";
      }, 0);
    };
    document.addEventListener("error", alFallar, true);
    return () => document.removeEventListener("error", alFallar, true);
  }, []);
  return null;
}
