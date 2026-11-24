import { useState } from "react";

interface AvatarProps {
  nombre: string;
  apellido?: string;
  /** URL completa ya resuelta (ver resolveFotoUrl en ../types) — si es
   * undefined/null, o si la imagen falla al cargar, se cae de vuelta a las
   * iniciales. Nunca se inventa una foto cuando no hay una real. */
  fotoUrl?: string | null;
  color?: "primary" | "gold";
  size?: "sm" | "md";
}

// Avatar reutilizable: foto real cuando existe, iniciales con el color de
// marca cuando no — usado por ModuleReservas (cliente/asesor), ModuleClientes
// (tabla + perfil) y ModuleUsuarios, para no repetir la misma lógica de
// respaldo tres veces.
export default function Avatar({ nombre, apellido, fotoUrl, color = "primary", size = "md" }: AvatarProps) {
  const [fallback, setFallback] = useState(false);
  const initials = `${nombre?.[0] ?? ""}${apellido?.[0] ?? ""}`.toUpperCase() || "?";
  const sizeCls = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  const colorCls = color === "primary" ? "bg-primary/10 text-primary" : "bg-[#C9A227]/15 text-[#7A5F08] dark:text-[#E3C55A]";

  if (fotoUrl && !fallback) {
    return (
      <img
        src={fotoUrl}
        alt={`${nombre} ${apellido ?? ""}`.trim()}
        onError={() => setFallback(true)}
        className={`${sizeCls} rounded-full object-cover flex-shrink-0 ring-1 ring-border`}
      />
    );
  }

  return (
    <div className={`${sizeCls} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${colorCls}`}>
      {initials}
    </div>
  );
}
