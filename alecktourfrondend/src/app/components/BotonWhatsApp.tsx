import { enlaceWhatsAppAgencia } from "../utils/whatsapp";

/** Ícono oficial de WhatsApp (glifo del teléfono en el globo). */
export function IconoWhatsApp({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.46 9.48-9.46 2.53 0 4.91.99 6.7 2.78a9.4 9.4 0 0 1 2.77 6.69c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.52A11.33 11.33 0 0 0 12.04.65C5.76.65.65 5.75.65 12.03c0 2.01.52 3.97 1.52 5.69L.55 23.45l5.86-1.54a11.37 11.37 0 0 0 5.63 1.43h.01c6.28 0 11.39-5.1 11.39-11.38 0-3.04-1.18-5.9-3.34-8.06z" />
    </svg>
  );
}

interface Props {
  /** Mensaje inicial del chat (opcional). */
  mensaje?: string;
  /** Texto del botón. */
  texto?: string;
  /** Línea secundaria (ej. el número). */
  detalle?: string;
  /** "compacto" para el navbar de escritorio, "bloque" para menús y tarjetas. */
  variante?: "compacto" | "bloque";
  className?: string;
  onClick?: () => void;
}

/**
 * Botón para escribirle a la agencia por WhatsApp (wa.me, abre la app en el
 * celular y WhatsApp Web en el computador). Verde oficial de WhatsApp con
 * texto blanco: se reconoce en cualquier tema de color del sitio.
 */
export default function BotonWhatsApp({
  mensaje,
  texto = "WhatsApp",
  detalle,
  variante = "compacto",
  className = "",
  onClick,
}: Props) {
  const bloque = variante === "bloque";
  return (
    <a
      href={enlaceWhatsAppAgencia(mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      aria-label={`${texto}${detalle ? ` (${detalle})` : ""}: abrir chat de WhatsApp con la agencia`}
      className={`inline-flex items-center gap-2.5 rounded-xl bg-[#25D366] text-white font-semibold shadow-sm transition-colors hover:bg-[#1EBE5A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 ${
        bloque ? "w-full px-4 py-3" : "px-3 py-2 text-xs"
      } ${className}`}
    >
      <IconoWhatsApp className={bloque ? "w-6 h-6 shrink-0" : "w-4 h-4 shrink-0"} />
      <span className="leading-tight text-left">
        <span className={`block ${bloque ? "text-sm" : ""}`}>{texto}</span>
        {detalle && <span className="block text-[11px] font-medium text-white/85">{detalle}</span>}
      </span>
    </a>
  );
}
