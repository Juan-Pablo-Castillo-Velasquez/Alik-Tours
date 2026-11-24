import type { ElementType, ReactNode } from "react";
import ModalCentrado from "../../ui/ModalCentrado";

interface AdminModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Clase tailwind de ancho máximo, ej: "sm:max-w-2xl" */
  maxWidth?: string;
  icon?: ElementType;
}

// Modal del panel: es el ModalCentrado del sitio (encabezado, cuerpo con
// scroll y pie fijo), para que todos los formularios del panel se vean y
// se usen igual que los del resto de la página.
export default function AdminModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = "sm:max-w-lg",
  icon,
}: AdminModalProps) {
  return (
    <ModalCentrado
      abierto={open}
      onCambio={onOpenChange}
      titulo={title}
      descripcion={description}
      icono={icon}
      ancho={maxWidth}
      pie={footer}
    >
      {children}
    </ModalCentrado>
  );
}
