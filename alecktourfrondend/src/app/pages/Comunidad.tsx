import { Camera, Clapperboard, Loader2, MapPin, PenSquare, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import PublicacionCard from "../components/comunidad/PublicacionCard";
import { AvisoContenidoEjemplo } from "../components/EtiquetaEjemplo";
import PublicarModal from "../components/comunidad/PublicarModal";
import VideoAgenciaCard from "../components/comunidad/VideoAgenciaCard";
import { BRAND } from "../config/brand";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import { usePuedeComentar } from "../hooks/usePuedeComentar";
import { useSeoMeta } from "../hooks/useSeoMeta";
import { comunidadService, PublicacionComunidad, VideoAgencia } from "../services/comunidad.service";

const POR_PAGINA = 10;

const ESTADO_LABEL: Record<string, { texto: string; cls: string }> = {
  pendiente: { texto: "En revisión", cls: "bg-warning/15 text-warning" },
  aprobada: { texto: "Publicada", cls: "bg-success/15 text-success" },
  rechazada: { texto: "No aprobada", cls: "bg-destructive/10 text-destructive" },
  oculta: { texto: "Oculta", cls: "bg-muted text-muted-foreground" },
};

export default function Comunidad() {
  useSeoMeta({
    title: "Comunidad viajera y videos",
    description: `Videos de ${BRAND.name} y experiencias reales de nuestros viajeros: reseñas, fotos y videos de sus viajes.`,
    path: "/comunidad",
  });

  const { isAuthenticated, usuario } = useAuth();
  const { openLogin } = useAuthModal();
  const esCliente = isAuthenticated && usuario?.id_cliente != null;
  // Clientes y equipo comentan; solo los clientes publican experiencias.
  const puedeComentar = usePuedeComentar();

  const [videos, setVideos] = useState<VideoAgencia[]>([]);
  const [publicaciones, setPublicaciones] = useState<PublicacionComunidad[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mias, setMias] = useState<PublicacionComunidad[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [destinos, setDestinos] = useState<{ destino: string; total: number }[]>([]);
  const [destino, setDestino] = useState<string | null>(null);
  const totalGeneral = destinos.reduce((acc, d) => acc + d.total, 0);

  // Se recarga al iniciar/cerrar sesión: el servidor marca qué es "mío"
  // (para poder borrarlo) solo si la petición lleva la sesión.
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    Promise.all([comunidadService.getVideos(), comunidadService.getPublicaciones(0, POR_PAGINA, destino)])
      .then(([v, p]) => {
        if (!vigente) return;
        setVideos(v);
        setPublicaciones(p.items);
        setTotal(p.total);
      })
      .catch(() => vigente && setError("No pudimos cargar la comunidad. Intenta de nuevo en un momento."))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [isAuthenticated, destino]);

  useEffect(() => {
    comunidadService.getDestinos().then(setDestinos).catch(() => {});
  }, []);

  const cargarMias = useCallback(() => {
    if (!esCliente) return;
    comunidadService.getMisPublicaciones().then(setMias).catch(() => {});
  }, [esCliente]);

  useEffect(() => {
    cargarMias();
  }, [cargarMias]);

  const cargarMas = async () => {
    setCargandoMas(true);
    try {
      const p = await comunidadService.getPublicaciones(publicaciones.length, POR_PAGINA, destino);
      setPublicaciones((prev) => [...prev, ...p.items.filter((n) => !prev.some((x) => x.id_publicacion === n.id_publicacion))]);
      setTotal(p.total);
    } finally {
      setCargandoMas(false);
    }
  };

  const abrirPublicar = () => (esCliente ? setModalAbierto(true) : openLogin());
  const pendientes = mias.filter((m) => m.estado !== "aprobada");

  const chip = (activo: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      activo
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-foreground/75 hover:border-primary/40 hover:text-foreground"
    }`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <header className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-8 pt-10 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <h1
            className="text-4xl leading-[1.05] tracking-tight md:text-5xl"
            style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}
          >
            Historias de viaje
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Fotos, consejos y conversaciones de quienes ya viajaron con {BRAND.name}. Mira cómo se vive cada destino antes
            de reservar.
          </p>
        </div>
        <button
          onClick={abrirPublicar}
          className="inline-flex shrink-0 lg:hidden items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/20 transition hover:opacity-95"
        >
          <PenSquare className="h-4 w-4" /> Contar mi viaje
        </button>
      </header>

      {/* Videos de la agencia */}
      {videos.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12" aria-labelledby="videos-agencia">
          <h2 id="videos-agencia" className="mb-4 flex items-center gap-2 text-xl font-semibold">
            <Clapperboard className="h-5 w-5 text-primary" /> Videos de {BRAND.name}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoAgenciaCard
                key={`${v.id_video}-${isAuthenticated}`}
                video={v}
                puedeComentar={puedeComentar}
                onPedirLogin={openLogin}
              />
            ))}
          </div>
        </section>
      )}

      {/* Comunidad de viajeros */}
      <section
        className="mx-auto grid max-w-6xl gap-8 px-4 pb-20 lg:grid-cols-[minmax(0,1fr)_320px]"
        aria-labelledby="experiencias"
      >
        <div className="min-w-0">
          <h2 id="experiencias" className="sr-only">
            Experiencias de viajeros
          </h2>

          {destinos.length > 1 && (
            <nav
              aria-label="Filtrar por destino"
              className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]"
            >
              <button onClick={() => setDestino(null)} className={chip(destino === null)} aria-pressed={destino === null}>
                Todos <span className="text-xs opacity-70">{totalGeneral}</span>
              </button>
              {destinos.map((d) => (
                <button
                  key={d.destino}
                  onClick={() => setDestino(d.destino)}
                  className={chip(destino === d.destino)}
                  aria-pressed={destino === d.destino}
                >
                  {d.destino} <span className="text-xs opacity-70">{d.total}</span>
                </button>
              ))}
            </nav>
          )}

          {cargando ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : publicaciones.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card px-6 py-14 text-center">
              <Camera className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 font-semibold">
                {destino ? `Aún no hay historias de ${destino}` : "Todavía no hay historias publicadas"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">¿Viajaste con nosotros? Sé el primero en contarlo.</p>
              <button
                onClick={abrirPublicar}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                <PenSquare className="h-4 w-4" /> Contar mi viaje
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {publicaciones.some((p) => p.es_ejemplo) && <AvisoContenidoEjemplo />}
              {publicaciones.map((p) => (
                <PublicacionCard
                  key={`${p.id_publicacion}-${isAuthenticated}`}
                  publicacion={p}
                  puedeComentar={puedeComentar}
                  onPedirLogin={openLogin}
                  onBorrada={(id) => {
                    setPublicaciones((prev) => prev.filter((x) => x.id_publicacion !== id));
                    setTotal((t) => Math.max(t - 1, 0));
                    cargarMias();
                  }}
                />
              ))}
              {publicaciones.length < total && (
                <button
                  onClick={cargarMas}
                  disabled={cargandoMas}
                  className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold hover:bg-muted disabled:opacity-60"
                >
                  {cargandoMas ? "Cargando..." : `Ver más historias (${total - publicaciones.length})`}
                </button>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl bg-primary p-6 text-primary-foreground">
            <h3 className="text-xl leading-tight" style={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
              ¿Ya volviste de tu viaje?
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-primary-foreground/80">
              Comparte tus fotos o un video y cuéntale a otros viajeros qué te gustó y qué recomiendas.
            </p>
            <button
              onClick={abrirPublicar}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90"
            >
              <PenSquare className="h-4 w-4" /> {esCliente ? "Contar mi viaje" : "Inicia sesión para publicar"}
            </button>
          </div>

          {pendientes.length > 0 && (
            <div className="rounded-3xl border border-border bg-card p-5">
              <p className="text-sm font-semibold">Tus publicaciones</p>
              <ul className="mt-3 space-y-3">
                {pendientes.map((m) => (
                  <li key={m.id_publicacion} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{m.titulo}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_LABEL[m.estado]?.cls ?? ""}`}
                      >
                        {ESTADO_LABEL[m.estado]?.texto ?? m.estado}
                      </span>
                    </div>
                    {m.estado === "rechazada" && m.motivo_moderacion && (
                      <p className="mt-1 text-xs text-muted-foreground">Motivo: {m.motivo_moderacion}</p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {destinos.length > 0 && (
            <div className="hidden rounded-3xl border border-border bg-card p-5 lg:block">
              <p className="text-sm font-semibold">Destinos con más historias</p>
              <ul className="mt-3 space-y-1">
                {destinos.slice(0, 6).map((d) => (
                  <li key={d.destino}>
                    <button
                      onClick={() => {
                        setDestino(d.destino);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm text-foreground/80 hover:bg-muted hover:text-foreground"
                    >
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> {d.destino}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">{d.total}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 rounded-3xl border border-border bg-card p-5 text-sm">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p className="leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Revisamos cada historia</span> antes de publicarla para que
              la comunidad sea un lugar útil y respetuoso.
            </p>
          </div>
        </aside>
      </section>

      <PublicarModal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        onPublicada={(p) => setMias((prev) => [p, ...prev])}
      />

      <Footer />
    </div>
  );
}
