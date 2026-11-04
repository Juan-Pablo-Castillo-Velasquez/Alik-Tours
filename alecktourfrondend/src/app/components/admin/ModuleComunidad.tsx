import {
  ArrowDown,
  ArrowUp,
  Check,
  Clapperboard,
  Eye,
  EyeOff,
  Home,
  Loader2,
  MessageCircle,
  Star,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
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
import { PaqueteResponse, paqueteService } from "../../services/paquete.service";
import ComentariosHilo from "../comunidad/ComentariosHilo";
import Estrellas from "../comunidad/Estrellas";
import ModerarResenas from "./ModerarResenas";
import FilterChip from "../shared/FilterChip";
import EmptyState from "./ui/EmptyState";
import SectionHeader from "./ui/SectionHeader";
import { inputCls, labelCls } from "./types";

type Pestana = "moderacion" | "videos" | "resenas";

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
  const FORM_VACIO = { titulo: "", descripcion: "", video: null, portada: null, idPaquete: 0, mostrarInicio: false };
  const [form, setForm] = useState<{
    titulo: string;
    descripcion: string;
    video: File | null;
    portada: File | null;
    idPaquete: number;
    mostrarInicio: boolean;
  }>(FORM_VACIO);
  const [paquetes, setPaquetes] = useState<PaqueteResponse[]>([]);
  const [comentariosAbiertos, setComentariosAbiertos] = useState<number | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0);

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

  useEffect(() => {
    // Para asociar un video a su viaje (video promocional del paquete).
    paqueteService
      .getAll(0, 300)
      .then(setPaquetes)
      .catch(() => setPaquetes([]));
  }, []);

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

  const alternarComentarioVideo = async (idVideo: number, idCom: number, oculto: boolean) => {
    try {
      const c = await comunidadService.adminOcultarComentario(idCom, oculto);
      setVideos((prev) =>
        prev.map((v) =>
          v.id_video === idVideo
            ? { ...v, comentarios: v.comentarios.map((x) => (x.id_comentario === idCom ? { ...x, oculto: c.oculto } : x)) }
            : v,
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
    setProgreso(0);
    try {
      await comunidadService.adminSubirVideo({
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim() || undefined,
        video: form.video,
        portada: form.portada ?? undefined,
        idPaquete: form.idPaquete || null,
        mostrarInicio: form.mostrarInicio,
        onProgreso: setProgreso,
      });
      setForm(FORM_VACIO);
      toast.success("Video publicado");
      cargarVideos();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo subir el video");
    } finally {
      setSubiendo(false);
    }
  };

  const editarVideo = async (
    v: VideoAgencia,
    cambios: Partial<Pick<VideoAgencia, "activo" | "mostrar_inicio">> & { id_paquete?: number },
  ) => {
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
        <FilterChip selected={pestana === "resenas"} onClick={() => setPestana("resenas")} icon={<Star className="w-3.5 h-3.5" />}>
          Reseñas
        </FilterChip>
      </div>

      {pestana === "resenas" ? (
        <ModerarResenas />
      ) : pestana === "moderacion" ? (
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
            <div>
              <label className={labelCls} htmlFor="video-paquete">Video promocional del viaje (opcional)</label>
              <select id="video-paquete" value={form.idPaquete}
                onChange={(e) => setForm({ ...form, idPaquete: Number(e.target.value) })} className={inputCls}>
                <option value={0}>Ninguno: solo en la página Comunidad</option>
                {paquetes.map((p) => (
                  <option key={p.id_paquete} value={p.id_paquete}>{p.nombre_paquete}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">Sale también en la ficha de ese paquete.</p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.mostrarInicio}
                onChange={(e) => setForm({ ...form, mostrarInicio: e.target.checked })} />
              Mostrar también en la página de inicio
            </label>
            <button type="submit" disabled={subiendo || !form.video}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
              {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {subiendo ? (progreso > 0 && progreso < 100 ? `Subiendo... ${progreso}%` : "Procesando...") : "Publicar video"}
            </button>
          </form>

          {videos.length === 0 ? (
            <EmptyState icon={Clapperboard} title="Todavía no hay videos" description="Los videos activos aparecen en la página Comunidad del sitio (en este orden), en la ficha de su paquete y, si los marcas, en el inicio." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {videos.map((v, i) => (
                <div key={v.id_video} className={`bg-card border border-border rounded-2xl overflow-hidden ${v.activo ? "" : "opacity-60"}`}>
                  <video src={resolveMediaComunidad(v.video_url)} poster={resolveMediaComunidad(v.portada_url)} controls preload="metadata" className="w-full aspect-video object-cover bg-black" />
                  <div className="p-3 space-y-2">
                    <p className="text-sm font-semibold break-words">{v.titulo}</p>
                    <select
                      aria-label={`Paquete del video ${v.titulo}`}
                      value={v.id_paquete ?? 0}
                      onChange={(e) => editarVideo(v, { id_paquete: Number(e.target.value) })}
                      className={`${inputCls} text-xs py-1.5`}
                    >
                      <option value={0}>Sin paquete</option>
                      {paquetes.map((p) => (
                        <option key={p.id_paquete} value={p.id_paquete}>{p.nombre_paquete}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={v.mostrar_inicio}
                        onChange={(e) => editarVideo(v, { mostrar_inicio: e.target.checked })} />
                      <Home className="w-3.5 h-3.5" /> En la página de inicio
                    </label>
                    <div className="flex items-center gap-1">
                      <button onClick={() => mover(i, -1)} disabled={i === 0} className="p-1.5 rounded hover:bg-muted disabled:opacity-30" aria-label="Subir"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => mover(i, 1)} disabled={i === videos.length - 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-30" aria-label="Bajar"><ArrowDown className="w-4 h-4" /></button>
                      <button onClick={() => editarVideo(v, { activo: !v.activo })} className="ml-auto px-2 py-1 rounded-lg border border-border text-xs">
                        {v.activo ? "Ocultar" : "Mostrar"}
                      </button>
                      <button onClick={() => borrarVideo(v)} className="p-1.5 rounded text-destructive hover:bg-destructive/10" aria-label="Eliminar video"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <button
                      onClick={() => setComentariosAbiertos((id) => (id === v.id_video ? null : v.id_video))}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary"
                      aria-expanded={comentariosAbiertos === v.id_video}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {v.comentarios.length} comentario{v.comentarios.length === 1 ? "" : "s"} · responder
                    </button>
                    {comentariosAbiertos === v.id_video && (
                      <div className="border-t border-border pt-2 space-y-2">
                        {v.comentarios.filter((c) => c.oculto).map((c) => (
                          <div key={c.id_comentario} className="flex items-start justify-between gap-2 text-xs opacity-60">
                            <span className="break-words"><strong>{c.autor.nombre}</strong> (oculto): {c.contenido}</span>
                            <button onClick={() => alternarComentarioVideo(v.id_video, c.id_comentario, false)} className="shrink-0 p-1 rounded hover:bg-muted" title="Mostrar comentario">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <ComentariosHilo
                          comentarios={v.comentarios.filter((c) => !c.oculto)}
                          onChange={(nuevos) =>
                            setVideos((prev) =>
                              prev.map((x) =>
                                x.id_video === v.id_video
                                  ? { ...x, comentarios: [...x.comentarios.filter((c) => c.oculto), ...nuevos] }
                                  : x,
                              ),
                            )
                          }
                          puedeComentar
                          onPedirLogin={() => {}}
                          enviar={(texto, idPadre) => comunidadService.comentarVideo(v.id_video, texto, idPadre)}
                          borrar={comunidadService.borrarComentario}
                        />
                        {v.comentarios.some((c) => !c.oculto) && (
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold text-muted-foreground">Ocultar comentarios del sitio</p>
                            {v.comentarios.filter((c) => !c.oculto).map((c) => (
                              <div key={c.id_comentario} className="flex items-center justify-between gap-2 text-xs">
                                <span className="truncate">{c.autor.nombre}: {c.contenido}</span>
                                <button onClick={() => alternarComentarioVideo(v.id_video, c.id_comentario, true)} className="shrink-0 p-1 rounded hover:bg-muted" title="Ocultar comentario">
                                  <EyeOff className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
