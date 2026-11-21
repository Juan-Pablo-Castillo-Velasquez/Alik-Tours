import {
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Luggage,
  MapPin,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import { resolveFotoUrl } from "../components/admin/types";
import { useSeoMeta } from "../hooks/useSeoMeta";
import {
  BusquedaVuelos,
  ETIQUETA_CLASE,
  ETIQUETA_TRAYECTO,
  FiltrosBusquedaVuelos,
  hora,
  OfertaVuelo,
  OrdenVuelos,
  vueloService,
} from "../services/vuelo.service";

export function fechaVuelo(iso?: string | null) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function pesosVuelo(n: number) {
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function textoEscalas(escalas: number | null | undefined) {
  if (escalas == null) return null;
  return escalas === 0 ? "Directo" : escalas === 1 ? "1 escala" : `${escalas} escalas`;
}

/** Tarjeta de una oferta aérea en el listado público. */
export function TarjetaVuelo({ o }: { o: OfertaVuelo }) {
  const sinCupo = o.cupos_disponibles === 0;
  const escalas = textoEscalas(o.escalas);
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg">
      <div className="flex flex-col sm:flex-row">
        {o.imagen_url && (
          <div className="relative h-36 w-full overflow-hidden sm:h-auto sm:w-52">
            <img
              src={resolveFotoUrl(o.imagen_url)}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              {o.destino_ciudad}
            </span>
          </div>
        )}
        <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {o.aerolinea || "Aerolínea por confirmar"}
                {o.clase ? ` · ${ETIQUETA_CLASE[o.clase]}` : ""}
              </p>
              {escalas && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    o.escalas === 0 ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {escalas}
                </span>
              )}
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-foreground">{o.titulo}</h2>
            <div className="mt-3 flex items-center gap-3">
              <div>
                <p className="text-2xl font-extrabold leading-none tracking-tight">{o.origen_iata || o.origen_ciudad}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{o.origen_ciudad}</p>
                {hora(o.hora_salida) && <p className="text-xs font-semibold text-foreground">{hora(o.hora_salida)}</p>}
              </div>
              <div className="flex flex-1 items-center gap-1 text-muted-foreground" aria-hidden>
                <span className="h-px flex-1 border-t border-dashed border-border" />
                <Plane className="h-4 w-4 text-primary transition-transform duration-500 group-hover:translate-x-1" />
                <span className="h-px flex-1 border-t border-dashed border-border" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-extrabold leading-none tracking-tight">{o.destino_iata || o.destino_ciudad}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{o.destino_ciudad}</p>
                {hora(o.hora_llegada) && <p className="text-xs font-semibold text-foreground">{hora(o.hora_llegada)}</p>}
              </div>
            </div>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" /> Ida {fechaVuelo(o.fecha_salida)}
              </span>
              {o.fecha_regreso && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" /> Regreso {fechaVuelo(o.fecha_regreso)}
                  {hora(o.hora_regreso) ? ` · ${hora(o.hora_regreso)}` : ""}
                </span>
              )}
              <span>{ETIQUETA_TRAYECTO[o.tipo_trayecto]}</span>
              {o.equipaje_bodega && (
                <span className="inline-flex items-center gap-1">
                  <Luggage className="h-3.5 w-3.5" /> {o.equipaje_bodega}
                </span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-border pt-3 sm:flex-col sm:items-end sm:border-0 sm:border-l sm:pl-5 sm:pt-0">
            <div className="sm:text-right">
              <p className="text-[11px] text-muted-foreground">Desde, por adulto</p>
              <p className="text-2xl font-extrabold text-primary">{pesosVuelo(o.precio_adulto)}</p>
              <p className="text-[11px] text-muted-foreground">
                {o.impuestos_incluidos === true
                  ? "Impuestos incluidos"
                  : o.impuestos_incluidos === false
                    ? "Impuestos no incluidos"
                    : "Impuestos por confirmar"}
              </p>
              {o.cupos_disponibles != null && o.cupos_disponibles > 0 && o.cupos_disponibles <= 5 && (
                <p className="text-[11px] font-semibold text-warning">Quedan {o.cupos_disponibles} sillas</p>
              )}
            </div>
            {sinCupo ? (
              <span className="rounded-xl bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Agotado</span>
            ) : (
              <Link
                to={`/vuelos/${o.id_oferta}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
              >
                Ver vuelo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

const VUELOS_POR_PAGINA = 10;

const ORDENES: { valor: OrdenVuelos; etiqueta: string }[] = [
  { valor: "fecha", etiqueta: "Próxima salida" },
  { valor: "precio", etiqueta: "Menor precio" },
  { valor: "precio_desc", etiqueta: "Mayor precio" },
];

/** Lee los filtros desde la URL: así se pueden compartir y sobreviven a recargar. */
function filtrosDeUrl(params: URLSearchParams): FiltrosBusquedaVuelos {
  const trayecto = params.get("trayecto");
  const orden = params.get("orden") as OrdenVuelos | null;
  const precio = Number(params.get("precio"));
  return {
    q: params.get("q") || undefined,
    origen: params.get("origen") || undefined,
    destino: params.get("destino") || undefined,
    fecha_desde: params.get("desde") || undefined,
    fecha_hasta: params.get("hasta") || undefined,
    aerolinea: params.get("aerolinea") || undefined,
    trayecto: trayecto === "solo_ida" || trayecto === "ida_regreso" ? trayecto : undefined,
    solo_directos: params.get("directos") === "1" || undefined,
    precio_max: precio > 0 ? precio : undefined,
    orden: orden && ORDENES.some((o) => o.valor === orden) ? orden : undefined,
    pagina: Math.max(1, Number(params.get("pagina")) || 1),
    por_pagina: VUELOS_POR_PAGINA,
  };
}

function Esqueleto() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-muted/40" />
      ))}
    </div>
  );
}

export default function Vuelos() {
  const [params, setParams] = useSearchParams();
  const [origen, setOrigen] = useState(params.get("origen") ?? "");
  const [destino, setDestino] = useState(params.get("destino") ?? "");
  const [desde, setDesde] = useState(params.get("desde") ?? "");
  const [hasta, setHasta] = useState(params.get("hasta") ?? "");
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const [resultado, setResultado] = useState<BusquedaVuelos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  useSeoMeta({
    title: "Vuelos",
    description:
      "Ofertas de vuelos nacionales e internacionales gestionadas por Alik Tours: compara rutas, fechas, aerolíneas y precios y reserva en línea.",
    path: "/vuelos",
  });

  const filtros = useMemo(() => filtrosDeUrl(params), [params]);
  const clave = JSON.stringify(filtros);
  const pagina = filtros.pagina ?? 1;

  // Precio máximo: se mueve en vivo y se aplica al soltar el control.
  const [precioTope, setPrecioTope] = useState<number | null>(filtros.precio_max ?? null);
  useEffect(() => setPrecioTope(filtros.precio_max ?? null), [filtros.precio_max]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(null);
    vueloService
      .buscar(filtros)
      .then((r) => vigente && setResultado(r))
      .catch((e: any) => vigente && setError(e?.message || "No pudimos cargar los vuelos"))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  /** Cambia uno o varios filtros y vuelve a la página 1. */
  function aplicar(cambios: Record<string, string | null>, conservarPagina = false) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    if (!conservarPagina) p.delete("pagina");
    setParams(p);
  }

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    aplicar({ origen: origen.trim() || null, destino: destino.trim() || null, desde: desde || null, hasta: hasta || null });
  }

  function intercambiar() {
    setOrigen(destino);
    setDestino(origen);
  }

  function irAPagina(n: number) {
    aplicar({ pagina: n <= 1 ? null : String(n) }, true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function limpiarTodo() {
    setOrigen("");
    setDestino("");
    setDesde("");
    setHasta("");
    setTexto("");
    setParams({});
  }

  const facetas = resultado?.facetas;
  const total = resultado?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / VUELOS_POR_PAGINA));
  const ofertas = resultado?.items ?? [];

  const chips: { etiqueta: string; quitar: () => void }[] = [];
  if (filtros.origen) chips.push({ etiqueta: `Desde ${filtros.origen}`, quitar: () => { setOrigen(""); aplicar({ origen: null }); } });
  if (filtros.destino) chips.push({ etiqueta: `Hacia ${filtros.destino}`, quitar: () => { setDestino(""); aplicar({ destino: null }); } });
  if (filtros.fecha_desde) chips.push({ etiqueta: `Sale desde ${fechaVuelo(filtros.fecha_desde)}`, quitar: () => { setDesde(""); aplicar({ desde: null }); } });
  if (filtros.fecha_hasta) chips.push({ etiqueta: `Sale hasta ${fechaVuelo(filtros.fecha_hasta)}`, quitar: () => { setHasta(""); aplicar({ hasta: null }); } });
  if (filtros.q) chips.push({ etiqueta: `“${filtros.q}”`, quitar: () => { setTexto(""); aplicar({ q: null }); } });
  if (filtros.aerolinea) chips.push({ etiqueta: filtros.aerolinea, quitar: () => aplicar({ aerolinea: null }) });
  if (filtros.trayecto) chips.push({ etiqueta: ETIQUETA_TRAYECTO[filtros.trayecto], quitar: () => aplicar({ trayecto: null }) });
  if (filtros.solo_directos) chips.push({ etiqueta: "Solo directos", quitar: () => aplicar({ directos: null }) });
  if (filtros.precio_max) chips.push({ etiqueta: `Hasta ${pesosVuelo(filtros.precio_max)}`, quitar: () => aplicar({ precio: null }) });

  const campo =
    "w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
  const precioMin = facetas?.precio_min ?? 0;
  const precioMax = facetas?.precio_max ?? 0;
  const pasoPrecio = Math.max(1000, Math.round((precioMax - precioMin) / 50 / 1000) * 1000);

  const panelFiltros = (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          aplicar({ q: texto.trim() || null });
        }}
      >
        <label htmlFor="vuelos-texto" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Palabra clave
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="vuelos-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onBlur={() => texto.trim() !== (filtros.q ?? "") && aplicar({ q: texto.trim() || null })}
            placeholder="Ciudad, país o aerolínea"
            className={campo}
          />
        </div>
      </form>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trayecto</p>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="Trayecto">
          {([
            [null, "Todos"],
            ["solo_ida", "Solo ida"],
            ["ida_regreso", "Ida y vuelta"],
          ] as const).map(([valor, etiqueta]) => {
            const activo = (filtros.trayecto ?? null) === valor;
            return (
              <button
                key={etiqueta}
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => aplicar({ trayecto: valor })}
                className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                  activo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border p-3">
        <span>
          <span className="block text-sm font-semibold">Solo vuelos directos</span>
          <span className="block text-xs text-muted-foreground">Sin escalas</span>
        </span>
        <input
          type="checkbox"
          checked={!!filtros.solo_directos}
          onChange={(e) => aplicar({ directos: e.target.checked ? "1" : null })}
          className="h-5 w-5 accent-[var(--primary)]"
        />
      </label>

      {precioMax > precioMin && (
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="vuelos-precio" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Precio máximo
            </label>
            <span className="text-sm font-bold text-primary">{pesosVuelo(precioTope ?? precioMax)}</span>
          </div>
          <input
            id="vuelos-precio"
            type="range"
            min={precioMin}
            max={precioMax}
            step={pasoPrecio}
            value={precioTope ?? precioMax}
            onChange={(e) => setPrecioTope(Number(e.target.value))}
            onPointerUp={() => aplicar({ precio: precioTope && precioTope < precioMax ? String(precioTope) : null })}
            onKeyUp={() => aplicar({ precio: precioTope && precioTope < precioMax ? String(precioTope) : null })}
            className="mt-3 w-full accent-[var(--primary)]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>{pesosVuelo(precioMin)}</span>
            <span>{pesosVuelo(precioMax)}</span>
          </div>
        </div>
      )}

      {!!facetas?.aerolineas.length && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aerolínea</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {facetas.aerolineas.map((a) => {
              const activa = filtros.aerolinea === a.nombre;
              return (
                <button
                  key={a.nombre}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => aplicar({ aerolinea: activa ? null : a.nombre })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activa
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/50"
                  }`}
                >
                  {a.nombre}
                  <span className={activa ? "opacity-80" : "text-muted-foreground"}>{a.total}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-background to-[var(--gold)]/10">
        <Plane
          aria-hidden
          className="pointer-events-none absolute -right-10 top-6 h-64 w-64 rotate-12 text-primary/5 sm:h-80 sm:w-80"
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Vuelos
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">Encuentra tu vuelo</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Escribe la ciudad como quieras, con o sin tildes, o el código del aeropuerto. Te acompañamos hasta la emisión del tiquete.
            </p>
          </motion.div>

          <motion.form
            onSubmit={buscar}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="mt-6 grid gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-xl shadow-primary/5 backdrop-blur sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_150px_150px_auto] lg:items-end"
          >
            <label className="text-xs font-medium text-muted-foreground">
              Origen
              <span className="relative mt-1 block">
                <PlaneTakeoff className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Ciudad o código (BOG)" className={campo} />
              </span>
            </label>
            <button
              type="button"
              onClick={intercambiar}
              aria-label="Intercambiar origen y destino"
              className="hidden h-10 w-10 items-center justify-center self-end rounded-full border border-border bg-background text-muted-foreground transition hover:rotate-180 hover:border-primary hover:text-primary lg:flex"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <label className="text-xs font-medium text-muted-foreground">
              Destino
              <span className="relative mt-1 block">
                <PlaneLanding className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ciudad o código (CTG)" className={campo} />
              </span>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Salida desde
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={`${campo} mt-1 pl-3`} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Salida hasta
              <input
                type="date"
                min={desde || undefined}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className={`${campo} mt-1 pl-3`}
              />
            </label>
            <button
              type="submit"
              className="flex h-[42px] items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 transition hover:opacity-90 sm:col-span-2 lg:col-span-1"
            >
              <Search className="h-4 w-4" /> Buscar vuelos
            </button>
          </motion.form>

          {!!facetas?.destinos.length && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Destinos populares:</span>
              {facetas.destinos.map((d) => (
                <button
                  key={d.nombre}
                  type="button"
                  onClick={() => {
                    setDestino(d.nombre);
                    aplicar({ destino: d.nombre });
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium transition hover:border-primary hover:text-primary"
                >
                  <MapPin className="h-3 w-3" /> {d.nombre}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="mb-4 flex items-center gap-2 text-sm font-bold">
              <SlidersHorizontal className="h-4 w-4 text-primary" /> Filtros
            </p>
            {panelFiltros}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" aria-live="polite">
              {cargando && !resultado ? (
                <span className="text-muted-foreground">Buscando vuelos...</span>
              ) : (
                <>
                  <span className="text-lg font-bold">{total}</span>{" "}
                  <span className="text-muted-foreground">{total === 1 ? "vuelo coincide" : "vuelos coinciden"}</span>
                </>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltrosAbiertos((v) => !v)}
                aria-expanded={filtrosAbiertos}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" /> Filtros
                {chips.length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground">{chips.length}</span>
                )}
              </button>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="hidden sm:inline">Ordenar por</span>
                <select
                  aria-label="Ordenar vuelos"
                  value={filtros.orden ?? "fecha"}
                  onChange={(e) => aplicar({ orden: e.target.value === "fecha" ? null : e.target.value })}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground"
                >
                  {ORDENES.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {filtrosAbiertos && (
            <div className="mb-4 rounded-2xl border border-border bg-card p-4 shadow-sm lg:hidden">{panelFiltros}</div>
          )}

          {chips.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.etiqueta}
                  type="button"
                  onClick={c.quitar}
                  aria-label={`Quitar filtro ${c.etiqueta}`}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
                >
                  {c.etiqueta} <X className="h-3 w-3" />
                </button>
              ))}
              <button type="button" onClick={limpiarTodo} className="text-xs font-semibold text-muted-foreground underline hover:text-foreground">
                Quitar filtros
              </button>
            </div>
          )}

          {error ? (
            <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </p>
          ) : cargando && !resultado ? (
            <Esqueleto />
          ) : ofertas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Plane className="h-7 w-7 text-primary" />
              </span>
              <h2 className="mt-4 text-lg font-bold">{chips.length ? "No hay vuelos con esos filtros" : "Todavía no hay vuelos publicados"}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Prueba con otra fecha o quita algún filtro. Si no encuentras tu ruta, un asesor te la cotiza; también puedes ver los{" "}
                <Link to="/packages" className="font-semibold text-primary underline">
                  paquetes
                </Link>
                , algunos incluyen vuelo.
              </p>
              {chips.length > 0 && (
                <button
                  type="button"
                  onClick={limpiarTodo}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  <X className="h-4 w-4" /> Quitar filtros
                </button>
              )}
            </div>
          ) : (
            <>
              <div className={`space-y-3 transition-opacity ${cargando ? "opacity-60" : ""}`}>
                {ofertas.map((o, i) => (
                  <motion.div
                    key={o.id_oferta}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.04 }}
                  >
                    <TarjetaVuelo o={o} />
                  </motion.div>
                ))}
              </div>
              {totalPaginas > 1 && (
                <nav aria-label="Páginas de vuelos" className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={pagina <= 1}
                    onClick={() => irAPagina(pagina - 1)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </button>
                  <span className="text-sm text-muted-foreground">
                    Página {pagina} de {totalPaginas}
                  </span>
                  <button
                    type="button"
                    disabled={pagina >= totalPaginas}
                    onClick={() => irAPagina(pagina + 1)}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-primary disabled:opacity-40"
                  >
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </button>
                </nav>
              )}
            </>
          )}

          <p className="mt-8 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Son ofertas gestionadas por Alik Tours con lo que confirma cada aerolínea; no es disponibilidad en tiempo real. Los horarios que no
            aparecen los confirma la aerolínea antes de emitir.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
