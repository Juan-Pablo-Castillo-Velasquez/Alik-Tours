import { mensajeErrorEnvio } from "../../utils/validacionFormulario";
import { ImagePlus, Loader2, Video, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { reservaService } from "../../services/reserva.service";
import { tituloReserva } from "../../utils/reservaPresentacion";
import { toast } from "sonner";
import { comunidadService, duracionVideo, LIMITES_COMUNIDAD, PublicacionComunidad } from "../../services/comunidad.service";
import ModalBackdrop from "../ui/ModalBackdrop";
import Estrellas from "./Estrellas";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onPublicada: (p: PublicacionComunidad) => void;
}

const inputCls =
  "w-full px-3 py-2.5 text-sm bg-muted/30 border border-border text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";

const MB = 1024 * 1024;

export default function PublicarModal({ abierto, onCerrar, onPublicada }: Props) {
  const [titulo, setTitulo] = useState("");
  const [contenido, setContenido] = useState("");
  const [destino, setDestino] = useState("");
  const { usuario } = useAuth();
  // Viajes del cliente (no cancelados) para asociar la historia a lo que
  // reservó: así otros viajeros pueden reservar ese mismo paquete u hotel.
  const [viajes, setViajes] = useState<{ id: number; titulo: string; fechaFin: string; destino?: string | null }[]>([]);
  const [idReserva, setIdReserva] = useState<number | "">("");
  useEffect(() => {
    if (!abierto || usuario?.id_cliente == null) return;
    reservaService
      .getByCliente(usuario.id_cliente)
      .then((lista) => {
        const hoy = new Date().toISOString().slice(0, 10);
        const utiles = (lista as any[])
          .filter((r) => r.estado !== "cancelada" && (r.id_paquete != null || (r.reserva_habitaciones?.length ?? 0) > 0 || r.hotel_nombre))
          .sort((a, b) => String(b.fecha_inicio).localeCompare(String(a.fecha_inicio)))
          .map((r) => ({ id: r.id_reserva, titulo: tituloReserva(r), fechaFin: String(r.fecha_fin ?? ""), destino: r.destino }));
        setViajes(utiles);
        // Propone el viaje más reciente que ya terminó.
        const ultimo = utiles.find((v) => v.fechaFin && v.fechaFin <= hoy);
        if (ultimo) {
          setIdReserva((actual) => (actual === "" ? ultimo.id : actual));
        }
      })
      .catch(() => setViajes([]));
  }, [abierto, usuario?.id_cliente]);
  const [calificacion, setCalificacion] = useState(0);
  const [video, setVideo] = useState<File | null>(null);
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Vistas previas locales (se liberan al cambiar o cerrar).
  useEffect(() => {
    const urls = video ? [URL.createObjectURL(video)] : fotos.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [video, fotos]);

  const reiniciar = () => {
    setTitulo("");
    setContenido("");
    setDestino("");
    setIdReserva("");
    setCalificacion(0);
    setVideo(null);
    setFotos([]);
    setError(null);
  };

  const cerrar = () => {
    if (enviando) return;
    reiniciar();
    onCerrar();
  };

  const elegirVideo = async (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (file.size > LIMITES_COMUNIDAD.videoMaxBytes) {
      setError(`El video pesa ${(file.size / MB).toFixed(0)} MB; el máximo es 50 MB.`);
      return;
    }
    const segundos = await duracionVideo(file);
    if (segundos > LIMITES_COMUNIDAD.videoMaxSegundos + 1) {
      setError(`El video dura ${Math.round(segundos)} s; el máximo es 60 s.`);
      return;
    }
    setFotos([]);
    setVideo(file);
  };

  const elegirFotos = (lista: FileList | null) => {
    setError(null);
    if (!lista) return;
    const nuevas = Array.from(lista);
    const pesada = nuevas.find((f) => f.size > LIMITES_COMUNIDAD.fotoMaxBytes);
    if (pesada) {
      setError(`La foto «${pesada.name}» supera 5 MB.`);
      return;
    }
    const total = [...fotos, ...nuevas].slice(0, LIMITES_COMUNIDAD.maxFotos);
    if (fotos.length + nuevas.length > LIMITES_COMUNIDAD.maxFotos) {
      toast.info(`Máximo ${LIMITES_COMUNIDAD.maxFotos} fotos por publicación.`);
    }
    setVideo(null);
    setFotos(total);
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    if (titulo.trim().length < 3) return setError("El título debe tener al menos 3 caracteres.");
    if (contenido.trim().length < 10) return setError("Cuéntanos un poco más (mínimo 10 caracteres).");
    setEnviando(true);
    setProgreso(0);
    setError(null);
    try {
      const creada = await comunidadService.publicar({
        titulo: titulo.trim(),
        contenido: contenido.trim(),
        destino: destino.trim() || undefined,
        idReserva: idReserva === "" ? undefined : idReserva,
        calificacion: calificacion || undefined,
        video: video ?? undefined,
        imagenes: fotos,
        onProgreso: setProgreso,
      });
      toast.success("¡Gracias! Tu publicación quedará visible cuando nuestro equipo la revise.");
      onPublicada(creada);
      reiniciar();
      onCerrar();
    } catch (err: any) {
      setError(/demasiadas solicitudes/i.test(err?.message ?? "") ? mensajeErrorEnvio(err, "") : err?.message || "No se pudo publicar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (!abierto) return null;

  return (
    <ModalBackdrop zIndex={200} onClick={cerrar}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="bg-card text-card-foreground w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Comparte tu experiencia</h2>
          <button type="button" onClick={cerrar} className="p-1.5 rounded-lg hover:bg-muted" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Tu publicación se mostrará en la comunidad cuando nuestro equipo la revise. Se verá tu nombre y la inicial de
          tu apellido.
        </p>

        {error && <p className="rounded-xl bg-destructive/10 text-destructive text-sm px-3 py-2">{error}</p>}

        <div>
          <label htmlFor="pub-titulo" className="text-xs font-semibold text-muted-foreground">Título</label>
          <input id="pub-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={150}
            className={inputCls} placeholder="Ej. Una semana increíble en San Andrés" required />
        </div>
        {viajes.length > 0 && (
          <div>
            <label htmlFor="pub-viaje" className="text-xs font-semibold text-muted-foreground">
              ¿De qué viaje es tu historia?
            </label>
            <select
              id="pub-viaje"
              value={idReserva}
              onChange={(e) => setIdReserva(e.target.value ? Number(e.target.value) : "")}
              className={inputCls}
            >
              <option value="">Ninguno en particular</option>
              {viajes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.titulo}
                  {v.destino ? ` · ${v.destino}` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Aparecerá en tu publicación para que otros viajeros puedan reservar el mismo viaje.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="pub-destino" className="text-xs font-semibold text-muted-foreground">Destino (opcional)</label>
          <input id="pub-destino" value={destino} onChange={(e) => setDestino(e.target.value)} maxLength={120}
            className={inputCls} placeholder="Ej. San Andrés" />
        </div>
        <div>
          <label htmlFor="pub-contenido" className="text-xs font-semibold text-muted-foreground">Tu reseña</label>
          <textarea id="pub-contenido" value={contenido} onChange={(e) => setContenido(e.target.value)} maxLength={3000}
            rows={4} className={`${inputCls} resize-none`} placeholder="¿Qué fue lo mejor del viaje? ¿Lo recomendarías?" required />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground">Calificación (opcional)</span>
          <Estrellas valor={calificacion} onChange={setCalificacion} size={22} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border text-sm cursor-pointer hover:border-primary/50">
            <Video className="w-4 h-4 text-primary" /> Video (máx. 60 s)
            <input type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden"
              onChange={(e) => { elegirVideo(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border text-sm cursor-pointer hover:border-primary/50">
            <ImagePlus className="w-4 h-4 text-primary" /> Fotos (hasta 4)
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
              onChange={(e) => { elegirFotos(e.target.files); e.target.value = ""; }} />
          </label>
        </div>

        {video && previews[0] && (
          <div className="relative">
            <video src={previews[0]} controls playsInline className="w-full max-h-64 rounded-xl bg-black" />
            <button type="button" onClick={() => setVideo(null)} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white" aria-label="Quitar video">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {fotos.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {previews.map((src, i) => (
              <div key={src} className="relative">
                <img src={src} alt={`Foto ${i + 1}`} className="w-full aspect-square object-cover rounded-lg" />
                <button type="button" onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white" aria-label={`Quitar foto ${i + 1}`}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="submit" disabled={enviando}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60 inline-flex items-center justify-center gap-2">
          {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
          {enviando
            ? progreso > 0 && progreso < 100
              ? `Subiendo ${video ? "video" : "fotos"}... ${progreso}%`
              : "Publicando..."
            : "Enviar a revisión"}
        </button>
      </form>
    </ModalBackdrop>
  );
}
