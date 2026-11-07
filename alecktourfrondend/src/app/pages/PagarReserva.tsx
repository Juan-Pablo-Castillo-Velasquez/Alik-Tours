import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast, Toaster } from "sonner";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import PagoDeReserva from "../components/payment/PagoDeReserva";
import ResumenCotizacion, { pesos } from "../components/reserva/ResumenCotizacion";
import { useAuth } from "../context/AuthContext";
import { clienteService } from "../services/cliente.service";
import { ReservaDetail, reservaService } from "../services/reserva.service";

/** Pagar una reserva ya creada (paquete, anticipo, saldo pendiente). */
export default function PagarReserva() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [reserva, setReserva] = useState<ReservaDetail | null>(null);
  const [celular, setCelular] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    reservaService
      .getDetail(Number(id))
      .then(setReserva)
      .catch(() => {
        toast.error("No encontramos esa reserva.");
        navigate("/profile");
      });
    if (usuario?.id_cliente) clienteService.getById(usuario.id_cliente).then((c) => setCelular(c.celular ?? null)).catch(() => {});
  }, [id, navigate, usuario?.id_cliente]);

  if (!reserva) {
    return (
      <div className="min-h-screen bg-background"><Navbar />
        <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  const titulo = reserva.nombre_paquete || reserva.hotel_nombre || `Reserva #${reserva.id_reserva}`;
  const pagable = reserva.estado === "pendiente" || reserva.estado === "confirmada";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <Toaster position="top-center" richColors />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link to="/profile" state={{ tab: "reservas" }} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Mis reservas
        </Link>
        <h1 className="mb-1 text-2xl font-bold">Pagar reserva #{reserva.id_reserva}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{titulo} · {reserva.fecha_inicio} → {reserva.fecha_fin}</p>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-2xl border border-border bg-card p-5">
            {pagable ? (
              <PagoDeReserva
                idReserva={reserva.id_reserva}
                total={Number(reserva.precio_total ?? 0)}
                totalPagado={Number(reserva.total_pagado ?? 0)}
                celularCliente={celular}
                onPagado={() => reservaService.getDetail(reserva.id_reserva).then(setReserva).catch(() => {})}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Esta reserva está {reserva.estado}: no admite pagos.</p>
            )}
          </section>
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {reserva.conceptos && reserva.conceptos.length > 0 ? (
              <ResumenCotizacion
                titulo="Detalle de tu reserva"
                cotizacion={{
                  tipo_producto: (reserva.tipo_producto ?? "hotel") as "hotel",
                  fecha_inicio: reserva.fecha_inicio,
                  fecha_fin: reserva.fecha_fin,
                  noches: 0,
                  adultos: reserva.adultos ?? reserva.numero_personas,
                  ninos: reserva.ninos ?? 0,
                  infantes: reserva.infantes ?? 0,
                  conceptos: reserva.conceptos,
                  total: Number(reserva.precio_total ?? 0),
                  advertencias: reserva.estado_vuelo === "cotizacion_pendiente" ? ["El vuelo está pendiente de cotización: se sumará cuando la agencia te lo confirme."] : [],
                }}
              />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-4 text-sm">
                Total de la reserva: <b>{pesos(Number(reserva.precio_total ?? 0))}</b>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Pagado: {pesos(Number(reserva.total_pagado ?? 0))} · Saldo: <b>{pesos(Number(reserva.saldo_pendiente ?? 0))}</b>
            </p>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}
