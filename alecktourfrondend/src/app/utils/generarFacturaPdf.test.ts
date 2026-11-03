// Unidad: comprobante de pago en PDF (perfil del cliente > Facturas).
// Autor (semana 2, capa Front): Juan Pablo Castillo.
//
// jsPDF se reemplaza por un doble que solo anota los textos y el nombre
// del archivo: lo que se prueba es QUÉ dice el comprobante, no cómo dibuja
// jsPDF (la librería ya tiene sus propios tests).
import { beforeEach, describe, expect, it, vi } from "vitest";

const pdf = vi.hoisted(() => {
  const textos: string[] = [];
  const guardados: string[] = [];
  class DocFalso {
    text(t: string | string[]) {
      textos.push(Array.isArray(t) ? t.join(" ") : t);
    }
    save(nombre: string) {
      guardados.push(nombre);
    }
    setFont() {}
    setFontSize() {}
    setTextColor() {}
    setDrawColor() {}
    setLineWidth() {}
    setFillColor() {}
    line() {}
    rect() {}
  }
  return { textos, guardados, DocFalso };
});

vi.mock("jspdf", () => ({ jsPDF: pdf.DocFalso }));

import { generarFacturaPdf } from "./generarFacturaPdf";

const pagoBase = {
  id_pago: 45,
  id_reserva: 7,
  monto: 1250000,
  estado: "pagado",
  referencia: "REF-123",
  fecha_pago: "2026-11-02T15:30:00-05:00",
  numero_factura: "FAC-000045",
  metodo_pago: { nombre_metodo: "Tarjeta de crédito" },
};

describe("generarFacturaPdf", () => {
  beforeEach(() => {
    pdf.textos.length = 0;
    pdf.guardados.length = 0;
  });

  it("muestra el total en pesos colombianos y guarda el archivo con el número de comprobante", () => {
    // Act
    generarFacturaPdf(pagoBase);
    // Assert
    expect(pdf.textos).toContain("$1.250.000 COP");
    expect(pdf.textos).toContain("FAC-000045");
    expect(pdf.guardados).toEqual(["comprobante-pago-FAC-000045.pdf"]);
  });

  it("sin número de comprobante usa el id del pago en el título y en el archivo", () => {
    generarFacturaPdf({ ...pagoBase, numero_factura: null });

    expect(pdf.textos).toContain("#45");
    expect(pdf.guardados).toEqual(["comprobante-pago-45.pdf"]);
  });

  it("factura a nombre del cliente, con ciudad y país solo si existen", () => {
    const cliente = { nombre: "Ana", apellido: "Pérez", cedula: "1020304050", correo: "ana@correo.com" };

    generarFacturaPdf(pagoBase, undefined, { ...cliente, ciudad: "Medellín", pais: "Colombia" });
    expect(pdf.textos).toEqual(expect.arrayContaining(["Ana Pérez", "Documento: 1020304050", "Medellín, Colombia"]));

    pdf.textos.length = 0;
    generarFacturaPdf(pagoBase, undefined, { ...cliente, ciudad: null, pais: "Colombia" });
    expect(pdf.textos).toContain("Colombia");
  });

  it("sin cliente ni reserva, el concepto es el número de reserva", () => {
    generarFacturaPdf({ ...pagoBase, metodo_pago: null, referencia: null });

    expect(pdf.textos.filter((t) => t === "Reserva #7")).toHaveLength(2); // facturado a + concepto
    expect(pdf.textos).toContain("—"); // método de pago desconocido
    expect(pdf.textos).toContain("Referencia: —  ·  Estado: pagado");
  });

  it("las fechas del viaje salen en el día correcto en Colombia (no el día anterior)", () => {
    // Arrange: fechas sin hora, tal como llegan de la reserva
    const reserva = { hotel_nombre: "Hotel Caribe", fecha_inicio: "2026-12-01", fecha_fin: "2026-12-05" };
    // Act
    generarFacturaPdf(pagoBase, reserva);
    // Assert
    expect(pdf.textos).toContain("Hotel Caribe (01 de diciembre de 2026 - 05 de diciembre de 2026)");
  });

  it("una fecha inválida o vacía se muestra como guion", () => {
    generarFacturaPdf({ ...pagoBase, fecha_pago: "no-es-fecha" }, { destino: "Cartagena" });

    expect(pdf.textos).toContain("Fecha de pago: —");
    expect(pdf.textos).toContain("Cartagena (— - —)");
  });
});
