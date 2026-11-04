import { Eye, EyeOff, Loader2, MessageSquareReply, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { FiltroResenasAdmin, resenaService, ResenaResponse } from "../../services/resena.service";
import Estrellas from "../comunidad/Estrellas";
import RespuestaAgencia from "../resenas/RespuestaAgencia";
import FilterChip from "../shared/FilterChip";
import EmptyState from "./ui/EmptyState";
import { inputCls } from "./types";

const FILTROS: { valor: FiltroResenasAdmin | undefined; label: string }[] = [
  { valor: "sin_responder", label: "Sin responder" },
  { valor: "bajas", label: "1 a 3 estrellas" },
  { valor: "ocultas", label: "Ocultas" },
  { valor: undefined, label: "Todas" },
];

function fecha(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString("es-CO", { dateStyle: "medium" }) : "";
}

/** Reseñas de clientes: responder en nombre de la agencia y ocultar las
 *  que no deben salir en el sitio (spam, datos personales...). */
export default function ModerarResenas() {
  const [filtro, setFiltro] = useState<FiltroResenasAdmin | undefined>("sin_responder");
  const [items, setItems] = useState<ResenaResponse[]>([]);
  const [cargando, setCargando] = useState(true);
  const [borradores, setBorradores] = useState<Record<number, string>>({});
  const [editando, setEditando] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setItems(await resenaService.adminListar(filtro));
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar las reseñas");
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const actualizar = (r: ResenaResponse) => setItems((prev) => prev.map((x) => (x.id_resena === r.id_resena ? r : x)));

  const responder = async (r: ResenaResponse, texto: string | null) => {
    setOcupado(r.id_resena);
    try {
      const nueva = await resenaService.adminResponder(r.id_resena, texto);
      toast.success(texto ? "Respuesta publicada: el cliente recibe un aviso" : "Respuesta quitada");
      setEditando(null);
      if (filtro === "sin_responder" && nueva.respuesta_agencia) {
        setItems((prev) => prev.filter((x) => x.id_resena !== r.id_resena));
      } else {
        actualizar(nueva);
      }
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar la respuesta");
    } finally {
      setOcupado(null);
    }
  };

  const alternarVisible = async (r: ResenaResponse) => {
    setOcupado(r.id_resena);
    try {
      const nueva = await resenaService.adminVisibilidad(r.id_resena, !r.visible);
      toast.success(nueva.visible ? "La reseña vuelve a verse en el sitio" : "Reseña oculta del sitio");
      if (filtro === "ocultas" && nueva.visible) setItems((prev) => prev.filter((x) => x.id_resena !== r.id_resena));
      else actualizar(nueva);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cambiar la visibilidad");
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((f) => (
          <FilterChip key={f.label} selected={filtro === f.valor} onClick={() => setFiltro(f.valor)}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      {cargando ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Star} title="Nada por aquí" description="No hay reseñas con este filtro." />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {items.map((r) => {
            const abierto = editando === r.id_resena || (!r.respuesta_agencia && filtro === "sin_responder");
            const borrador = borradores[r.id_resena] ?? r.respuesta_agencia ?? "";
            return (
              <article
                key={r.id_resena}
                className={`bg-card border border-border rounded-2xl p-4 space-y-2 ${r.visible === false ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{r.nombre_cliente}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.nombre_hotel ?? "Hotel"} · {fecha(r.fecha_creacion)}
                      {r.fecha_edicion ? " · editada" : ""}
                      {r.visible === false ? " · oculta del sitio" : ""}
                    </p>
                  </div>
                  <Estrellas valor={r.calificacion} size={13} />
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line break-words">{r.comentario}</p>

                {!abierto && <RespuestaAgencia respuesta={r.respuesta_agencia} fecha={r.fecha_respuesta} />}

                {abierto && (
                  <div className="space-y-2">
                    <textarea
                      value={borrador}
                      onChange={(e) => setBorradores((b) => ({ ...b, [r.id_resena]: e.target.value }))}
                      maxLength={1000}
                      rows={3}
                      placeholder="Respuesta pública de la agencia (la verá cualquiera en el sitio)"
                      aria-label={`Respuesta a la reseña de ${r.nombre_cliente}`}
                      className={`${inputCls} resize-none`}
                    />
                    <div className="flex gap-2">
                      <button
                        disabled={ocupado === r.id_resena || !borrador.trim()}
                        onClick={() => responder(r, borrador.trim())}
                        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-50"
                      >
                        Publicar respuesta
                      </button>
                      {editando === r.id_resena && (
                        <button onClick={() => setEditando(null)} className="px-3 py-1.5 rounded-lg border border-border text-xs">
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {!abierto && (
                    <button
                      onClick={() => setEditando(r.id_resena)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold"
                    >
                      <MessageSquareReply className="w-3.5 h-3.5" />
                      {r.respuesta_agencia ? "Editar respuesta" : "Responder"}
                    </button>
                  )}
                  {r.respuesta_agencia && (
                    <button
                      disabled={ocupado === r.id_resena}
                      onClick={() => responder(r, null)}
                      className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Quitar respuesta
                    </button>
                  )}
                  <button
                    disabled={ocupado === r.id_resena}
                    onClick={() => alternarVisible(r)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold ml-auto disabled:opacity-50"
                  >
                    {r.visible === false ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {r.visible === false ? "Mostrar en el sitio" : "Ocultar del sitio"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
