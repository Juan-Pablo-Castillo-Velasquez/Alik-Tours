// Unidad: PDF de términos y condiciones (botón "Descargar" en /terms).
// Autor (semana 7, cierre: completar el frontend al 75%): Fernando Gutiérrez.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TERMINOS_SECCIONES, TERMINOS_VERSION } from "../content/terminos";

const pdf = vi.hoisted(() => {
  const estado = { textos: [] as string[], paginas: 1, guardado: "" };
  class DocFalso {
    text(t: string | string[]) {
      estado.textos.push(Array.isArray(t) ? t.join(" ") : t);
    }
    // Simula el corte de jsPDF: ~90 caracteres por línea.
    splitTextToSize(t: string) {
      return t.match(/.{1,90}(\s|$)/g) ?? [t];
    }
    addPage() {
      estado.paginas += 1;
    }
    save(nombre: string) {
      estado.guardado = nombre;
    }
    setFont() {}
    setFontSize() {}
    setTextColor() {}
  }
  return { estado, DocFalso };
});

vi.mock("jspdf", () => ({ jsPDF: pdf.DocFalso }));

import { descargarTerminosPdf } from "./descargarTerminosPdf";

describe("descargarTerminosPdf", () => {
  beforeEach(() => {
    pdf.estado.textos = [];
    pdf.estado.paginas = 1;
    pdf.estado.guardado = "";
  });

  it("encabeza con el nombre de la agencia, la versión y el RNT", () => {
    descargarTerminosPdf();

    expect(pdf.estado.textos[0]).toBe("Términos y condiciones — Alik Tours");
    expect(pdf.estado.textos[1]).toContain(`Versión ${TERMINOS_VERSION}`);
    expect(pdf.estado.textos[1]).toContain("RNT 224224");
  });

  it("incluye el título de cada sección, en orden", () => {
    descargarTerminosPdf();

    const titulos = pdf.estado.textos.filter((t) => TERMINOS_SECCIONES.some((s) => s.titulo === t));
    expect(titulos).toEqual(TERMINOS_SECCIONES.map((s) => s.titulo));
  });

  it("agrega páginas cuando el texto no cabe en una", () => {
    descargarTerminosPdf();

    expect(pdf.estado.paginas).toBeGreaterThan(1);
  });

  it("guarda el archivo con un nombre legible y la versión", () => {
    descargarTerminosPdf();

    expect(pdf.estado.guardado).toBe(`terminos-y-condiciones-alik-tours-${TERMINOS_VERSION}.pdf`);
  });
});
