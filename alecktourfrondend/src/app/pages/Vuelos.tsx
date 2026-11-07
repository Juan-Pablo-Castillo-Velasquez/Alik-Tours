import { ArrowRight, CalendarDays, Info, Loader2, Luggage, Plane, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { resolveFotoUrl } from "../components/admin/types";
import { useSeoMeta } from "../hooks/useSeoMeta";
import { ETIQUETA_CLASE, ETIQUETA_TRAYECTO, hora, OfertaVuelo, vueloService } from "../services/vuelo.service";

export function fechaVuelo(iso?: string | null) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function pesosVuelo(n: number) {
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

/** Tarjeta de una oferta aérea en el listado público. */
export function TarjetaVuelo({ o }: { o: OfertaVuelo }) {
  const sinCupo = o.cupos_disponibles === 0;
  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
        {o.imagen_url && (
          <img src={resolveFotoUrl(o.imagen_url)} alt="" className="h-36 w-full object-cover sm:h-auto sm:w-48" loading="lazy" />
        )}
        <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {o.aerolinea || "Aerolínea por confirmar"}{o.clase ? ` · ${ETIQUETA_CLASE[o.clase]}` : ""}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-foreground">{o.titulo}</h2>
            <div className="mt-3 flex items-center gap-3">
              <div>
                <p className="text-xl font-bold leading-none">{o.origen_iata || o.origen_ciudad}</p>
                <p className="text-xs text-muted-foreground">{o.origen_ciudad}</p>
              </div>
              <div className="flex flex-1 items-center gap-1 text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <Plane className="h-4 w-4 text-primary" />
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="text-right">
                <p className="text-xl font-bold leading-none">{o.destino_iata || o.destino_ciudad}</p>
                <p className="text-xs text-muted-foreground">{o.destino_ciudad}</p>
              </div>
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Ida {fechaVuelo(o.fecha_salida)}{hora(o.hora_salida) ? ` · ${hora(o.hora_salida)}` : ""}</span>
              {o.fecha_regreso && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Regreso {fechaVuelo(o.fecha_regreso)}{hora(o.hora_regreso) ? ` · ${hora(o.hora_regreso)}` : ""}</span>}
              <span>{ETIQUETA_TRAYECTO[o.tipo_trayecto]}</span>
              {o.escalas != null && <span>{o.escalas === 0 ? "Directo" : `${o.escalas} escala(s)`}</span>}
              {o.equipaje_bodega && <span className="inline-flex items-center gap-1"><Luggage className="h-3.5 w-3.5" /> {o.equipaje_bodega}</span>}
            </p>
          </div>
          <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-border pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
            <div className="sm:text-right">
              <p className="text-[11px] text-muted-foreground">Desde, por adulto</p>
              <p className="text-2xl font-bold text-primary">{pesosVuelo(o.precio_adulto)}</p>
              <p className="text-[11px] text-muted-foreground">
                {o.impuestos_incluidos === true ? "Impuestos incluidos" : o.impuestos_incluidos === false ? "Impuestos no incluidos" : "Impuestos por confirmar"}
              </p>
              {o.cupos_disponibles != null && o.cupos_disponibles > 0 && o.cupos_disponibles <= 5 && (
                <p className="text-[11px] font-semibold text-warning">Quedan {o.cupos_disponibles} sillas</p>
              )}
            </div>
            {sinCupo ? (
              <span className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Agotado</span>
            ) : (
              <Link to={`/vuelos/${o.id_oferta}`} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Ver vuelo <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Vuelos() {
  const [params, setParams] = useSearchParams();
  const [origen, setOrigen] = useState(params.get("origen") ?? "");
  const [destino, setDestino] = useState(params.get("destino") ?? "");
  const [desde, setDesde] = useState(params.get("desde") ?? "");
  const [hasta, setHasta] = useState(params.get("hasta") ?? "");
  const [ofertas, setOfertas] = useState<OfertaVuelo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useSeoMeta({
    title: "Vuelos",
    description: "Ofertas de vuelos nacionales e internacionales gestionadas por Alik Tours: compara rutas, fechas y precios y reserva en línea.",
    path: "/vuelos",
  });

  const filtros = {
    origen: params.get("origen") || undefined,
    destino: params.get("destino") || undefined,
    fecha_desde: params.get("desde") || undefined,
    fecha_hasta: params.get("hasta") || undefined,
  };
  const clave = JSON.stringify(filtros);

  useEffect(() => {
    setOfertas(null);
    setError(null);
    vueloService
      .listarPublicas({ ...filtros, solo_independientes: true })
      .then(setOfertas)
      .catch((e: any) => setError(e?.message || "No pudimos cargar los vuelos"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const p: Record<string, string> = {};
    if (origen.trim()) p.origen = origen.trim();
    if (destino.trim()) p.destino = destino.trim();
    if (desde) p.desde = desde;
    if (hasta) p.hasta = hasta;
    setParams(p);
  }

  const hayFiltros = Object.values(filtros).some(Boolean);
  const campo = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <section className="bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="mx-auto max-w-6xl px-4 pb-8 pt-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Vuelos</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">Encuentra tu vuelo</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Ofertas aéreas que gestiona la agencia con cada aerolínea. Reservas en línea y te acompañamos hasta la emisión del tiquete.
          </p>
          <form onSubmit={buscar} className="mt-6 grid gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_160px_auto]">
            <label className="text-xs text-muted-foreground">Origen
              <input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Ciudad o código (BOG)" className={campo} />
            </label>
            <label className="text-xs text-muted-foreground">Destino
              <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ciudad o código (CTG)" className={campo} />
            </label>
            <label className="text-xs text-muted-foreground">Salida desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={campo} />
            </label>
            <label className="text-xs text-muted-foreground">Salida hasta
              <input type="date" min={desde || undefined} value={hasta} onChange={(e) => setHasta(e.target.value)} className={campo} />
            </label>
            <button type="submit" className="flex items-center justify-center gap-2 self-end rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
              <Search className="h-4 w-4" /> Buscar vuelos
            </button>
          </form>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {ofertas === null ? "Buscando vuelos..." : `${ofertas.length} vuelo(s) disponibles`}
          </p>
          {hayFiltros && (
            <button type="button" onClick={() => { setOrigen(""); setDestino(""); setDesde(""); setHasta(""); setParams({}); }} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              <X className="h-4 w-4" /> Quitar filtros
            </button>
          )}
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
        ) : ofertas === null ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
        ) : ofertas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <Plane className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-3 text-lg font-bold">{hayFiltros ? "No hay vuelos con esos filtros" : "Todavía no hay vuelos publicados"}</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Cuéntanos a dónde quieres viajar y un asesor te cotiza el vuelo. También puedes ver los <Link to="/packages" className="font-semibold text-primary underline">paquetes</Link>, algunos incluyen vuelo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ofertas.map((o) => <TarjetaVuelo key={o.id_oferta} o={o} />)}
          </div>
        )}

        <p className="mt-8 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Son ofertas gestionadas por Alik Tours con lo que confirma cada aerolínea; no es disponibilidad en tiempo real. Los horarios que no aparecen los confirma la aerolínea antes de emitir.
        </p>
      </main>
      <Footer />
    </div>
  );
}
