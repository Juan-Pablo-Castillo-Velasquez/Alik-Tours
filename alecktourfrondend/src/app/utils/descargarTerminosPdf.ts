import { jsPDF } from "jspdf";
import { BRAND } from "../config/brand";
import { TERMINOS_ES_BORRADOR, TERMINOS_FECHA, TERMINOS_SECCIONES, TERMINOS_VERSION } from "../content/terminos";

/** Descarga los términos vigentes en PDF (mismo texto que /terms). */
export function descargarTerminosPdf(): void {
  const doc = new jsPDF();
  const margen = 18;
  const ancho = 210 - margen * 2;
  let y = 20;

  const asegurarEspacio = (alto: number) => {
    if (y + alto > 280) {
      doc.addPage();
      y = 20;
    }
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Términos y condiciones — ${BRAND.name}`, margen, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Versión ${TERMINOS_VERSION} · ${TERMINOS_FECHA} · RNT ${BRAND.rnt}`, margen, y);
  y += 5;
  if (TERMINOS_ES_BORRADOR) {
    doc.setTextColor(160, 60, 60);
    doc.text("BORRADOR pendiente de revisión jurídica.", margen, y);
    doc.setTextColor(0, 0, 0);
    y += 5;
  }
  y += 3;

  for (const s of TERMINOS_SECCIONES) {
    asegurarEspacio(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(s.titulo, margen, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    for (const p of s.parrafos) {
      const lineas = doc.splitTextToSize(p, ancho) as string[];
      asegurarEspacio(lineas.length * 4.6 + 2);
      doc.text(lineas, margen, y);
      y += lineas.length * 4.6 + 2;
    }
    y += 2;
  }

  doc.save(`terminos-y-condiciones-${BRAND.name.toLowerCase().replace(/\s+/g, "-")}-${TERMINOS_VERSION}.pdf`);
}
