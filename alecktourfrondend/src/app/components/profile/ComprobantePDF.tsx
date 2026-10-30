import jsPDF from "jspdf";
import { BRAND } from "../../config/brand";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { ClienteResponse } from "../../services/cliente.service";
import {
  PagoResponse,
  ReservaDetail,
  reservaService,
} from "../../services/reserva.service";

interface Props {
  reservaId: number;
  clienteData: ClienteResponse;
}

export default function ComprobantePDF({ reservaId, clienteData }: Props) {
  const [loading, setLoading] = useState(false);

  const generarPDF = async () => {
    setLoading(true);
    try {
      const [detalle, pagos] = await Promise.all([
        reservaService.getDetail(reservaId),
        reservaService.getPagos(reservaId).catch(() => [] as PagoResponse[]),
      ]);
      await descargarPDF(detalle, pagos ?? []);
    } catch (err) {
      console.error("Error generando PDF", err);
    } finally {
      setLoading(false);
    }
  };

  const descargarPDF = async (
    detalle: ReservaDetail,
    pagos: PagoResponse[] = [],
  ) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const W = 210;
    const margin = 20;
    let y = 0;

    // ── 1. HEADER CORPORATIVO (GRANATE IDENTITY) ───────────────────────────
    doc.setFillColor(123, 30, 58); // --primary Granate #7B1E3A
    doc.rect(0, 0, W, 40, "F");
    doc.setFillColor(201, 162, 39); // --chart-2 Dorado de Contraste #C9A227
    doc.rect(0, 37, W, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(BRAND.name, margin, 16);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(BRAND.slogan.toUpperCase(), margin, 21);
    doc.text(
      `Emisión: ${new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}`,
      margin,
      30,
    );

    // Caja contenedora del Número de Reserva (Sólido basado en variación del Granate)
    doc.setFillColor(161, 59, 85); // --chart-5 #A13B55
    doc.roundedRect(W - margin - 45, 10, 45, 18, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(
      `#${String(detalle.id_reserva).padStart(6, "0")}`,
      W - margin - 22.5,
      19,
      { align: "center" },
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("NÚMERO DE RESERVA", W - margin - 22.5, 24, { align: "center" });

    y = 54;

    // ── 2. SECCIONES Y FILAS ESTILIZADAS ─────────────────────────────────────
    const drawSection = (titulo: string, yPos: number): number => {
      // Borde suave basado en la opacidad de tu --border
      doc.setDrawColor(234, 219, 223); // Mezcla sutil de granate transparente sobre blanco
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, W - margin, yPos);

      doc.setTextColor(123, 30, 58); // Títulos en Granate Principal
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.text(titulo.toUpperCase(), margin, yPos + 6);
      return yPos + 12;
    };

    const drawRow = (
      label: string,
      value: string,
      yPos: number,
      col = 0,
    ): void => {
      const x = col === 0 ? margin : col === 1 ? W / 2 - 15 : W - margin - 45;
      doc.setTextColor(107, 107, 107); // --muted-foreground #6b6b6b
      doc.setFont("helvetica", "medium");
      doc.setFontSize(7.5);
      doc.text(label.toUpperCase(), x, yPos);

      doc.setTextColor(46, 46, 46); // oklch(0.18 0 0) aproximado a #2E2E2E
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(value || "—", x, yPos + 4.5);
    };

    // BADGE DINÁMICO DE ESTADOS (Mapeado exacto con variantes armónicas)
    const estadoColors: Record<
      string,
      { bg: [number, number, number]; tx: [number, number, number] }
    > = {
      confirmada: { bg: [240, 253, 244], tx: [21, 128, 61] }, // Verde Éxito
      pendiente: { bg: [241, 228, 232], tx: [123, 30, 58] }, // --accent #f1e4e8 y --primary #7B1E3A
      cancelada: { bg: [254, 242, 242], tx: [198, 40, 40] }, // --destructive #c62828
      finalizada: { bg: [243, 243, 245], tx: [107, 107, 107] }, // --muted y --muted-foreground
    };
    const color = estadoColors[detalle.estado] ?? estadoColors.pendiente;
    doc.setFillColor(color.bg[0], color.bg[1], color.bg[2]);
    doc.roundedRect(margin, y, 32, 6, 1, 1, "F");
    doc.setTextColor(color.tx[0], color.tx[1], color.tx[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(detalle.estado.toUpperCase(), margin + 16, y + 4.2, {
      align: "center",
    });

    y += 12;

    // INFORMACIÓN DEL CLIENTE
    y = drawSection("Información del Cliente", y);
    drawRow(
      "Titular de Reserva",
      `${clienteData.nombre} ${clienteData.apellido}`,
      y,
      0,
    );
    drawRow("Identificación (Cédula)", clienteData.cedula, y, 1);
    y += 11;
    drawRow("Email de contacto", clienteData.correo, y, 0);
    drawRow("Teléfono Celular", clienteData.celular || "—", y, 1);
    y += 15;

    // DETALLE DE LA RESERVA
    y = drawSection("Especificaciones del Itinerario", y);
    const fechaInicio = new Date(detalle.fecha_inicio).toLocaleDateString(
      "es-CO",
      { day: "2-digit", month: "short", year: "numeric" },
    );
    const fechaFin = new Date(detalle.fecha_fin).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const noches = Math.max(
      1,
      Math.ceil(
        (new Date(detalle.fecha_fin).getTime() -
          new Date(detalle.fecha_inicio).getTime()) /
          86400000,
      ),
    );
    const fechaReserva = new Date(detalle.fecha_reserva).toLocaleDateString(
      "es-CO",
      { day: "2-digit", month: "short", year: "numeric" },
    );

    drawRow("Fecha de Compra", fechaReserva, y, 0);
    drawRow("Cupos Reservados", `${detalle.numero_personas} Pasajeros`, y, 1);
    y += 11;
    drawRow("Check-In (Ingreso)", fechaInicio, y, 0);
    drawRow("Check-Out (Salida)", fechaFin, y, 1);
    drawRow("Duración", `${noches} Noches`, y, 2);
    y += 15;

    // DETALLE DEL ALOJAMIENTO / PAQUETE
    if (detalle.paquete) {
      y = drawSection("Servicios Incluidos y Alojamiento", y);
      const hotel = detalle.paquete.hotel;
      drawRow(
        "Plan / Paquete Contratado",
        detalle.paquete.nombre_paquete ||
          `Paquete Turístico #${detalle.id_paquete}`,
        y,
        0,
      );
      drawRow(
        "Tarifa base (Por Persona)",
        `$${detalle.paquete.precio_por_persona?.toLocaleString("es-CO")} COP`,
        y,
        1,
      );
      y += 11;
      if (hotel) {
        drawRow("Hotel Asignado", hotel.nombre_hotel, y, 0);
        drawRow("Destino / Ubicación", `${hotel.ciudad}, ${hotel.pais}`, y, 1);
        drawRow(
          "Categoría",
          `${"★".repeat(Math.min(5, hotel.calificacion || 0))} (${hotel.calificacion}/5)`,
          y,
          2,
        );
      }
      y += 16;
    }

    // ── 3. TABLA DE CONTROL DE PAGOS ────────────────────────────────────────
    if (pagos.length > 0) {
      y = drawSection("Transacciones y Estado Financiero", y);

      // Fondos de tabla basados en --input-background (#f7f5f6)
      doc.setFillColor(247, 245, 246);
      doc.rect(margin, y, W - margin * 2, 6, "F");
      doc.setTextColor(107, 107, 107); // --muted-foreground
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text("MÉTODO", margin + 3, y + 4.2);
      doc.text("FECHA", margin + 40, y + 4.2);
      doc.text("REFERENCIA", margin + 75, y + 4.2);
      doc.text("ESTADO", margin + 115, y + 4.2);
      doc.text("MONTO", W - margin - 3, y + 4.2, { align: "right" });

      y += 6;
      let totalPagado = 0;

      pagos.forEach((pago) => {
        const fechaPago = new Date(pago.fecha_pago).toLocaleDateString(
          "es-CO",
          { day: "2-digit", month: "short", year: "numeric" },
        );
        const stColor =
          pago.estado === "pagado" ? [21, 128, 61] : [123, 30, 58];

        doc.setDrawColor(243, 243, 245); // --muted
        doc.setLineWidth(0.2);
        doc.line(margin, y + 6, W - margin, y + 6);

        doc.setTextColor(46, 46, 46);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
          `${pago.metodo_pago?.nombre_metodo || "Transferencia"}`,
          margin + 3,
          y + 4,
        );
        doc.text(fechaPago, margin + 40, y + 4);
        doc.text(pago.referencia || "—", margin + 75, y + 4);

        doc.setTextColor(stColor[0], stColor[1], stColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text(pago.estado.toUpperCase(), margin + 115, y + 4);

        doc.setTextColor(46, 46, 46);
        doc.text(
          `$${pago.monto?.toLocaleString("es-CO")}`,
          W - margin - 3,
          y + 4,
          { align: "right" },
        );

        totalPagado += pago.monto || 0;
        y += 7;
      });

      // Liquidación final con fondo suave --input-background
      y += 4;
      doc.setFillColor(247, 245, 246);
      doc.roundedRect(W - margin - 60, y, 60, 14, 1.5, 1.5, "F");

      doc.setTextColor(107, 107, 107);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text("Total Liquidado:", W - margin - 56, y + 5);
      doc.text("Costo Total Plan:", W - margin - 56, y + 10);

      doc.setTextColor(123, 30, 58); // Resaltados en Granate
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(
        `$${totalPagado.toLocaleString("es-CO")} COP`,
        W - margin - 4,
        y + 5,
        { align: "right" },
      );
      doc.text(
        `$${Number(detalle.precio_total ?? 0).toLocaleString("es-CO")} COP`,
        W - margin - 4,
        y + 10,
        { align: "right" },
      );
    }

    // ── 4. NOTA LEGAL ───────────────────────────────────────────────────────
    // Antes había un QR "para validación automática en el counter o
    // aeropuerto" que no validaba nada y, además, enviaba la cédula del
    // cliente en la URL de un servicio externo (api.qrserver.com) para
    // dibujarlo. Se retira: este documento es un resumen informativo.
    doc.setTextColor(107, 107, 107);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      "Resumen informativo de tu reserva. No es una factura electrónica de venta ni reemplaza el comprobante de pago.",
      margin,
      244,
      { maxWidth: W - margin * 2 },
    );
    doc.text(`${BRAND.name} · RNT ${BRAND.rnt}`, margin, 249);

    // Barra de cierre en gris profundo elegante (evitando negro plano)
    doc.setFillColor(46, 46, 46); // #2E2E2E
    doc.rect(0, 272, W, 25, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(
      "¡Gracias por confiar en Alik Tours para descubrir el mundo!",
      W / 2,
      281,
      { align: "center" },
    );

    doc.setTextColor(200, 200, 200);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      `Atención: ${BRAND.telefono}  |  ${BRAND.siteUrl.replace("https://", "")}`,
      W / 2,
      286,
      { align: "center" },
    );

    doc.save(`Resumen_Reserva_${detalle.id_reserva}.pdf`);
  };

  return (
    <button
      onClick={generarPDF}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#7B1E3A] to-[#A13B55] text-white rounded-xl text-xs font-semibold hover:opacity-95 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Download className="w-3.5 h-3.5" />
      )}
      <span>
        {loading ? "Generando resumen..." : "Descargar resumen"}
      </span>
    </button>
  );
}
