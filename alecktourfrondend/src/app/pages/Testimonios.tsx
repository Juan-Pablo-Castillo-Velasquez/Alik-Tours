import {
  AlertCircle,
  CheckCircle2,
  LogIn,
  MapPin,
  MessageSquarePlus,
  Quote,
  ShieldCheck,
  Star,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { apiCrearResena, apiGetResenas, ResenaDestacada } from "../api/v1/api";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { ReservaResponse } from "../data/reservaTypes";
import { reservaService } from "../services/services";

const PAGE_SIZE = 9;

export default function Testimonios() {
  const { usuario, isAuthenticated } = useAuth();

  const [resenas, setResenas] = useState<ResenaDestacada[]>([]);
  const [total, setTotal] = useState(0);
  const [promedio, setPromedio] = useState(5);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Formulario "agregar reseña"
  const [misReservas, setMisReservas] = useState<ReservaResponse[]>([]);
  const [idReserva, setIdReserva] = useState<string>("");
  const [calificacion, setCalificacion] = useState(5);
  const [hoverStar, setHoverStar] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{
    tipo: "ok" | "error";
    texto: string;
  } | null>(null);

  useEffect(() => {
    cargarResenas(0);
  }, []);

  useEffect(() => {
    if (isAuthenticated && usuario?.id_cliente) {
      reservaService
        .getByCliente(usuario.id_cliente)
        .then(setMisReservas)
        .catch(() => setMisReservas([]));
    }
  }, [isAuthenticated, usuario?.id_cliente]);

  async function cargarResenas(skip: number) {
    skip === 0 ? setLoading(true) : setLoadingMore(true);
    try {
      const data = await apiGetResenas(skip, PAGE_SIZE);
      setTotal(data.total);
      setPromedio(data.promedio);
      setResenas((prev) =>
        skip === 0 ? data.resenas : [...prev, ...data.resenas],
      );
    } catch (err) {
      console.error("No se pudieron cargar las reseñas:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idReserva) {
      setMensaje({
        tipo: "error",
        texto: "Elige la reserva que quieres reseñar.",
      });
      return;
    }
    if (comentario.trim().length < 10) {
      setMensaje({
        tipo: "error",
        texto: "Cuéntanos un poco más (mínimo 10 caracteres).",
      });
      return;
    }

    setEnviando(true);
    setMensaje(null);
    try {
      await apiCrearResena({
        id_reserva: Number(idReserva),
        calificacion,
        comentario: comentario.trim(),
      });
      setMensaje({
        tipo: "ok",
        texto: "¡Gracias por tu reseña! Ya quedó publicada.",
      });
      setComentario("");
      setIdReserva("");
      setCalificacion(5);
      cargarResenas(0); // refrescar el listado con la nueva reseña arriba
    } catch (err: any) {
      setMensaje({
        tipo: "error",
        texto:
          err?.message || "No pudimos guardar tu reseña, intenta de nuevo.",
      });
    } finally {
      setEnviando(false);
    }
  }

  const hayMas = resenas.length < total;

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />

      {/* HERO */}
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/10 dark:bg-primary/20 blur-3xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="h-px w-9 bg-[#C9A227]" />
            <span className="text-primary text-[11px] font-bold uppercase tracking-[0.22em]">
              Opiniones de viajeros
            </span>
            <span className="h-px w-9 bg-[#C9A227]" />
          </div>

          <h1
            className="text-3xl md:text-4xl lg:text-5xl leading-tight text-foreground mb-4"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}
          >
            Todas las experiencias
            <span className="text-primary"> con Alik Tours</span>
          </h1>

          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className="w-4 h-4 fill-[#C9A227] text-[#C9A227]"
                />
              ))}
            </div>
            <p className="text-foreground font-bold text-sm">
              {promedio.toFixed(1)} / 5.0
            </p>
            <span className="text-muted-foreground text-sm">
              · {total} {total === 1 ? "reseña" : "reseñas"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* LISTADO */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-52 rounded-3xl bg-card border border-border animate-pulse"
                />
              ))}
            </div>
          ) : resenas.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
              Todavía no hay reseñas publicadas. ¡Sé el primero en dejar la
              tuya!
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {resenas.map((r, i) => (
                  <motion.article
                    key={r.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{
                      delay: (i % PAGE_SIZE) * 0.05,
                      duration: 0.4,
                    }}
                    className="relative bg-card rounded-3xl p-6 border border-border shadow-lg shadow-primary/5 dark:shadow-none"
                  >
                    <Quote className="absolute top-5 right-5 w-10 h-10 text-primary opacity-10 dark:opacity-20" />

                    <div className="flex items-center gap-1 mb-4">
                      {Array.from({ length: r.rating }, (_, idx) => (
                        <Star
                          key={idx}
                          className="w-4 h-4 fill-[#C9A227] text-[#C9A227]"
                        />
                      ))}
                    </div>

                    <p className="relative text-foreground/90 text-[14px] leading-[1.75] mb-5">
                      “{r.quote}”
                    </p>

                    <div className="h-px bg-border mb-4" />

                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full bg-cover bg-center ring-2 ring-background shrink-0"
                        style={{ backgroundImage: `url(${r.avatar})` }}
                      />
                      <div className="min-w-0">
                        <p className="text-foreground text-sm font-bold">
                          {r.name}
                        </p>
                        <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                          <MapPin className="w-3 h-3" />
                          {r.location || "Colombia"}
                        </div>
                      </div>
                    </div>
                  </motion.article>
                ))}
              </div>

              {hayMas && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => cargarResenas(resenas.length)}
                    disabled={loadingMore}
                    className="px-6 py-3 rounded-xl border border-border bg-card text-sm font-bold text-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? "Cargando..." : "Cargar más reseñas"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* FORMULARIO / CTA */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-3xl border border-border bg-card p-6 shadow-lg shadow-primary/5 dark:shadow-none">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <MessageSquarePlus className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-foreground font-bold text-lg">
                Deja tu reseña
              </h2>
            </div>

            {!isAuthenticated ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm mb-4">
                  Inicia sesión para reseñar un viaje que ya realizaste con
                  nosotros.
                </p>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Iniciar sesión
                </Link>
              </div>
            ) : misReservas.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No encontramos reservas asociadas a tu cuenta todavía. Cuando
                completes un viaje con nosotros, podrás reseñarlo aquí.
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    ¿Qué reserva quieres reseñar?
                  </label>
                  <select
                    value={idReserva}
                    onChange={(e) => setIdReserva(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Selecciona una reserva</option>
                    {misReservas.map((r) => (
                      <option key={r.id_reserva} value={r.id_reserva}>
                        Reserva #{r.id_reserva} · {r.fecha_inicio} ({r.estado})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Calificación
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setCalificacion(s)}
                        onMouseEnter={() => setHoverStar(s)}
                        onMouseLeave={() => setHoverStar(0)}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-6 h-6 transition-colors ${
                            s <= (hoverStar || calificacion)
                              ? "fill-[#C9A227] text-[#C9A227]"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Tu comentario
                  </label>
                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="Cuéntanos cómo estuvo tu experiencia..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>

                {mensaje && (
                  <div
                    className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${
                      mensaje.tipo === "ok"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-red-500/10 text-red-600 dark:text-red-400"
                    }`}
                  >
                    {mensaje.tipo === "ok" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    {mensaje.texto}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  {enviando ? "Publicando..." : "Publicar reseña"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
