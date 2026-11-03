// Contraste de color WCAG 2.1 (nivel AA = 4.5:1 para texto normal; la
// Resolución MinTIC 1519 de 2020 exige este mismo nivel para sitios del
// Estado colombiano). Extraído de components/admin/ModuleTemas.tsx en la
// semana 2 del bootcamp para poder probar la regla sin montar el panel:
// es la misma fórmula de luminancia relativa con la que se verificaron
// los temas sembrados y las paletas de temaPaletas.ts.

export const AA_MINIMO = 4.5;

/** "#0e7c86" -> [14, 124, 134]; null si no es un hex de 6 dígitos. */
export function hexToRgbNums(hex: string): [number, number, number] | null {
  const limpio = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) return null;
  return [
    parseInt(limpio.substring(0, 2), 16),
    parseInt(limpio.substring(2, 4), 16),
    parseInt(limpio.substring(4, 6), 16),
  ];
}

export function luminanciaRelativa([r, g, b]: [number, number, number]): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razón de contraste entre dos colores (1 a 21); null si alguno no es válido. */
export function contraste(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgbNums(hex1);
  const rgb2 = hexToRgbNums(hex2);
  if (!rgb1 || !rgb2) return null;
  const l1 = luminanciaRelativa(rgb1);
  const l2 = luminanciaRelativa(rgb2);
  const [claro, oscuro] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (claro + 0.05) / (oscuro + 0.05);
}

export function cumpleAA(ratio: number): boolean {
  return ratio >= AA_MINIMO;
}
