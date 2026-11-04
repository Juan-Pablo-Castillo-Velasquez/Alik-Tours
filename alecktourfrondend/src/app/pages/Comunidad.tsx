import { Clapperboard, Loader2, PenSquare, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import PublicacionCard from "../components/comunidad/PublicacionCard";
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

  // Se recarga al iniciar/cerrar sesión: el servidor marca qué es "mío"
  // (para poder borrarlo) solo si la petición lleva la sesión.
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    Promise.all([comunidadService.getVideos(), comunidadService.getPublicaciones(0, POR_PAGINA)])
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
  }, [isAuthenticated]);

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
      const p = await comunidadService.getPublicaciones(publicaciones.length, POR_PAGINA);
      setPublicaciones((prev) => [...prev, ...p.items.filter((n) => !prev.some((x) => x.id_publicacion === n.id_publicacion))]);
      setTotal(p.total);
    } finally {
      setCargandoMas(false);
    }
  };

  const abrirPublicar = () => (esCliente ? setModalAbierto(true) : openLogin());
  const pendientes = mias.filter((m) => m.estado !== "aprobada");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <header className="max-w-5xl mx-auto px-4 pt-10 pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2">{BRAND.slogan}</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          Comunidad {BRAND.name}
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Mira lo que hacemos en cada viaje y lo que cuentan nuestros viajeros. Si ya viajaste con nosotros, comparte tu
          experiencia con un video o fotos.
        </p>
      </header>

      {/* Videos de la agencia */}
      {videos.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-10" aria-labelledby="videos-agencia">
          <h2 id="videos-agencia" className="text-xl font-semibold flex items-center gap-2 mb-4">
            <Clapperboard className="w-5 h-5 text-primary" /> Videos de {BRAND.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <section className="max-w-2xl mx-auto px-4 pb-16" aria-labelledby="experiencias">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 id="experiencias" className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Experiencias de viajeros
          </h2>
          <button
            onClick={abrirPublicar}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-95"
          >
            <PenSquare className="w-4 h-4" /> Compartir mi experiencia
          </button>
        </div>

        {pendientes.length > 0 && (
          <div className="mb-6 rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-semibold">Tus publicaciones en revisión o no aprobadas</p>
            {pendientes.map((m) => (
              <div key={m.id_publicacion} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="truncate max-w-[70%]">{m.titulo}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ESTADO_LABEL[m.estado]?.cls ?? ""}`}>
                  {ESTADO_LABEL[m.estado]?.texto ?? m.estado}
                </span>
                {m.estado === "rechazada" && m.motivo_moderacion && (
                  <p className="w-full text-xs text-muted-foreground">Motivo: {m.motivo_moderacion}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {cargando ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : error ? (
          <p className="text-center text-sm text-destructive py-10">{error}</p>
        ) : publicaciones.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-border rounded-2xl">
            <p className="font-medium">Todavía no hay experiencias publicadas</p>
            <p className="text-sm text-muted-foreground mt-1">¿Viajaste con nosotros? Sé el primero en contarlo.</p>
          </div>
        ) : (
          <div className="space-y-6">
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
                className="w-full py-3 rounded-xl border border-border text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                {cargandoMas ? "Cargando..." : "Ver más experiencias"}
              </button>
            )}
          </div>
        )}
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
