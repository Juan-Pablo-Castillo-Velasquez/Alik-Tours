import { MapPin, MessageCircle, Send, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  ComentarioComunidad,
  comunidadService,
  LIMITES_COMUNIDAD,
  PublicacionComunidad,
  resolveMediaComunidad,
} from "../../services/comunidad.service";
import Estrellas from "./Estrellas";

interface Props {
  publicacion: PublicacionComunidad;
  /** Cliente con sesión (puede comentar). */
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
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false); // candado síncrono contra doble Enter
  const p = publicacion;

  const enviarComentario = async () => {
    const contenido = texto.trim();
    if (!contenido || enviandoRef.current) return;
    enviandoRef.current = true;
    setEnviando(true);
    try {
      const nuevo = await comunidadService.comentar(p.id_publicacion, contenido);
      setComentarios((prev) => [...prev, nuevo]);
      setTexto("");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo publicar el comentario");
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  };

  const borrarComentario = async (id: number) => {
    try {
      await comunidadService.borrarComentario(id);
      setComentarios((prev) => prev.filter((c) => c.id_comentario !== id));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo borrar el comentario");
    }
  };

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
          {comentarios.length === 0 ? "Comentar" : `${comentarios.length} comentario${comentarios.length > 1 ? "s" : ""}`}
        </button>

        {abierto && (
          <div className="pt-2 space-y-3 border-t border-border">
            {comentarios.map((c) => (
              <div key={c.id_comentario} className="flex gap-2.5 pt-3">
                <Avatar nombre={c.autor.nombre} foto={c.autor.foto} />
                <div className="min-w-0 flex-1 bg-muted/40 rounded-xl px-3 py-2">
                  <p className="text-xs font-semibold text-foreground flex items-center justify-between gap-2">
                    {c.autor.nombre}
                    {c.es_mio && (
                      <button
                        onClick={() => borrarComentario(c.id_comentario)}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Borrar mi comentario"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground break-words whitespace-pre-line">{c.contenido}</p>
                </div>
              </div>
            ))}

            {puedeComentar ? (
              <div className="flex items-end gap-2 pt-1">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value.slice(0, LIMITES_COMUNIDAD.comentarioMax))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      enviarComentario();
                    }
                  }}
                  rows={1}
                  placeholder="Escribe un comentario..."
                  aria-label="Escribe un comentario"
                  className="flex-1 resize-none px-3 py-2 text-sm bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
                <button
                  onClick={enviarComentario}
                  disabled={!texto.trim() || enviando}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                  aria-label="Enviar comentario"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={onPedirLogin} className="text-xs font-medium text-primary hover:underline">
                Inicia sesión o crea tu cuenta para comentar
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
