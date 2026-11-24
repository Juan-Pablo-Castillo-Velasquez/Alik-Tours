"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

// Avisos de Alik Tours: una sola pila, centrada arriba, con la misma
// tarjeta en todo el sitio. Cada tipo tiene su color semántico (theme.css)
// en el círculo del ícono y en la franja izquierda (estilos en
// styles/avisos.css, por data-type). El texto queda siempre en el color de
// lectura normal para que se lea bien sobre cualquier fondo.
const icono = (Icon: typeof Info, color: string) => (
  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${color}`} aria-hidden>
    <Icon className="h-[18px] w-[18px]" />
  </span>
);

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group alik-avisos"
      position="top-center"
      gap={10}
      offset={84}
      mobileOffset={{ top: 72, left: 12, right: 12 }}
      visibleToasts={4}
      closeButton
      containerAriaLabel="Avisos"
      icons={{
        success: icono(CircleCheck, "bg-success/15 text-success"),
        error: icono(CircleAlert, "bg-destructive/15 text-destructive"),
        warning: icono(TriangleAlert, "bg-warning/20 text-warning"),
        info: icono(Info, "bg-info/15 text-info"),
        loading: icono(LoaderCircle, "bg-primary/10 text-primary [&_svg]:animate-spin"),
        close: <X className="h-3.5 w-3.5" aria-label="Cerrar aviso" />,
      }}
      toastOptions={{
        classNames: {
          toast: "alik-aviso",
          title: "alik-aviso-titulo",
          description: "alik-aviso-descripcion",
          actionButton: "alik-aviso-accion",
          cancelButton: "alik-aviso-cancelar",
          closeButton: "alik-aviso-cerrar",
          icon: "alik-aviso-icono",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
