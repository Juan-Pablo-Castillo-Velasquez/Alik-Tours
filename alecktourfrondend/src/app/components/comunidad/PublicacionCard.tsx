import { MapPin, MessageCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  ComentarioComunidad,
  comunidadService,
  PublicacionComunidad,
  resolveMediaComunidad,
} from "../../services/comunidad.service";
import ComentariosHilo from "./ComentariosHilo";
import Estrellas from "./Estrellas";

interface Props {
  publicacion: PublicacionComunidad;
  /** Cliente con sesión o alguien del equipo (puede comentar). */
  puedeComentar: boolean;
  onPedirLogin: () => void;
  onBorrada?: (id: number) => void;
}

function fecha(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ nombre, foto }: { nombre: string; foto: string | null }) {
  const src = resolveMediaComunidad(foto);
  return src ? (
    <img src={src} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" loading="lazy" />
  ) : (
    <span className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}

export default function PublicacionCard({ publicacion, puedeComentar, onPedirLogin, onBorrada }: Props) {
  const [comentarios, setComentarios] = useState<ComentarioComunidad[]>(publicacion.comentarios);
  // Abierto de entrada si ya hay conversación: antes había que descubrir
  // el enlace "N comentarios" para verla.
  const [abierto, setAbierto] = useState(publicacion.comentarios.length > 0);
  const p = publicacion;

  const borrarPublicacion = async () => {
    if (!window.confirm("¿Borrar esta publicación? No se puede deshacer.")) return;
    try {
      await comunidadService.borrarPublicacion(p.id_publicacion);
      onBorrada?.(p.id_publicacion);
      toast.success("Publicación eliminada");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo borrar la publicación");
    }
  };

  return (
    <article className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <header className="flex items-start gap-3 p-4 sm:p-5">
        <Avatar nombre={p.autor.nombre} foto={p.autor.foto} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{p.autor.nombre}</p>
          <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
            {fecha(p.fecha_creacion)}
            {p.destino && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {p.destino}
              </span>
            )}
          </p>
        </div>
        {p.calificacion ? <Estrellas valor={p.calificacion} size={14} /> : null}
        {p.es_mia && onBorrada && (
          <button
            onClick={borrarPublicacion}
            className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg"
            aria-label="Borrar mi publicación"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </header>

      {p.video_url && (
        <video
          src={resolveMediaComunidad(p.video_url)}
          controls
          playsInline
          preload="metadata"
          className="w-full max-h-[70vh] bg-black"
        />
      )}
      {p.imagenes.length > 0 && (
        <div className={`grid gap-0.5 ${p.imagenes.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {p.imagenes.map((url, i) => (
            <img
              key={url}
              src={resolveMediaComunidad(url)}
              alt={`Foto ${i + 1} de ${p.titulo}`}
              loading="lazy"
              className={`w-full object-cover ${p.imagenes.length === 1 ? "max-h-[70vh]" : "aspect-square"}`}
            />
          ))}
        </div>
      )}

      <div className="p-4 sm:p-5 space-y-2">
        <h3 className="font-semibold text-foreground break-words">{p.titulo}</h3>
        <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{p.contenido}</p>

        <button
          onClick={() => setAbierto((v) => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline pt-1"
        >
          <MessageCircle className="w-3.5 h-3.5" />
          {comentarios.length === 0
            ? "Comentar"
            : abierto
              ? "Ocultar comentarios"
              : `${comentarios.length} comentario${comentarios.length > 1 ? "s" : ""}`}
        </button>

        {abierto && (
          <div className="pt-3 border-t border-border">
            <ComentariosHilo
              comentarios={comentarios}
              onChange={setComentarios}
              puedeComentar={puedeComentar}
              onPedirLogin={onPedirLogin}
              enviar={(texto, idPadre) => comunidadService.comentar(p.id_publicacion, texto, idPadre)}
              borrar={comunidadService.borrarComentario}
            />
          </div>
        )}
      </div>
    </article>
  );
}
