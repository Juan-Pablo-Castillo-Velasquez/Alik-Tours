import {
  ArrowRight,
  Heart,
  MapPin,
  PlaneTakeoff,
  Quote,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { apiGetResenasDestacadas, ResenaDestacada } from "../api/v1/api";

interface Testimonio {
  name: string;
  location: string;
  quote: string;
  rating: number;
  avatar: string;
  trip: string;
}

function mapResena(r: ResenaDestacada): Testimonio {
  return {
    name: r.name,
    location: r.location || "Colombia",
    quote: r.quote,
    rating: r.rating,
    avatar: r.avatar,
    trip: r.trip,
  };
}

export default function Testimonials() {
  const [testimonials, setTestimonials] = useState<Testimonio[]>([]);
  const [ratingPromedio, setRatingPromedio] = useState<number | null>(null);
  const [totalResenas, setTotalResenas] = useState<number | null>(null);

  useEffect(() => {
    let activo = true;

    apiGetResenasDestacadas()
      .then((data) => {
        if (!activo) return;

        if (data.resenas && data.resenas.length > 0) {
          setTestimonials(data.resenas.slice(0, 3).map(mapResena));
        }
        // != null (no solo truthy): un promedio real de 0 también es un
        // dato real y debe reemplazar el estado "todavía no sabemos".
        if (data.promedio != null) setRatingPromedio(data.promedio);
        if (typeof data.total === "number") setTotalResenas(data.total);
      })
      .catch((err) => {
        // Si falla (backend caído, sin conexión, etc.) nos quedamos sin
        // datos reales — la sección muestra su estado vacío neutro, nunca
        // gente ni cifras inventadas.
        console.error("No se pudieron cargar las reseñas destacadas:", err);
      });

    return () => {
      activo = false;
    };
  }, []);

  return (
    <section className="relative overflow-hidden bg-background py-20 md:py-24 transition-colors duration-300">
      {/* Decoración de fondo */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-primary/10 dark:bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -left-32 w-96 h-96 rounded-full bg-[#C9A227]/10 dark:bg-[#C9A227]/15 blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-10"
        >
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="h-px w-9 bg-[#C9A227]" />
              <span className="text-primary text-[11px] font-bold uppercase tracking-[0.22em]">
                Experiencias reales
              </span>
            </div>

            <h2
              className="text-3xl md:text-4xl lg:text-[42px] leading-tight text-foreground"
              style={{
                fontFamily: "'Fraunces', serif",
                fontWeight: 600,
              }}
            >
              Viajeros que ya
              <span className="text-primary"> vivieron la experiencia</span>
            </h2>

            <p className="mt-3 text-muted-foreground text-sm md:text-base max-w-xl leading-relaxed">
              Opiniones reales de viajeros que reservaron con Alik Tours.
            </p>
          </div>

          {/* Rating general */}
          <div className="flex items-center gap-4 bg-card rounded-2xl px-5 py-4 border border-border shadow-xl shadow-primary/5 dark:shadow-none">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Star className="w-6 h-6 text-[#C9A227] fill-[#C9A227]" />
            </div>

            <div>
              {ratingPromedio !== null ? (
                <>
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className="w-3.5 h-3.5 fill-[#C9A227] text-[#C9A227]"
                      />
                    ))}
                  </div>

                  <p className="text-foreground font-bold text-sm">
                    {ratingPromedio.toFixed(1)} / 5.0
                  </p>

                  <p className="text-muted-foreground text-[11px]">
                    {totalResenas !== null
                      ? `${totalResenas} opiniones verificadas`
                      : "Opiniones verificadas"}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-xs font-medium">
                  Aún sin calificación
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* CONTENIDO */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          {/* TESTIMONIOS */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.length === 0 && (
              <div className="md:col-span-3 flex flex-col items-center justify-center text-center gap-2 bg-card rounded-3xl p-10 border border-dashed border-border">
                <Quote className="w-8 h-8 text-muted-foreground/50" />
                <p className="text-foreground font-semibold text-sm">
                  Todavía no hay reseñas destacadas
                </p>
                <p className="text-muted-foreground text-xs max-w-xs">
                  Sé de los primeros en compartir tu experiencia de viaje con Alik Tours.
                </p>
              </div>
            )}
            {testimonials.map((t, i) => (
              <motion.article
                key={`${t.name}-${i}`}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  delay: i * 0.12,
                  duration: 0.55,
                }}
                whileHover={{
                  y: -6,
                }}
                className="group relative bg-card rounded-3xl p-6 border border-border transition-all duration-300 hover:border-[#C9A227]/50 shadow-lg shadow-primary/5 dark:shadow-none"
              >
                {/* Comilla decorativa */}
                <div className="absolute top-5 right-5 opacity-10 dark:opacity-20">
                  <Quote className="w-12 h-12 text-primary" />
                </div>

                {/* Estrellas */}
                <div className="flex items-center gap-1 mb-5">
                  {Array.from({ length: t.rating }, (_, index) => (
                    <Star
                      key={index}
                      className="w-4 h-4 fill-[#C9A227] text-[#C9A227]"
                    />
                  ))}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    Excelente
                  </span>
                </div>

                {/* Quote */}
                <p className="relative text-foreground/90 text-[14px] leading-[1.75] min-h-[100px] mb-6">
                  “{t.quote}”
                </p>

                {/* Línea */}
                <div className="h-px bg-border mb-5" />

                {/* Usuario */}
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div
                      className="w-12 h-12 rounded-full bg-cover bg-center ring-2 ring-background shadow-md"
                      style={{
                        backgroundImage: `url(${t.avatar})`,
                      }}
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-background">
                      <ShieldCheck className="w-3 h-3 text-primary-foreground" />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="text-foreground text-sm font-bold">
                      {t.name}
                    </p>
                    <div className="flex items-center gap-1 text-muted-foreground text-[11px] mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {t.location}
                    </div>
                    <p className="text-primary text-[10px] font-semibold mt-1">
                      ✓ {t.trip}
                    </p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>

          {/* CTA GRUPOS */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.55, delay: 0.2 }}
            whileHover={{ y: -4 }}
            className="relative overflow-hidden rounded-3xl p-7 flex flex-col justify-between min-h-[330px]"
            style={{
              background:
                "linear-gradient(145deg, var(--primary) 0%, #5E1730 100%)",
              boxShadow: "0 20px 50px rgba(123, 30, 58, 0.20)",
            }}
          >
            {/* Glow */}
            <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-[#C9A227]/20 blur-2xl" />

            <div className="relative">
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center">
                  <PlaneTakeoff className="w-7 h-7 text-[#C9A227]" />
                </div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-white/80 bg-white/10 px-3 py-1.5 rounded-full">
                  Grupos
                </span>
              </div>

              <h3
                className="text-2xl text-white leading-tight mb-3"
                style={{
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 600,
                }}
              >
                Tu próximo viaje
                <br />
                <span className="text-[#C9A227]">empieza aquí.</span>
              </h3>

              <p className="text-white/80 text-sm leading-relaxed">
                Viaja con amigos, familia, empresas o grupos. Diseñamos una
                experiencia especial para ustedes.
              </p>
            </div>

            <div className="relative">
              <div className="flex items-center gap-2 mb-5">
                <div className="flex -space-x-2">
                  {testimonials.map((t, i) => (
                    <div
                      key={`${t.name}-avatar-${i}`}
                      className="w-7 h-7 rounded-full border-2 border-[#5E1730] bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${t.avatar})`,
                      }}
                    />
                  ))}
                  <div className="w-7 h-7 rounded-full border-2 border-[#5E1730] bg-[#C9A227] flex items-center justify-center">
                    <Users className="w-3 h-3 text-[#5E1730]" />
                  </div>
                </div>
                <span className="text-white/80 text-[10px] font-medium">
                  {totalResenas !== null && totalResenas > 0
                    ? `+${totalResenas} viajeros felices`
                    : "Viajeros que confían en nosotros"}
                </span>
              </div>

              {/* Ahora lleva a la página de reseñas (antes iba a /contact) */}
              <Link
                to="/testimonios"
                className="group flex items-center justify-between w-full px-4 py-3.5 rounded-xl bg-white text-primary text-sm font-bold transition-all hover:bg-[#C9A227] hover:text-[#5E1730] shadow-md"
              >
                <span>Dejar comentario sobre mi experiencia</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </motion.div>
        </div>

        {/* BARRA INFERIOR DE CONFIANZA */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-7 rounded-2xl bg-card border border-border px-5 py-4 shadow-lg shadow-primary/5 dark:shadow-none"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-foreground text-xs font-bold">
                  Compra segura
                </p>
                <p className="text-muted-foreground text-[10px]">
                  Tus datos protegidos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#C9A227]/15 flex items-center justify-center">
                <Heart className="w-4 h-4 text-[#C9A227]" />
              </div>
              <div>
                <p className="text-foreground text-xs font-bold">
                  Atención personalizada
                </p>
                <p className="text-muted-foreground text-[10px]">
                  Estamos para ayudarte
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-foreground text-xs font-bold">
                  Reseñas verificadas
                </p>
                <p className="text-muted-foreground text-[10px]">
                  Solo de clientes con reserva
                </p>
              </div>
            </div>

            <Link
              to="/testimonios"
              className="flex items-center justify-between group rounded-lg p-2 -m-2 hover:bg-muted/50 transition-colors"
            >
              <div>
                <p className="text-foreground text-xs font-bold">
                  ¿Quieres conocernos más?
                </p>
                <p className="text-muted-foreground text-[10px]">
                  Explora todas las experiencias
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-primary transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
