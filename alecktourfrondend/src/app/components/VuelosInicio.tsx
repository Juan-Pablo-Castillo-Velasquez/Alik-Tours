import { ArrowRight, CalendarDays, Plane, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { hora, OfertaVuelo, vueloService } from "../services/vuelo.service";

function fechaCorta(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

/**
 * Zona de vuelos de la página de inicio: buscador rápido hacia /vuelos y
 * las próximas ofertas que la agencia vende solas. Si todavía no hay
 * ofertas publicadas, invita a pedir una cotización (no se inventan vuelos).
 */
export default function VuelosInicio() {
  const navigate = useNavigate();
  const [ofertas, setOfertas] = useState<OfertaVuelo[] | null>(null);
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [fecha, setFecha] = useState("");

  useEffect(() => {
    vueloService
      .listarPublicas({ solo_independientes: true, limit: 3 })
      .then((o) => setOfertas(o.slice(0, 3)))
      .catch(() => setOfertas([]));
  }, []);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (origen.trim()) p.set("origen", origen.trim());
    if (destino.trim()) p.set("destino", destino.trim());
    if (fecha) p.set("desde", fecha);
    navigate(`/vuelos${p.toString() ? `?${p}` : ""}`);
  }

  const campo = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground";

  return (
    <section aria-labelledby="titulo-vuelos-inicio" className="bg-gradient-to-b from-background to-primary/[0.04] py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Plane className="h-4 w-4" /> Vuelos
            </p>
            <h2 id="titulo-vuelos-inicio" className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
              Reserva tu vuelo con la agencia
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Ofertas aéreas nacionales e internacionales que gestionamos con cada aerolínea, con acompañamiento hasta la emisión.
            </p>
          </div>
          <Link to="/vuelos" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            Ver todos los vuelos <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <form onSubmit={buscar} className="grid gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_auto]">
          <input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="¿Desde dónde? (ej. Bogotá)" aria-label="Origen del vuelo" className={campo} />
          <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="¿A dónde? (ej. Cartagena)" aria-label="Destino del vuelo" className={campo} />
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Fecha de salida desde" className={campo} />
          <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
            <Search className="h-4 w-4" /> Buscar vuelos
          </button>
        </form>

        {ofertas && ofertas.length > 0 && (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {ofertas.map((o) => (
              <Link key={o.id_oferta} to={`/vuelos/${o.id_oferta}`} className="group rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{o.aerolinea || "Aerolínea por confirmar"}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-lg font-bold">{o.origen_iata || o.origen_ciudad}</span>
                  <span className="flex flex-1 items-center gap-1"><span className="h-px flex-1 bg-border" /><Plane className="h-3.5 w-3.5 text-primary" /><span className="h-px flex-1 bg-border" /></span>
                  <span className="text-lg font-bold">{o.destino_iata || o.destino_ciudad}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">{o.origen_ciudad} → {o.destino_ciudad}</p>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" /> {fechaCorta(o.fecha_salida)}{hora(o.hora_salida) ? ` · ${hora(o.hora_salida)}` : ""}
                  {o.fecha_regreso ? ` – ${fechaCorta(o.fecha_regreso)}` : ""}
                </p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Por adulto</p>
                    <p className="text-xl font-bold text-primary">${Math.round(o.precio_adulto).toLocaleString("es-CO")}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:underline">Ver vuelo <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </Link>
            ))}
          </div>
        )}
        {ofertas && ofertas.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            ¿No ves tu ruta? <Link to="/contact" className="font-semibold text-primary underline">Pídenos una cotización</Link> y un asesor te busca el vuelo.
          </p>
        )}
      </div>
    </section>
  );
}
