import { BadgeCheck, CornerDownRight, Send, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ComentarioComunidad, LIMITES_COMUNIDAD, resolveMediaComunidad } from "../../services/comunidad.service";

interface Props {
  comentarios: ComentarioComunidad[];
  onChange: (comentarios: ComentarioComunidad[]) => void;
  /** Cliente con sesión o alguien del equipo. */
  puedeComentar: boolean;
  onPedirLogin: () => void;
  enviar: (contenido: string, idPadre?: number) => Promise<ComentarioComunidad>;
  borrar: (idComentario: number) => Promise<unknown>;
}

function fechaRelativa(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const minutos = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias < 7) return `hace ${dias} d`;
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ nombre, foto, equipo, chico }: { nombre: string; foto: string | null; equipo?: boolean; chico?: boolean }) {
  const src = resolveMediaComunidad(foto);
  const tam = chico ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  if (src) return <img src={src} alt="" className={`${tam} rounded-full object-cover shrink-0`} loading="lazy" />;
  return (
    <span
      className={`${tam} rounded-full font-bold flex items-center justify-center shrink-0 ${
        equipo ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
      }`}
    >
      {nombre.charAt(0).toUpperCase()}
    </span>
  );
}

/** Cuadro para escribir. Enter envía, Shift+Enter hace salto de línea. */
function Caja({
  placeholder,
  autoFocus,
  onEnviar,
  onCancelar,
}: {
  placeholder: string;
  autoFocus?: boolean;
  onEnviar: (texto: string) => Promise<boolean>;
  onCancelar?: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const candado = useRef(false); // contra doble Enter / doble clic

  const enviar = async () => {
    const contenido = texto.trim();
    if (!contenido || candado.current) return;
    candado.current = true;
    setEnviando(true);
    try {
      if (await onEnviar(contenido)) setTexto("");
    } finally {
      candado.current = false;
      setEnviando(false);
    }
  };

  const restantes = LIMITES_COMUNIDAD.comentarioMax - texto.length;
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 min-w-0">
        <textarea
          value={texto}
          autoFocus={autoFocus}
          onChange={(e) => setTexto(e.target.value.slice(0, LIMITES_COMUNIDAD.comentarioMax))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
            if (e.key === "Escape") onCancelar?.();
          }}
          rows={1}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full resize-none field-sizing-content min-h-[40px] max-h-40 px-3 py-2 text-sm bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        {restantes <= 80 && (
          <p className={`text-[11px] mt-0.5 ${restantes <= 0 ? "text-destructive" : "text-muted-foreground"}`}>
            {restantes} caracteres disponibles
          </p>
        )}
      </div>
      {onCancelar && (
        <button onClick={onCancelar} className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground">
          Cancelar
        </button>
      )}
      <button
        onClick={enviar}
        disabled={!texto.trim() || enviando}
        className="p-2.5 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
        aria-label="Enviar comentario"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}

/**
 * Hilo de comentarios con respuestas de un nivel. Lo usan las publicaciones
 * de los viajeros y los videos de la agencia. Los comentarios del equipo
 * salen con el sello de la agencia.
 */
export default function ComentariosHilo({ comentarios, onChange, puedeComentar, onPedirLogin, enviar, borrar }: Props) {
  const [respondiendoA, setRespondiendoA] = useState<number | null>(null);

  const { principales, respuestas } = useMemo(() => {
    const ids = new Set(comentarios.filter((c) => !c.id_padre).map((c) => c.id_comentario));
    const porPadre = new Map<number, ComentarioComunidad[]>();
    for (const c of comentarios) {
      if (c.id_padre && ids.has(c.id_padre)) porPadre.set(c.id_padre, [...(porPadre.get(c.id_padre) ?? []), c]);
    }
    return { principales: comentarios.filter((c) => !c.id_padre), respuestas: porPadre };
  }, [comentarios]);

  const publicar = async (texto: string, idPadre?: number) => {
    try {
      const nuevo = await enviar(texto, idPadre);
      onChange([...comentarios, nuevo]);
      setRespondiendoA(null);
      return true;
    } catch (e: any) {
      toast.error(e?.message || "No se pudo publicar el comentario");
      return false;
    }
  };

  const quitar = async (c: ComentarioComunidad) => {
    if (!window.confirm("¿Borrar tu comentario?")) return;
    try {
      await borrar(c.id_comentario);
      // Con el comentario se van sus respuestas (igual que en el servidor).
      onChange(comentarios.filter((x) => x.id_comentario !== c.id_comentario && x.id_padre !== c.id_comentario));
    } catch (e: any) {
      toast.error(e?.message || "No se pudo borrar el comentario");
    }
  };

  const item = (c: ComentarioComunidad, esRespuesta = false) => (
    <div key={c.id_comentario} className="flex gap-2.5">
      <Avatar nombre={c.autor.nombre} foto={c.autor.foto} equipo={c.autor.es_equipo} chico={esRespuesta} />
      <div className="min-w-0 flex-1">
        <div className={`rounded-xl px-3 py-2 ${c.autor.es_equipo ? "bg-primary/10 border border-primary/20" : "bg-muted/40"}`}>
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
            {c.autor.nombre}
            {c.autor.es_equipo && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                <BadgeCheck className="w-3 h-3" /> Agencia
              </span>
            )}
          </p>
          <p className="text-sm text-foreground/80 break-words whitespace-pre-line">{c.contenido}</p>
        </div>
        <div className="flex items-center gap-3 px-1 pt-0.5 text-[11px] text-muted-foreground">
          <span>{fechaRelativa(c.fecha_creacion)}</span>
          {!esRespuesta && (
            <button
              onClick={() => (puedeComentar ? setRespondiendoA(c.id_comentario) : onPedirLogin())}
              className="font-semibold hover:text-primary"
            >
              Responder
            </button>
          )}
          {c.es_mio && (
            <button
              onClick={() => quitar(c)}
              className="inline-flex items-center gap-1 hover:text-destructive"
              aria-label="Borrar mi comentario"
            >
              <Trash2 className="w-3 h-3" /> Borrar
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {principales.length === 0 && (
        <p className="text-xs text-muted-foreground">Todavía no hay comentarios. ¡Sé el primero!</p>
      )}
      {principales.map((c) => (
        <div key={c.id_comentario} className="space-y-2">
          {item(c)}
          {((respuestas.get(c.id_comentario)?.length ?? 0) > 0 || respondiendoA === c.id_comentario) && (
            <div className="ml-11 space-y-2 border-l-2 border-border pl-3">
              {(respuestas.get(c.id_comentario) ?? []).map((r) => item(r, true))}
              {respondiendoA === c.id_comentario && (
                <div className="flex items-start gap-1.5">
                  <CornerDownRight className="w-4 h-4 mt-3 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <Caja
                      autoFocus
                      placeholder={`Responder a ${c.autor.nombre}...`}
                      onEnviar={(t) => publicar(t, c.id_comentario)}
                      onCancelar={() => setRespondiendoA(null)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {puedeComentar ? (
        <Caja placeholder="Escribe un comentario..." onEnviar={(t) => publicar(t)} />
      ) : (
        <button onClick={onPedirLogin} className="text-xs font-medium text-primary hover:underline">
          Inicia sesión o crea tu cuenta para comentar
        </button>
      )}
    </div>
  );
}
