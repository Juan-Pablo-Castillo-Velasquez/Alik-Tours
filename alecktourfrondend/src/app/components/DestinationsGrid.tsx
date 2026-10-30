import { ArrowUpRight, Sparkles, Star } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTema } from "../context/TemaContext";
import HalloweenAccentDiscreto from "./HalloweenAccentDiscreto";
import { DestinoSeleccion, destinoService } from "../services/destino.service";

const cardVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    }),
};

export default function DestinationsGrid() {
    const { temaActivo } = useTema();
    const esHalloween = temaActivo?.clave === "halloween";
    const [destinations, setDestinations] = useState<DestinoSeleccion[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let activo = true;

        destinoService
            .getSeleccionCasa()
            .then((data) => {
                if (activo) setDestinations(data);
            })
            .catch((err) => {
                console.error("Error cargando selección de la casa:", err);
            })
            .finally(() => {
                if (activo) setLoading(false);
            });

        return () => {
            activo = false;
        };
    }, []);

    if (!loading && destinations.length === 0) return null;

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-background transition-colors duration-300 overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">

                {/* --- SECCIÓN IZQUIERDA: Promoción y Modelo --- */}
                <div className="lg:col-span-5 flex flex-col justify-center h-full relative">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="mb-8 z-10"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className="h-px w-8 bg-[var(--chart-2)]" />
                            <span className="text-primary text-xs font-bold uppercase tracking-[0.2em]">
                                Selección de la casa
                            </span>
                        </div>
                        <h2
                            className="text-4xl md:text-5xl text-foreground font-medium mb-4 leading-tight"
                            style={{ fontFamily: "'Fraunces', serif" }}
                        >
                            Destinos que <br className="hidden md:block" />
                            <span className="text-primary italic">enamoran</span>
                        </h2>
                        <p className="text-muted-foreground leading-relaxed mb-6 max-w-md">
                            Cada hospedaje pasa por nuestra curaduría antes de llegar a esta lista. Calidad antes que cantidad. Reserva hoy y recibe beneficios.
                        </p>
                    </motion.div>

                    {/* Espacio para la Mujer PNG + Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                        className="relative mt-auto flex justify-center lg:justify-center"
                    >
                        {/* Brillo decorativo de fondo */}
                        <div className="absolute bottom-10 w-64 h-64 bg-[var(--chart-2)]/15 rounded-full blur-3xl -z-10" />

                        {/* Recorte con transparencia real -- en temporada de
                            Halloween es el trío de personajes que compartió
                            el usuario (se le quitó el fondo con un modelo de
                            segmentación porque el archivo que llegó era un
                            JPG con el patrón de cuadros pintado como
                            píxeles, no transparencia de verdad). Mismo
                            tratamiento que la viajera de siempre: ambos son
                            recortes reales, así que comparten máscara,
                            sombra y el badge flotante sin ningún caso
                            especial. */}
                        <img
                            src={esHalloween ? "/img/imagenpromocional-halloween.png" : "/img/imagenpromocional-removebg-preview.png"}
                            alt={esHalloween ? "Personajes de Halloween de Alik Tours" : "Viajera promocional"}
                            className="w-full h-full object-contain object-bottom drop-shadow-2xl [mask-image:linear-gradient(to_top,transparent_0%,black_15%)]"
                            style={{ maxHeight: "450px" }}
                        />

                        {/* Badge Flotante Animado */}
                        <motion.div
                            animate={{ y: [0, -12, 0] }}
                            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                            className="absolute top-10 -right-2 lg:-right-6 bg-card border border-border shadow-xl rounded-2xl p-3.5 flex items-center gap-3 z-20"
                        >
                            <div className="bg-primary/10 p-2.5 rounded-full text-primary">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Promo Especial</p>
                                <p className="text-sm font-bold text-foreground">Hasta 30% OFF</p>
                            </div>
                        </motion.div>
                    </motion.div>
                </div>

                {/* --- SECCIÓN DERECHA: Cuadrícula de Tarjetas (2x2) --- */}
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10 lg:mt-0">
                    {loading ? (
                        [0, 1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className="h-72 rounded-3xl bg-muted animate-pulse"
                            />
                        ))
                    ) : (
                        destinations.map((d, i) => (
                            <motion.article
                                key={d.id}
                                custom={i}
                                variants={cardVariants}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true, margin: "-60px" }}
                                whileHover={{ y: -6 }}
                                className="group bg-card text-card-foreground rounded-3xl overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
                            >
                                <Link to={`/hotel/${d.id}`} className="flex flex-col flex-1 cursor-pointer">
                                    <div className="relative h-48 overflow-hidden shrink-0">
                                        <img
                                            src={d.img}
                                            alt={d.name}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                                        {/* Esquina superior izquierda libre (la derecha ya la usa
                                            el botón "Ver más" en hover y la inferior izquierda el
                                            rating) -- un solo acento por tarjeta. */}
                                        {esHalloween && (
                                            <HalloweenAccentDiscreto variante="calabaza" posicion="top-left" tamano="sm" />
                                        )}

                                        <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-background/90 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-sm">
                                            <ArrowUpRight className="w-4 h-4 text-primary" />
                                        </div>

                                        <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-background/95 backdrop-blur px-2.5 py-1 rounded-full shadow-sm">
                                            <Star className="w-3.5 h-3.5 fill-[var(--chart-2)] text-[var(--chart-2)]" />
                                            <span className="text-xs font-semibold text-foreground">{d.rating}</span>
                                        </div>
                                    </div>

                                    <div className="p-5 flex flex-col flex-1">
                                        <h3 className="text-foreground font-semibold text-[17px] mb-1">{d.name}</h3>
                                        <p className="text-muted-foreground text-sm mb-4">{d.tag}</p>

                                        <div className="flex items-end justify-between pt-4 border-t border-border mt-auto">
                                            <div>
                                                <p className="text-[11px] text-muted-foreground mb-0.5">{d.nights}</p>
                                                <p className="text-primary font-bold text-lg leading-none">
                                                    ${d.price}
                                                    <span className="text-muted-foreground text-xs font-normal"> COP</span>
                                                </p>
                                            </div>
                                            <span className="text-[var(--chart-2)] text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                Ver más
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            </motion.article>
                        ))
                    )}
                </div>

            </div>
        </section>
    );
}