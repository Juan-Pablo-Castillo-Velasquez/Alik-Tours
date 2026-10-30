import { BRAND } from "../config/brand";

interface Props {
  /** Lado en píxeles (el logo es circular). */
  size?: number;
  className?: string;
}

// Logo oficial de Alik Tours. Siempre se acompaña del nombre en texto
// (Navbar, Footer, AdminHeader) para no depender solo de la imagen.
export default function BrandLogo({ size = 44, className = "" }: Props) {
  return (
    <img
      src={BRAND.logo}
      alt={`Logo de ${BRAND.name}`}
      width={size}
      height={size}
      decoding="async"
      className={`shrink-0 rounded-full object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
