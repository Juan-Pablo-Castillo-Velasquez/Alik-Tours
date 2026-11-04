import {
  AlertCircle,
  CheckCircle2,
  LogIn,
  MapPin,
  MessageSquarePlus,
  Pencil,
  Quote,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { apiCrearResena, apiGetResenas, ResenaDestacada } from "../api/v1/api";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import RespuestaAgencia from "../components/resenas/RespuestaAgencia";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import { ReservaResponse } from "../data/reservaTypes";
import { resenaService, ResenaResponse } from "../services/resena.service";
import { reservaService } from "../services/services";

const PAGE_SIZE = 9;

// Solo se reseña un viaje que ya pasó o está confirmado (no uno cancelado o
// sin confirmar).
const ESTADOS_RESENABLES = new Set(["confirmada", "finalizada"]);

export default function Testimonios() {
  const { usuario, isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();

  const [resenas, setResenas] = useState<ResenaDestacada[]>([]);
  const [total, setTotal] = useState(0);
  const [totalGlobal, setTotalGlobal] = useState(0);
  const [distribucion, setDistribucion] = useState<Record<string, number>>({});
  const [filtroEstrellas, setFiltroEstrellas] = useState<number | null>(null);
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

  // Mis reseñas (para editarlas/borrarlas y no ofrecer reseñar dos veces la misma reserva)
  const [misResenas, setMisResenas] = useState<ResenaResponse[]>([]);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [edicion, setEdicion] = useState({ calificacion: 5, comentario: "" });

  const cargarResenas = useCallback(
    async (skip: number) => {
      if (skip === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const data = await apiGetResenas(skip, PAGE_SIZE, filtroEstrellas ?? undefined);
        setTotal(data.total);
        setTotalGlobal(data.total_global ?? data.total);
        setDistribucion(data.distribucion ?? {});
        setPromedio(data.promedio);
        setResenas((prev) => (skip === 0 ? data.resenas : [...prev, ...data.resenas]));
      } catch (err) {
        console.error("No se pudieron cargar las reseñas:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filtroEstrellas],
  );

  useEffect(() => {
    cargarResenas(0);
  }, [cargarResenas]);

  const cargarMisResenas = useCallback(() => {
    if (!isAuthenticated || !usuario?.id_cliente) {
      setMisResenas([]);
      return;
    }
    resenaService
      .mias()
      .then(setMisResenas)
      .catch(() => setMisResenas([]));
  }, [isAuthenticated, usuario?.id_cliente]);

  useEffect(() => {
    cargarMisResenas();
  }, [cargarMisResenas]);

  useEffect(() => {
    if (isAuthenticated && usuario?.id_cliente) {
      reservaService
        .getByCliente(usuario.id_cliente)
        .then(setMisReservas)
        .catch(() => setMisReservas([]));
    }
  }, [isAuthenticated, usuario?.id_cliente]);

  // Reservas que todavía se pueden reseñar: confirmadas o finalizadas y sin
  // reseña. Antes salían todas (canceladas incluidas) y elegir una ya
  // reseñada terminaba en "Ya dejaste una reseña para esta reserva".
  const yaResenadas = new Set(misResenas.map((r) => r.id_reserva));
  const reservasResenables = misReservas.filter(
    (r) => ESTADOS_RESENABLES.has(String(r.estado)) && !yaResenadas.has(r.id_reserva),
  );

  const guardarEdicion = async (r: ResenaResponse) => {
    if (edicion.comentario.trim().length < 10) {
      toast.error("Cuéntanos un poco más (mínimo 10 caracteres).");
      return;
    }
    try {
      await resenaService.editar(r.id_resena, {
        calificacion: edicion.calificacion,
        comentario: edicion.comentario.trim(),
      });
      toast.success("Reseña actualizada");
      setEditandoId(null);
      cargarMisResenas();
      cargarResenas(0);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar la reseña");
    }
  };

  const borrarMiResena = async (r: ResenaResponse) => {
    if (!window.confirm("¿Borrar tu reseña? Podrás escribir una nueva para esa reserva.")) return;
    try {
      await resenaService.borrar(r.id_resena);
      toast.success("Reseña eliminada");
      cargarMisResenas();
      cargarResenas(0);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo borrar la reseña");
    }
  };

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
      cargarMisResenas();
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
              · {totalGlobal} {totalGlobal === 1 ? "reseña" : "reseñas"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* LISTADO */}
        <div className="lg:col-span-2">
          {/* Resumen por estrellas: cada barra filtra el listado */}
          {totalGlobal > 0 && (
            <div className="mb-8 rounded-3xl border border-border bg-card p-5">
              <p className="text-sm font-semibold text-foreground mb-3">Filtra por calificación</p>
              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((n) => {
                  const cantidad = distribucion[String(n)] ?? 0;
                  const pct = totalGlobal ? Math.round((cantidad / totalGlobal) * 100) : 0;
                  const activo = filtroEstrellas === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setFiltroEstrellas(activo ? null : n)}
                      disabled={cantidad === 0}
                      aria-pressed={activo}
                      className={`w-full flex items-center gap-3 rounded-lg px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
                        activo ? "bg-primary/10" : "hover:bg-muted"
                      }`}
                    >
                      <span className="w-14 shrink-0 flex items-center gap-1 font-semibold text-foreground">
                        {n} <Star className="w-3.5 h-3.5 fill-gold text-gold" />
                      </span>
                      <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <span className="block h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-10 shrink-0 text-right text-muted-foreground">{cantidad}</span>
                    </button>
                  );
                })}
              </div>
              {filtroEstrellas && (
                <button
                  onClick={() => setFiltroEstrellas(null)}
                  className="mt-3 text-xs font-semibold text-primary hover:underline"
                >
                  Ver todas las reseñas
                </button>
              )}
            </div>
          )}

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
              {filtroEstrellas
                ? `No hay reseñas de ${filtroEstrellas} estrellas.`
                : "Todavía no hay reseñas publicadas. ¡Sé el primero en dejar la tuya!"}
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
                      {r.editada && <span className="ml-1 text-[11px] text-muted-foreground">(editada)</span>}
                    </p>
                    {r.respuesta && (
                      <div className="mb-5 -mt-2">
                        <RespuestaAgencia respuesta={r.respuesta} fecha={r.fecha_respuesta} />
                      </div>
                    )}

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
          <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-lg shadow-primary/5 dark:shadow-none">
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
                <button
                  onClick={openLogin}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  Iniciar sesión
                </button>
              </div>
            ) : reservasResenables.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                {misReservas.length === 0
                  ? "No encontramos reservas asociadas a tu cuenta todavía. Cuando completes un viaje con nosotros, podrás reseñarlo aquí."
                  : "Ya reseñaste todos tus viajes confirmados. ¡Gracias! Puedes editar tus reseñas abajo."}
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="resena-reserva" className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    ¿Qué reserva quieres reseñar?
                  </label>
                  <select
                    id="resena-reserva"
                    value={idReserva}
                    onChange={(e) => setIdReserva(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="">Selecciona una reserva</option>
                    {reservasResenables.map((r) => (
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
                        aria-label={`${s} estrella${s > 1 ? "s" : ""}`}
                        aria-pressed={s === calificacion}
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
                  <label htmlFor="resena-comentario" className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Tu comentario
                  </label>
                  <textarea
                    id="resena-comentario"
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

            {misResenas.length > 0 && (
              <div className="mt-6 pt-5 border-t border-border space-y-3">
                <p className="text-sm font-bold text-foreground">Mis reseñas</p>
                {misResenas.map((r) => (
                  <div key={r.id_resena} className="rounded-2xl border border-border p-3 text-sm">
                    {editandoId === r.id_resena ? (
                      <div className="space-y-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              key={s}
                              type="button"
                              aria-label={`${s} estrella${s > 1 ? "s" : ""}`}
                              aria-pressed={s === edicion.calificacion}
                              onClick={() => setEdicion((e) => ({ ...e, calificacion: s }))}
                            >
                              <Star
                                className={`w-5 h-5 ${s <= edicion.calificacion ? "fill-[#C9A227] text-[#C9A227]" : "text-muted-foreground"}`}
                              />
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={edicion.comentario}
                          onChange={(e) => setEdicion((x) => ({ ...x, comentario: e.target.value }))}
                          rows={3}
                          maxLength={1000}
                          aria-label="Editar mi reseña"
                          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => guardarEdicion(r)}
                            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
                          >
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditandoId(null)}
                            className="px-3 py-1.5 rounded-lg border border-border text-xs"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex gap-0.5">
                            {Array.from({ length: r.calificacion }, (_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-[#C9A227] text-[#C9A227]" />
                            ))}
                          </span>
                          <span className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditandoId(r.id_resena);
                                setEdicion({ calificacion: r.calificacion, comentario: r.comentario });
                              }}
                              className="p-1 rounded hover:bg-muted text-muted-foreground"
                              aria-label="Editar mi reseña"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => borrarMiResena(r)}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              aria-label="Borrar mi reseña"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs mt-1 line-clamp-3">{r.comentario}</p>
                        {r.nombre_hotel && <p className="text-[11px] text-muted-foreground mt-1">{r.nombre_hotel}</p>}
                        {r.visible === false && (
                          <p className="text-[11px] text-destructive mt-1">El equipo ocultó esta reseña del sitio.</p>
                        )}
                        <RespuestaAgencia respuesta={r.respuesta_agencia} fecha={r.fecha_respuesta} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
