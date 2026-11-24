import { ArrowRight, BedDouble, ChevronDown, MapPin, MessageCircle, Package, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { resolveFotoUrl } from "../admin/types";
import { useState } from "react";
import { toast } from "sonner";
import {
  ComentarioComunidad,
  comunidadService,
  PublicacionComunidad,
  resolveMediaComunidad,
} from "../../services/comunidad.service";
import EtiquetaEjemplo from "../EtiquetaEjemplo";
import ComentariosHilo from "./ComentariosHilo";
import Estrellas from "./Estrellas";
import { confirmar } from "../../utils/confirmar";

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
  // Cerrado de entrada: con las conversaciones abiertas el muro se volvía
  // muy largo. El botón muestra cuántos comentarios hay.
  const [abierto, setAbierto] = useState(false);
  const p = publicacion;

  const borrarPublicacion = async () => {
    if (!(await confirmar({ titulo: "¿Borrar esta publicación?", mensaje: "No se puede deshacer.", confirmar: "Borrar", peligro: true }))) return;
    try {
      await comunidadService.borrarPublicacion(p.id_publicacion);
      onBorrada?.(p.id_publicacion);
      toast.success("Publicación eliminada");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo borrar la publicación");
    }
  };

  const fotos = p.imagenes.map((url) => resolveMediaComunidad(url));
  const n = comentarios.length;

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm shadow-black/[0.03]">
      <header className="flex items-start gap-3 px-5 pt-5">
        <Avatar nombre={p.autor.nombre} foto={p.autor.foto} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
            {p.autor.nombre}
            {p.es_ejemplo && <EtiquetaEjemplo />}
          </p>
          <p className="text-xs text-muted-foreground">
            <time dateTime={p.fecha_creacion ?? undefined}>{fecha(p.fecha_creacion)}</time>
          </p>
        </div>
        {p.destino && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/[0.07] px-2.5 py-1 text-xs font-medium text-primary">
            <MapPin className="h-3 w-3" /> {p.destino}
          </span>
        )}
        {p.es_mia && onBorrada && (
          <button
            onClick={borrarPublicacion}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive"
            aria-label="Borrar mi publicación"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="px-5 pb-4 pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="break-words text-lg font-semibold leading-snug text-foreground">{p.titulo}</h3>
          {p.calificacion ? <Estrellas valor={p.calificacion} size={14} /> : null}
        </div>
        <p className="mt-1.5 whitespace-pre-line break-words text-[15px] leading-relaxed text-foreground/75">
          {p.contenido}
        </p>
      </div>

      {p.video_url && (
        <div className="px-5 pb-4">
          <video
            src={resolveMediaComunidad(p.video_url)}
            controls
            playsInline
            preload="metadata"
            className="max-h-[70vh] w-full rounded-2xl bg-black"
          />
        </div>
      )}
      {fotos.length > 0 && (
        <div className="px-5 pb-4">
          <div
            className={`grid gap-1.5 overflow-hidden rounded-2xl ${
              fotos.length === 1 ? "grid-cols-1" : fotos.length === 2 ? "h-64 grid-cols-2 sm:h-80" : "h-72 grid-cols-3 grid-rows-2 sm:h-96"
            }`}
          >
            {fotos.slice(0, 3).map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Foto ${i + 1} de ${p.titulo}`}
                loading="lazy"
                className={`h-full w-full bg-muted object-cover ${
                  fotos.length === 1
                    ? "aspect-[16/10]"
                    : fotos.length === 2
                      ? ""
                      : i === 0
                        ? "col-span-2 row-span-2"
                        : ""
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {p.viaje && (
        <div className="px-5 pb-4">
          <Link
            to={p.viaje.tipo === "paquete" ? `/package/${p.viaje.id}` : `/hotel/${p.viaje.id}`}
            className="group/viaje flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-2.5 pr-4 transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
          >
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary/10">
              <span className="absolute inset-0 flex items-center justify-center text-primary">
                {p.viaje.tipo === "paquete" ? <Package className="h-6 w-6" /> : <BedDouble className="h-6 w-6" />}
              </span>
              {p.viaje.imagen_url ? (
                <img
                  src={resolveFotoUrl(p.viaje.imagen_url)}
                  alt=""
                  loading="lazy"
                  className="relative h-full w-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium text-muted-foreground">
                {p.autor.nombre.split(" ")[0]} viajó con {p.viaje.tipo === "paquete" ? "el paquete" : "el hotel"}
              </span>
              <span className="block truncate text-sm font-semibold text-foreground">{p.viaje.nombre}</span>
              {p.viaje.precio_desde != null && (
                <span className="block text-xs text-muted-foreground">
                  Desde <b className="text-foreground">${Math.round(p.viaje.precio_desde).toLocaleString("es-CO")}</b>{" "}
                  {p.viaje.unidad_precio === "por_noche"
                    ? "por noche"
                    : p.viaje.unidad_precio === "por_paquete"
                      ? "el paquete"
                      : "por persona"}
                </span>
              )}
            </span>
            <span className="hidden shrink-0 items-center gap-1 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition group-hover/viaje:opacity-90 sm:inline-flex">
              Reservar este viaje <ArrowRight className="h-3.5 w-3.5" />
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-primary sm:hidden" />
          </Link>
        </div>
      )}

      <footer className="border-t border-border px-5 py-2.5">
        <button
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageCircle className="h-4 w-4" />
          {n === 0 ? "Comentar" : `${n} ${n === 1 ? "comentario" : "comentarios"}`}
          {n > 0 && <ChevronDown className={`h-4 w-4 transition-transform ${abierto ? "rotate-180" : ""}`} />}
        </button>

        {abierto && (
          <div className="pb-2 pt-3">
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
      </footer>
    </article>
  );
}
