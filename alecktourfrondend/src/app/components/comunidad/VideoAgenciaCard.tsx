import { MapPin, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { comunidadService, resolveMediaComunidad, VideoAgencia } from "../../services/comunidad.service";
import ComentariosHilo from "./ComentariosHilo";

interface Props {
  video: VideoAgencia;
  puedeComentar: boolean;
  onPedirLogin: () => void;
  /** En la ficha del paquete no tiene sentido enlazar al mismo paquete. */
  ocultarEnlacePaquete?: boolean;
  /** Formato vertical (reel) o apaisado. */
  vertical?: boolean;
}

/** Video de la agencia con su enlace al viaje y sus comentarios. */
export default function VideoAgenciaCard({ video, puedeComentar, onPedirLogin, ocultarEnlacePaquete, vertical = true }: Props) {
  const [comentarios, setComentarios] = useState(video.comentarios ?? []);
  const [abierto, setAbierto] = useState(false);

  return (
    <figure className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
      <video
        src={resolveMediaComunidad(video.video_url)}
        poster={resolveMediaComunidad(video.portada_url)}
        controls
        playsInline
        preload="metadata"
        className={`w-full bg-black object-cover ${vertical ? "aspect-[9/16] max-h-[520px]" : "aspect-video"}`}
      />
      <figcaption className="p-4 space-y-2 flex-1 flex flex-col">
        <p className="font-semibold text-sm break-words">{video.titulo}</p>
        {video.descripcion && <p className="text-xs text-muted-foreground break-words">{video.descripcion}</p>}
        <div className="mt-auto pt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          {video.id_paquete && video.nombre_paquete && !ocultarEnlacePaquete && (
            <Link
              to={`/package/${video.id_paquete}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              <MapPin className="w-3.5 h-3.5" /> Ver el viaje: {video.nombre_paquete}
            </Link>
          )}
          <button
            onClick={() => setAbierto((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
            aria-expanded={abierto}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {comentarios.length === 0
              ? "Comentar"
              : `${comentarios.length} comentario${comentarios.length > 1 ? "s" : ""}`}
          </button>
        </div>
        {abierto && (
          <div className="pt-3 border-t border-border">
            <ComentariosHilo
              comentarios={comentarios}
              onChange={setComentarios}
              puedeComentar={puedeComentar}
              onPedirLogin={onPedirLogin}
              enviar={(texto, idPadre) => comunidadService.comentarVideo(video.id_video, texto, idPadre)}
              borrar={comunidadService.borrarComentario}
            />
          </div>
        )}
      </figcaption>
    </figure>
  );
}
