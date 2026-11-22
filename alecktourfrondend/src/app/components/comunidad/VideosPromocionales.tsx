import { Clapperboard } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { BRAND } from "../../config/brand";
import { useAuth } from "../../context/AuthContext";
import { useAuthModal } from "../../context/AuthModalContext";
import { usePuedeComentar } from "../../hooks/usePuedeComentar";
import { comunidadService, VideoAgencia } from "../../services/comunidad.service";
import VideoAgenciaCard from "./VideoAgenciaCard";

interface Props {
  /** Solo los videos promocionales de este paquete (ficha del viaje). */
  idPaquete?: number;
  /** Solo los destacados para la página de inicio. */
  inicio?: boolean;
  titulo?: string;
  subtitulo?: string;
  /** Máximo de videos a mostrar. */
  max?: number;
}

/**
 * Videos de la agencia como parte promocional: en el inicio (los que el
 * admin marca "Mostrar en el inicio") y en la ficha de cada paquete (los
 * asociados a ese viaje). Si no hay videos no se muestra nada.
 */
export default function VideosPromocionales({ idPaquete, inicio, titulo, subtitulo, max = 6 }: Props) {
  const [videos, setVideos] = useState<VideoAgencia[]>([]);
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();
  const puedeComentar = usePuedeComentar();

  useEffect(() => {
    let vigente = true;
    comunidadService
      .getVideos({ idPaquete, inicio })
      .then((v) => vigente && setVideos(v.slice(0, max)))
      .catch(() => vigente && setVideos([]));
    return () => {
      vigente = false;
    };
    // isAuthenticated: al iniciar sesión se recargan para marcar "lo mío".
  }, [idPaquete, inicio, max, isAuthenticated]);

  if (videos.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-12" aria-labelledby="videos-promocionales">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h2 id="videos-promocionales" className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ fontFamily: "'Fraunces', serif" }}>
            <Clapperboard className="w-6 h-6 text-primary" />
            {titulo ?? `Viaja con ${BRAND.name} en video`}
          </h2>
          {subtitulo && <p className="text-sm text-muted-foreground mt-1">{subtitulo}</p>}
        </div>
        <Link to="/comunidad" className="text-sm font-semibold text-primary hover:underline">
          Ver la comunidad →
        </Link>
      </div>
      {/* Con un solo video, antes ocupaba media fila y dejaba la otra mitad
          vacía: ahora va acompañado de un panel con qué hacer después. */}
      <div
        className={`grid gap-5 grid-cols-1 ${
          videos.length === 1 ? "md:grid-cols-2 md:items-center" : `sm:grid-cols-2 ${videos.length >= 3 ? "lg:grid-cols-3" : ""}`
        }`}
      >
        {videos.length === 1 && (
          <div className="order-last flex flex-col gap-4 rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-[var(--gold)]/10 p-6 md:order-none md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Contado por nuestro equipo</p>
            <h3 className="text-2xl font-bold leading-tight text-foreground">{videos[0].titulo}</h3>
            <p className="text-sm text-muted-foreground">
              {videos[0].descripcion ||
                "Así se viven los viajes que organizamos. Si quieres uno parecido, mira los paquetes o escríbele a un asesor: te armamos la ruta a tu medida."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/packages" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
                Ver paquetes
              </Link>
              <Link to="/comunidad" className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
                Ir a la comunidad
              </Link>
            </div>
          </div>
        )}
        {videos.map((v) => (
          <VideoAgenciaCard
            key={`${v.id_video}-${isAuthenticated}`}
            video={v}
            puedeComentar={puedeComentar}
            onPedirLogin={openLogin}
            ocultarEnlacePaquete={idPaquete != null}
          />
        ))}
      </div>
    </section>
  );
}
