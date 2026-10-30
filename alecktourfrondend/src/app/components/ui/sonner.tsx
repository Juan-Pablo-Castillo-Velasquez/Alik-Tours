"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

// Toaster con los colores/tipografía de marca de Alik Tours en vez del
// rojo/verde genérico por defecto de sonner. Las variables de abajo son
// las que sonner expone cuando se le pasa `richColors` (documentadas en
// node_modules/sonner/dist/styles.css, bloque [data-rich-colors="true"]):
// cada "--{tipo}-bg" es un tinte suave del color semántico sobre
// --popover (no un bloque sólido), "--{tipo}-border" un tinte más
// marcado, y "--{tipo}-text" el color semántico de theme.css tal cual --
// sonner colorea tanto el texto como el ícono con ese último valor
// (currentColor), así que ambos quedan legibles sobre el tinte y
// coherentes con el resto del sitio. --success/--destructive/--warning/
// --info ya existen en theme.css para exactamente este propósito.
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          // Sombra con tinte de marca (theme.css) en vez del gris plano
          // por defecto de sonner -- mismo shadow "premium" que ya usa el
          // resto del sitio para cards y popovers.
          toast: "shadow-[var(--shadow-md)] font-medium",
        },
      }}
      style={
        {
          "--border-radius": "var(--radius)",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",

          "--success-bg": "color-mix(in srgb, var(--success) 12%, var(--popover))",
          "--success-border": "color-mix(in srgb, var(--success) 35%, transparent)",
          "--success-text": "var(--success)",

          "--error-bg": "color-mix(in srgb, var(--destructive) 12%, var(--popover))",
          "--error-border": "color-mix(in srgb, var(--destructive) 35%, transparent)",
          "--error-text": "var(--destructive)",

          "--warning-bg": "color-mix(in srgb, var(--warning) 12%, var(--popover))",
          "--warning-border": "color-mix(in srgb, var(--warning) 35%, transparent)",
          "--warning-text": "var(--warning)",

          "--info-bg": "color-mix(in srgb, var(--info) 12%, var(--popover))",
          "--info-border": "color-mix(in srgb, var(--info) 35%, transparent)",
          "--info-text": "var(--info)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
