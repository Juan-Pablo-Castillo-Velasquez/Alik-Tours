import { ArrowDown, ArrowUp, Check, Clapperboard, Eye, EyeOff, Loader2, Trash2, Upload, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  comunidadService,
  EstadoPublicacion,
  LIMITES_COMUNIDAD,
  PublicacionComunidad,
  resolveMediaComunidad,
  VideoAgencia,
} from "../../services/comunidad.service";
import Estrellas from "../comunidad/Estrellas";
import FilterChip from "../shared/FilterChip";
import EmptyState from "./ui/EmptyState";
import SectionHeader from "./ui/SectionHeader";
import { inputCls, labelCls } from "./types";

type Pestana = "moderacion" | "videos";

const FILTROS: { estado: EstadoPublicacion; label: string }[] = [
  { estado: "pendiente", label: "Por revisar" },
  { estado: "aprobada", label: "Publicadas" },
  { estado: "rechazada", label: "Rechazadas" },
  { estado: "oculta", label: "Ocultas" },
];

function fecha(iso: string | null) {
  return iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" }) : "";
}

// Moderación de la comunidad (admin y asesores) + videos de la agencia
// (solo admin: si el backend responde 403 la pestaña se oculta).
export default function ModuleComunidad() {
  const [pestana, setPestana] = useState<Pestana>("moderacion");
  const [estado, setEstado] = useState<EstadoPublicacion>("pendiente");
  const [items, setItems] = useState<PublicacionComunidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [motivos, setMotivos] = useState<Record<number, string>>({});
  const [ocupado, setOcupado] = useState<number | null>(null);

  const [videos, setVideos] = useState<VideoAgencia[]>([]);
  const [puedeVideos, setPuedeVideos] = useState(true);
  const [form, setForm] = useState<{ titulo: string; descripcion: string; video: File | null; portada: File | null }>({
    titulo: "",
    descripcion: "",
    video: null,
    portada: null,
  });
  const [subiendo, setSubiendo] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await comunidadService.adminGetPublicaciones(estado));
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar las publicaciones");
    } finally {
      setCargando(false);
    }
  }, [estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cargarVideos = useCallback(async () => {
    try {
      setVideos(await comunidadService.adminGetVideos());
      setPuedeVideos(true);
    } catch {
      setPuedeVideos(false); // asesor sin rol admin
    }
  }, []);

  useEffect(() => {
    cargarVideos();
  }, [cargarVideos]);

  const moderar = async (p: PublicacionComunidad, nuevo: EstadoPublicacion) => {
    const motivo = motivos[p.id_publicacion]?.trim();
    if (nuevo === "rechazada" && !motivo) {
      toast.error("Escribe el motivo del rechazo: el cliente lo verá.");
      return;
    }
    setOcupado(p.id_publicacion);
    try {
      await comunidadService.adminModerar(p.id_publicacion, nuevo, motivo);
      toast.success(nuevo === "aprobada" ? "Publicación aprobada" : `Publicación marcada como ${nuevo}`);
      setItems((prev) => prev.filter((x) => x.id_publicacion !== p.id_publicacion));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo moderar");
    } finally {
      setOcupado(null);
    }
  };

  const borrar = async (p: PublicacionComunidad) => {
    if (!window.confirm(`¿Eliminar definitivamente «${p.titulo}» y sus archivos?`)) return;
    try {
      await comunidadService.adminBorrarPublicacion(p.id_publicacion);
      setItems((prev) => prev.filter((x) => x.id_publicacion !== p.id_publicacion));
      toast.success("Publicación eliminada");
    } catch (e: any) {
      toast.error(e?.message || "Solo un administrador puede eliminar publicaciones");
    }
  };

  const alternarComentario = async (idPub: number, idCom: number, oculto: boolean) => {
    try {
      const c = await comunidadService.adminOcultarComentario(idCom, oculto);
      setItems((prev) =>
        prev.map((p) =>
          p.id_publicacion === idPub
            ? { ...p, comentarios: p.comentarios.map((x) => (x.id_comentario === idCom ? { ...x, oculto: c.oculto } : x)) }
            : p,
        ),
      );
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el comentario");
    }
  };

  const subirVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.video || !form.titulo.trim()) return;
    if (form.video.size > LIMITES_COMUNIDAD.videoAgenciaMaxBytes) {
      toast.error("El video supera 80 MB. Comprímelo antes de subirlo.");
      return;
    }
    setSubiendo(true);
    try {
      await comunidadService.adminSubirVideo({
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || undefined,
        video: form.video,
        portada: form.portada ?? undefined,
      });
      setForm({ titulo: "", descripcion: "", video: null, portada: null });
      toast.success("Video publicado");
      cargarVideos();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo subir el video");
    } finally {
      setSubiendo(false);
    }
  };

  const editarVideo = async (v: VideoAgencia, cambios: Partial<VideoAgencia>) => {
    try {
      await comunidadService.adminEditarVideo(v.id_video, cambios);
      cargarVideos();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo actualizar el video");
    }
  };

  const mover = async (i: number, paso: -1 | 1) => {
    const j = i + paso;
    if (j < 0 || j >= videos.length) return;
    const a = videos[i];
    const b = videos[j];
    await Promise.all([
      comunidadService.adminEditarVideo(a.id_video, { orden: j }),
      comunidadService.adminEditarVideo(b.id_video, { orden: i }),
    ]).catch(() => toast.error("No se pudo reordenar"));
    cargarVideos();
  };

  const borrarVideo = async (v: VideoAgencia) => {
    if (!window.confirm(`¿Eliminar el video «${v.titulo}»?`)) return;
    try {
      await comunidadService.adminBorrarVideo(v.id_video);
      setVideos((prev) => prev.filter((x) => x.id_video !== v.id_video));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Comunidad y videos"
        subtitle="Revisa lo que publican los clientes antes de que salga en el sitio y administra los videos de la agencia"
      />

      <div className="flex gap-2 flex-wrap">
        <FilterChip selected={pestana === "moderacion"} onClick={() => setPestana("moderacion")} icon={<Users className="w-3.5 h-3.5" />}>
          Publicaciones de clientes
        </FilterChip>
        {puedeVideos && (
          <FilterChip selected={pestana === "videos"} onClick={() => setPestana("videos")} icon={<Clapperboard className="w-3.5 h-3.5" />} count={videos.length}>
            Videos de la agencia
          </FilterChip>
        )}
      </div>

      {pestana === "moderacion" ? (
        <>
          <div className="flex gap-2 flex-wrap">
            {FILTROS.map((f) => (
              <FilterChip key={f.estado} selected={estado === f.estado} onClick={() => setEstado(f.estado)}>
                {f.label}
              </FilterChip>
            ))}
          </div>

          {cargando ? (
            <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon={Users} title="Nada por aquí" description="No hay publicaciones en este estado." />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {items.map((p) => (
                <article key={p.id_publicacion} className="bg-card border border-border rounded-2xl overflow-hidden">
                  {p.video_url && (
                    <video src={resolveMediaComunidad(p.video_url)} controls preload="metadata" className="w-full max-h-80 bg-black" />
                  )}
                  {p.imagenes.length > 0 && (
                    <div className="grid grid-cols-4 gap-0.5">
                      {p.imagenes.map((u) => (
                        <a key={u} href={resolveMediaComunidad(u)} target="_blank" rel="noopener noreferrer">
                          <img src={resolveMediaComunidad(u)} alt="" className="w-full aspect-square object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold break-words">{p.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.autor.nombre} · {fecha(p.fecha_creacion)}
                          {p.destino ? ` · ${p.destino}` : ""}
                        </p>
                      </div>
                      {p.calificacion ? <Estrellas valor={p.calificacion} size={13} /> : null}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{p.contenido}</p>
                    {p.motivo_moderacion && <p className="text-xs text-muted-foreground">Motivo registrado: {p.motivo_moderacion}</p>}

                    {p.comentarios.length > 0 && (
                      <div className="border-t border-border pt-2 space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground">Comentarios ({p.comentarios.length})</p>
                        {p.comentarios.map((c) => (
                          <div key={c.id_comentario} className={`flex items-start justify-between gap-2 text-xs ${c.oculto ? "opacity-50" : ""}`}>
                            <span className="break-words"><strong>{c.autor.nombre}:</strong> {c.contenido}</span>
                            <button onClick={() => alternarComentario(p.id_publicacion, c.id_comentario, !c.oculto)}
                              className="shrink-0 p-1 rounded hover:bg-muted" title={c.oculto ? "Mostrar comentario" : "Ocultar comentario"}>
                              {c.oculto ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {(p.estado === "pendiente" || p.estado === "oculta" || p.estado === "rechazada") && (
                      <input
                        value={motivos[p.id_publicacion] ?? ""}
                        onChange={(e) => setMotivos((m) => ({ ...m, [p.id_publicacion]: e.target.value }))}
                        maxLength={300}
                        placeholder="Motivo (obligatorio si rechazas; el cliente lo verá)"
                        className={inputCls}
                      />
                    )}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {p.estado !== "aprobada" && (
                        <button disabled={ocupado === p.id_publicacion} onClick={() => moderar(p, "aprobada")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-semibold disabled:opacity-50">
                          <Check className="w-3.5 h-3.5" /> Aprobar
                        </button>
                      )}
                      {p.estado === "pendiente" && (
                        <button disabled={ocupado === p.id_publicacion} onClick={() => moderar(p, "rechazada")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold disabled:opacity-50">
                          <X className="w-3.5 h-3.5" /> Rechazar
                        </button>
                      )}
                      {p.estado === "aprobada" && (
                        <button disabled={ocupado === p.id_publicacion} onClick={() => moderar(p, "oculta")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold disabled:opacity-50">
                          <EyeOff className="w-3.5 h-3.5" /> Ocultar del sitio
                        </button>
                      )}
                      <button onClick={() => borrar(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-destructive text-xs font-semibold hover:bg-destructive/10 ml-auto">
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
          <form onSubmit={subirVideo} className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="font-semibold text-sm">Subir video de la agencia</p>
            <div>
              <label className={labelCls}>Título</label>
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={150} required className={inputCls} placeholder="Ej. Así fue nuestro viaje a Cartagena" />
            </div>
            <div>
              <label className={labelCls}>Descripción (opcional)</label>
              <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} maxLength={500} rows={2} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Video (MP4, MOV o WEBM, máx. 80 MB)</label>
              <input type="file" accept="video/mp4,video/quicktime,video/webm" required
                onChange={(e) => setForm({ ...form, video: e.target.files?.[0] ?? null })} className="text-xs w-full" />
            </div>
            <div>
              <label className={labelCls}>Portada (opcional)</label>
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setForm({ ...form, portada: e.target.files?.[0] ?? null })} className="text-xs w-full" />
            </div>
            <button type="submit" disabled={subiendo || !form.video}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {subiendo ? "Subiendo..." : "Publicar video"}
            </button>
          </form>

          {videos.length === 0 ? (
            <EmptyState icon={Clapperboard} title="Todavía no hay videos" description="Los videos activos aparecen en la página Comunidad del sitio, en este orden." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {videos.map((v, i) => (
                <div key={v.id_video} className={`bg-card border border-border rounded-2xl overflow-hidden ${v.activo ? "" : "opacity-60"}`}>
                  <video src={resolveMediaComunidad(v.video_url)} poster={resolveMediaComunidad(v.portada_url)} controls preload="metadata" className="w-full aspect-video object-cover bg-black" />
                  <div className="p-3 space-y-2">
                    <p className="text-sm font-semibold break-words">{v.titulo}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => mover(i, -1)} disabled={i === 0} className="p-1.5 rounded hover:bg-muted disabled:opacity-30" aria-label="Subir"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => mover(i, 1)} disabled={i === videos.length - 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-30" aria-label="Bajar"><ArrowDown className="w-4 h-4" /></button>
                      <button onClick={() => editarVideo(v, { activo: !v.activo })} className="ml-auto px-2 py-1 rounded-lg border border-border text-xs">
                        {v.activo ? "Ocultar" : "Mostrar"}
                      </button>
                      <button onClick={() => borrarVideo(v)} className="p-1.5 rounded text-destructive hover:bg-destructive/10" aria-label="Eliminar video"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
