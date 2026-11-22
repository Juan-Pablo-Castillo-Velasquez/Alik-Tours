import { Calendar, CheckCircle, DollarSign, FileText, Headset, MapPin, UserRound, Users } from "lucide-react";
import { motion } from "motion/react";
import { Link, useLocation } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import AyudaReserva from "../components/reserva/AyudaReserva";

import { codigoReserva } from "../utils/reservaPresentacion";

export { codigoReserva };

const SIGUIENTES_PASOS = [
  { icono: UserRound, titulo: "Revisa tu reserva", texto: "Queda en tu perfil, en Mis reservas, con su estado y sus pagos." },
  { icono: FileText, titulo: "Guarda tu comprobante", texto: "Desde Mis reservas descargas el comprobante de cada pago." },
  { icono: Headset, titulo: "Te acompañamos", texto: "Un asesor confirma los detalles contigo antes del viaje." },
];

export default function Confirmation() {
  const location = useLocation();
  const { reserva, hotel, people, totalPrice, paymentAmount, paymentOption, referencia } =
    location.state || {};
  if (!reserva || !hotel) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-200">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-medium text-foreground">No se encontró información de la reserva</h1>
          <Link to="/" className="inline-block mt-6 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:opacity-90 transition-all shadow-xs">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">

        {/* Éxito - Estado de la Transacción */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-green-500/10 rounded-full border border-green-500/20 mb-4"
          >
            <CheckCircle className="w-8 h-8 text-green-500" />
          </motion.div>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">¡Reserva confirmada!</h1>
          <p className="text-muted-foreground text-sm mt-1">Tu viaje ha sido procesado y agendado exitosamente.</p>
        </div>

        {/* Tarjeta de Código de Reserva Principal */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-primary text-primary-foreground rounded-2xl p-6 md:p-8 mb-6 text-center shadow-md relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite]" />
          <span className="text-xs font-bold uppercase tracking-widest opacity-80 block mb-2">Código de tu reserva</span>
          <p className="text-3xl md:text-4xl font-extrabold tracking-wider">{codigoReserva(reserva.id_reserva)}</p>
          <div className="mt-4 pt-4 border-t border-primary-foreground/10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs opacity-90">
            <span>Referencia de pago: <span className="font-mono font-medium">{referencia}</span></span>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">

          {/* Detalles del viaje */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card rounded-xl border border-border p-6 shadow-xs md:col-span-3 space-y-5"
          >
            <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3">Detalles de la estadía</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-1" />
                <div>
                  <p className="font-bold text-sm md:text-base text-foreground leading-tight">{hotel.nombre_hotel}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{hotel.ciudad}, {hotel.pais}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {people} {people === 1 ? 'Viajero inscrito' : 'Viajeros inscritos'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  {new Date(reserva.fecha_inicio).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                  <span className="text-muted-foreground mx-1">→</span>
                  {new Date(reserva.fecha_fin).toLocaleDateString('es-CO', { dateStyle: 'medium' })}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-primary shrink-0" />
                <span className="text-sm font-medium text-foreground">
                  ID Reserva: <span className="font-mono text-muted-foreground">#{reserva.id_reserva}</span>
                  <span className="mx-1.5 text-border">·</span>
                  Estado: <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-500 border border-green-500/20 capitalize">{reserva.estado}</span>
                </span>
              </div>
            </div>
          </motion.div>

          {/* Desglose Financiero */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-xs md:col-span-2 space-y-4"
          >
            <h2 className="text-lg font-semibold text-foreground border-b border-border pb-3">Resumen financiero</h2>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Monto total</span>
                <span className="font-medium text-foreground">${totalPrice.toLocaleString('es-CO')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Abonado hoy</span>
                <span className="font-bold text-green-500">${paymentAmount.toLocaleString('es-CO')}</span>
              </div>

              {paymentOption === 'partial' && (
                <>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-border mt-2">
                    <span className="text-muted-foreground">Saldo pendiente</span>
                    <span className="font-bold text-chart-2">${(totalPrice - paymentAmount).toLocaleString('es-CO')}</span>
                  </div>
                  <div className="mt-4 p-3 bg-chart-2/5 rounded-xl border border-chart-2/10">
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      <strong className="text-chart-2 font-semibold">Importante:</strong> El importe restante debe liquidarse de manera obligatoria en tu módulo de cliente hasta 15 días previos a la llegada.
                    </p>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold">¿Qué sigue?</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {SIGUIENTES_PASOS.map(({ icono: Icono, titulo, texto }, i) => (
              <motion.li
                key={titulo}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                className="rounded-xl bg-muted/40 p-4"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icono className="h-4 w-4" />
                </span>
                <p className="mt-2 text-sm font-semibold">{titulo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{texto}</p>
              </motion.li>
            ))}
          </ol>
        </section>

        <div className="mt-6">
          <AyudaReserva producto={hotel.nombre_hotel} />
        </div>

        {/* Botones de acción final */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <Link to="/profile"
            className="flex-1 py-3 px-4 bg-card hover:bg-muted border border-border text-foreground text-center text-sm font-semibold rounded-xl transition-all shadow-xs">
            Ver mis reservas
          </Link>
          <Link to="/"
            className="flex-1 py-3 px-4 bg-primary text-primary-foreground text-center text-sm font-semibold rounded-xl hover:opacity-95 transition-all shadow-sm">
            Volver al inicio
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  );
}