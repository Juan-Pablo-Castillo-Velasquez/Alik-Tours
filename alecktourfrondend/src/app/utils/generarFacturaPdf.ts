import { jsPDF } from "jspdf";

// Antes importaba Pago/Reserva/Cliente de admin/types.ts -- funcionaba
// mientras el único llamador era ModulePagos.tsx (admin), pero esos tipos
// tienen "estado" como union literal y otros campos que el lado cliente no
// declara igual (ver TabFacturas.tsx, que ahora también llama a esta
// función con PagoResponse/ReservaResponse/ClienteResponse del cliente).
// Estas interfaces locales son el subconjunto real de campos que la
// función lee -- tanto los tipos de admin como los del cliente los
// cumplen de sobra, así que ninguno de los dos lados necesita castear.
interface FacturaPago {
  id_pago: number;
  id_reserva: number;
  monto: number;
  estado: string;
  referencia?: string | null;
  fecha_pago?: string | null;
  numero_factura?: string | null;
  metodo_pago?: { nombre_metodo: string } | null;
}

interface FacturaReserva {
  hotel_nombre?: string | null;
  destino?: string | null;
  fecha_inicio?: string;
  fecha_fin?: string;
}

interface FacturaCliente {
  nombre: string;
  apellido: string;
  cedula: string;
  correo: string;
  ciudad?: string | null;
  pais?: string | null;
}

// Acento real de la marca en el panel admin (StatCard, badges) — se
// reutiliza acá para que la factura se vea consistente con el resto del
// panel en vez de inventar una paleta nueva solo para el PDF.
const GOLD: [number, number, number] = [201, 162, 39];
const INK: [number, number, number] = [30, 30, 30];
const MUTED: [number, number, number] = [120, 120, 120];

function formatFecha(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

// Genera la factura en el navegador con jsPDF (ya instalado en el proyecto,
// sin agregar ninguna dependencia nueva de PDF en el backend) a partir de
// datos que ya están cargados en el panel admin — nunca inventa un NIT, un
// porcentaje de impuesto ni ningún otro dato que la plataforma no calcule
// de verdad. numero_factura viene del backend (ver Pago.numero_factura);
// si el pago todavía no está 'pagado' no debería llamarse esta función
// (el botón que la dispara solo aparece cuando numero_factura existe).
export function generarFacturaPdf(pago: FacturaPago, reserva?: FacturaReserva, cliente?: FacturaCliente): void {
  const doc = new jsPDF();
  const marginX = 20;
  let y = 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...GOLD);
  doc.text("Alik tours", marginX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  y += 7;
  doc.text("Agencia de Viajes y Turismo · www.Alik-tours.com", marginX, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(`Factura ${pago.numero_factura ?? `#${pago.id_pago}`}`, 190, 22, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`Fecha de pago: ${formatFecha(pago.fecha_pago)}`, 190, 29, { align: "right" });

  y += 12;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, 190, y);
  y += 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text("Facturado a", marginX, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  if (cliente) {
    doc.text(`${cliente.nombre} ${cliente.apellido}`, marginX, y); y += 5;
    doc.text(`Documento: ${cliente.cedula}`, marginX, y); y += 5;
    doc.text(cliente.correo, marginX, y); y += 5;
    const lugar = [cliente.ciudad, cliente.pais].filter(Boolean).join(", ");
    if (lugar) { doc.text(lugar, marginX, y); y += 5; }
  } else {
    doc.text(`Reserva #${pago.id_reserva}`, marginX, y); y += 5;
  }

  y += 8;

  doc.setFillColor(245, 245, 245);
  doc.rect(marginX, y, 170, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text("Concepto", marginX + 3, y + 6);
  doc.text("Método de pago", marginX + 95, y + 6);
  doc.text("Monto", 187, y + 6, { align: "right" });
  y += 9;

  const concepto = reserva
    ? `${reserva.hotel_nombre ?? reserva.destino ?? "Reserva"} (${formatFecha(reserva.fecha_inicio)} - ${formatFecha(reserva.fecha_fin)})`
    : `Reserva #${pago.id_reserva}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(concepto, marginX + 3, y + 7, { maxWidth: 88 });
  doc.text(pago.metodo_pago?.nombre_metodo ?? "—", marginX + 95, y + 7);
  doc.setFont("helvetica", "bold");
  doc.text(`$${pago.monto.toLocaleString("es-CO")}`, 187, y + 7, { align: "right" });
  y += 18;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(marginX, y, 190, y);
  y += 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...INK);
  doc.text("Total pagado", marginX + 95, y);
  doc.setTextColor(...GOLD);
  doc.text(`$${pago.monto.toLocaleString("es-CO")} COP`, 187, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Referencia: ${pago.referencia ?? "—"}  ·  Estado: ${pago.estado}`, marginX + 95, y + 5);

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(
    "Documento generado automáticamente a partir del registro de pago en AlecTours; sirve como constancia de la transacción.",
    marginX, 280, { maxWidth: 170 },
  );

  doc.save(`${pago.numero_factura ?? `factura-pago-${pago.id_pago}`}.pdf`);
}
