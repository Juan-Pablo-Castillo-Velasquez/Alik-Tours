// Fotos reales por ciudad, usadas como respaldo cuando un hotel o paquete
// todavía no tiene su propia foto (Hotel.imagen_url) -- nunca inventamos
// una imagen que "parezca" pertenecer a un hotel o paquete puntual, solo
// una foto genérica del destino real.
//
// Antes cada componente (HotelCard, HotelDetail, PackageDetail,
// PackageResultCard) tenía su propia copia de este mismo mapa. Cuando se
// encontró que varios IDs de foto estaban mal (una fotografía de un torno
// de carpintería para Cartagena, entre otras -- ver
// backend/alembic/versions/7972baf77f44_corregir_fotos_hoteles_demo.py),
// hubo que corregir la misma lista 4 veces por separado. Esto centraliza
// el mapa en un solo lugar para que ese bug de sincronización no pueda
// volver a pasar -- cada componente solo pide getCityImage(ciudad, opts)
// con el ancho/calidad que necesite.
const CITY_IMAGE_IDS: Record<string, string> = {
  cartagena: "1658591049748-4937f0a9051a",
  "santa marta": "1788184851263-f832bf6c76f3",
  medellín: "1570793005386-840846445fed",
  medellin: "1570793005386-840846445fed",
  bogotá: "1605723517503-3cadb5818a0c",
  bogota: "1605723517503-3cadb5818a0c",
  cali: "1758165532022-a68f291317ba",
  salento: "1749063240369-391a2e82dc04",
  "villa de leyva": "1788203816802-5fa9a5086f27",
  barranquilla: "1564399331650-bbfe2aac0a04",
  "san andrés": "1544551763-46a013bb70d5",
  "san andres": "1544551763-46a013bb70d5",
};

const DEFAULT_IMAGE_ID = "1566073771259-6a8506099945";

interface OpcionesImagen {
  width?: number;
  quality?: number;
}

function construirUrl(id: string, { width = 1200, quality = 80 }: OpcionesImagen = {}): string {
  return `https://images.unsplash.com/photo-${id}?w=${width}&q=${quality}&auto=format`;
}

export function getCityImage(ciudad?: string | null, opts?: OpcionesImagen): string {
  const id = (ciudad && CITY_IMAGE_IDS[ciudad.toLowerCase().trim()]) || DEFAULT_IMAGE_ID;
  return construirUrl(id, opts);
}

export function getDefaultImage(opts?: OpcionesImagen): string {
  return construirUrl(DEFAULT_IMAGE_ID, opts);
}
