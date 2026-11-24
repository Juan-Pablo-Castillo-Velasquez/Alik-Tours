import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Flag,
  Inbox,
  Loader2,
  Lock,
  MessageSquare,
  PhoneCall,
  Search,
  Send,
  Smile,
  Sparkles,
  Tags,
  Trash2,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  pqrService,
  type DecisionPqr,
  type FiltrosGestionPqr,
  type PqrCategoria,
  type PqrDetalle,
  type PqrPagina,
  type TipoPqr,
} from "../../services/pqr.service";
import { DECISION_PQR, fechaCorta, TIPOS_PQR } from "../../utils/pqr";
import { codigoReserva } from "../../utils/reservaPresentacion";
import { EstadoPqrBadge, EtiquetaEjemplo, HiloPqr, PlazoCorto, PlazoDetalle } from "../pqr/PqrPiezas";
import Pagination from "../ui/pagination";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import ContadorCaracteres from "../ui/ContadorCaracteres";
import AdminModal from "./ui/AdminModal";
import ClienteCombobox, { type ClienteBusqueda } from "./ui/ClienteCombobox";
import EmptyState from "./ui/EmptyState";
import SectionHeader from "./ui/SectionHeader";
import StatCard from "./ui/StatCard";
import { inputCls, labelCls } from "./types";

const POR_PAGINA = 10;
const mensajeError = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto);

type Accion = "mensaje" | "nota" | "informacion" | "prorroga" | "respuesta" | "cierre";

export default function ModulePqr({
  usuarioId,
  esAdmin = false,
}: {
  usuarioId?: number;
  esAdmin?: boolean;
}) {
  const [filtros, setFiltros] = useState<FiltrosGestionPqr>({ estado: "abiertas", page: 1, page_size: POR_PAGINA });
  const [busqueda, setBusqueda] = useState("");
  const [datos, setDatos] = useState<PqrPagina | null>(null);
  const [cargando, setCargando] = useState(true);
  const [abierta, setAbierta] = useState<number | null>(null);
  const [radicar, setRadicar] = useState(false);
  const [responsables, setResponsables] = useState<{ id_usuario: number; nombre: string }[]>([]);
  const [catalogo, setCatalogo] = useState<PqrCategoria[]>([]);
  const [ejemplos, setEjemplos] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await pqrService.gestion(filtros));
    } catch (e) {
      toast.error(mensajeError(e, "No se pudieron cargar las PQR"));
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    pqrService.responsables().then(setResponsables).catch(() => {});
    pqrService.tipificaciones().then(setCatalogo).catch(() => {});
  }, []);

  // Búsqueda con espera corta para no pedir en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setFiltros((f) => (f.q === busqueda.trim() ? f : { ...f, q: busqueda.trim() || undefined, page: 1 }));
    }, 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const filtrar = (cambio: Partial<FiltrosGestionPqr>) => setFiltros((f) => ({ ...f, ...cambio, page: 1 }));
  const r = datos?.resumen;
  const pageCount = datos ? Math.max(1, Math.ceil(datos.total / POR_PAGINA)) : 1;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="PQR"
        subtitle="Peticiones, quejas, reclamos, sugerencias y felicitaciones, con su plazo legal en días hábiles."
        action={
          <div className="flex flex-wrap gap-2">
            {esAdmin && (
              <button
                type="button"
                onClick={() => setEjemplos(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <Sparkles className="h-4 w-4" /> Cargar ejemplos
              </button>
            )}
            <button
              type="button"
              onClick={() => setRadicar(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <PhoneCall className="h-4 w-4" /> Radicar por un cliente
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Abiertas"
          value={r?.abiertas ?? "—"}
          icon={Inbox}
          sub={r ? `${r.sin_asignar} sin responsable` : undefined}
          onClick={() => filtrar({ estado: "abiertas", plazo: undefined, responsable: undefined })}
        />
        <StatCard
          label="Vencen en 3 días hábiles"
          value={r?.por_vencer ?? "—"}
          icon={Clock3}
          gradient="from-warning to-[#d08a1f]"
          subColor="text-warning"
          sub={r?.por_vencer ? "Prioriza estas" : "Nada urgente"}
          onClick={() => filtrar({ estado: undefined, plazo: "por_vencer" })}
        />
        <StatCard
          label="Vencidas sin responder"
          value={r?.vencidas ?? "—"}
          icon={AlertTriangle}
          gradient="from-destructive to-[#b4232f]"
          subColor={r?.vencidas ? "text-destructive" : "text-muted-foreground"}
          sub={r?.vencidas ? "Fuera del plazo legal" : "Al día"}
          onClick={() => filtrar({ estado: undefined, plazo: "vencidas" })}
        />
        <StatCard
          label="Respondidas a tiempo"
          value={r?.a_tiempo_pct != null ? `${r.a_tiempo_pct}%` : "—"}
          icon={CheckCircle2}
          gradient="from-success to-[#1f8a5b]"
          sub={
            r?.satisfaccion_promedio != null
              ? `Satisfacción ${r.satisfaccion_promedio}/5 · ${r.respondidas} respondidas`
              : `${r?.respondidas ?? 0} respondidas`
          }
          onClick={() => filtrar({ estado: "finalizadas", plazo: undefined })}
        />
      </div>

      {r && r.ejemplos > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-foreground">
            Hay <strong>{r.ejemplos}</strong> PQR de ejemplo, marcadas «Ejemplo». Cuentan en estos indicadores.
          </span>
          {esAdmin && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const { borradas } = await pqrService.borrarEjemplos();
                  toast.success(`Se borraron ${borradas} PQR de ejemplo`);
                  cargar();
                } catch (e) {
                  toast.error(mensajeError(e, "No se pudieron borrar"));
                }
              }}
              className="ml-auto inline-flex items-center gap-1.5 font-semibold text-destructive hover:underline"
            >
              <Trash2 className="h-4 w-4" /> Quitar ejemplos
            </button>
          )}
        </div>
      )}

      {r && r.por_categoria.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tags className="h-4 w-4 text-primary" /> Motivos más frecuentes
            </h3>
            {r.sin_tipificar > 0 && (
              <button
                type="button"
                onClick={() => filtrar({ categoria: "sin", estado: "abiertas" })}
                className="text-xs font-semibold text-warning hover:underline"
              >
                {r.sin_tipificar} abiertas sin tipificar
              </button>
            )}
          </div>
          <ul className="grid gap-x-8 gap-y-2.5 md:grid-cols-2">
            {r.por_categoria.slice(0, 6).map((c) => {
              const max = r.por_categoria[0].total;
              return (
                <li key={c.categoria}>
                  <button
                    type="button"
                    onClick={() => filtrar({ categoria: c.categoria, estado: undefined })}
                    className="group w-full text-left"
                  >
                    <span className="flex justify-between text-sm">
                      <span className="text-foreground group-hover:text-primary">{c.nombre}</span>
                      <span className="font-semibold tabular-nums text-foreground">{c.total}</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(6, (c.total / max) * 100)}%` }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              maxLength={100}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Radicado, asunto, cliente o cédula"
              aria-label="Buscar PQR"
              className={`${inputCls} pl-9`}
            />
          </div>
          <select
            aria-label="Estado"
            value={filtros.estado ?? ""}
            onChange={(e) => filtrar({ estado: e.target.value || undefined })}
            className={inputCls}
          >
            <option value="">Todos los estados</option>
            <option value="abiertas">Abiertas</option>
            <option value="radicada">Radicadas</option>
            <option value="en_tramite">En trámite</option>
            <option value="esperando_cliente">Esperando al cliente</option>
            <option value="finalizadas">Finalizadas</option>
            <option value="respondida">Respondidas</option>
            <option value="cerrada">Cerradas</option>
            <option value="desistida">Desistidas</option>
          </select>
          <select
            aria-label="Tipo"
            value={filtros.tipo ?? ""}
            onChange={(e) => filtrar({ tipo: e.target.value || undefined })}
            className={inputCls}
          >
            <option value="">Todos los tipos</option>
            {TIPOS_PQR.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Categoría"
            value={filtros.categoria ?? ""}
            onChange={(e) => filtrar({ categoria: e.target.value || undefined })}
            className={inputCls}
          >
            <option value="">Todas las categorías</option>
            <option value="sin">Sin tipificar</option>
            {catalogo.map((c) => (
              <option key={c.categoria} value={c.categoria}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Responsable"
            value={filtros.responsable ?? ""}
            onChange={(e) => filtrar({ responsable: e.target.value || undefined })}
            className={inputCls}
          >
            <option value="">Cualquier responsable</option>
            <option value="yo">Asignadas a mí</option>
            <option value="sin">Sin responsable</option>
            {responsables.map((p) => (
              <option key={p.id_usuario} value={String(p.id_usuario)}>
                {p.nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Plazo"
            value={filtros.plazo ?? ""}
            onChange={(e) => filtrar({ plazo: e.target.value || undefined })}
            className={inputCls}
          >
            <option value="">Cualquier plazo</option>
            <option value="por_vencer">Por vencer</option>
            <option value="vencidas">Vencidas</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {cargando && !datos ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : !datos || datos.items.length === 0 ? (
          <EmptyState
            icon={FileQuestion}
            title="No hay PQR con estos filtros"
            description="Cuando un cliente radique una solicitud aparecerá aquí con su plazo de respuesta."
          />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Solicitud</span>
              <span>Cliente</span>
              <span>Estado</span>
              <span>Plazo</span>
              <span>Responsable</span>
            </div>
            <ul className={`divide-y divide-border ${cargando ? "opacity-60" : ""}`}>
              {datos.items.map((p) => (
                <li key={p.id_pqr}>
                  <button
                    type="button"
                    onClick={() => setAbierta(p.id_pqr)}
                    className="grid w-full gap-2 px-5 py-4 text-left transition-colors hover:bg-muted/40 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-4"
                  >
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap font-mono font-semibold">{p.radicado}</span>
                        <span className="truncate">· {p.tipo_nombre}</span>
                        {p.prioridad === "alta" && (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-destructive">
                            <Flag className="h-3 w-3" /> Alta
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className="truncate font-semibold text-foreground">{p.asunto}</span>
                        {p.es_ejemplo && <EtiquetaEjemplo />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs">
                        {p.categoria_nombre ? (
                          <span className="text-muted-foreground">
                            {p.categoria_nombre} → {p.motivo}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-medium text-warning">
                            <Tags className="h-3 w-3" /> Sin tipificar
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="truncate text-sm text-foreground">
                      {p.cliente_nombre ?? `Cliente #${p.id_cliente}`}
                      {p.canal !== "web" && <span className="ml-1 text-xs text-muted-foreground">({p.canal})</span>}
                    </span>
                    <span>
                      <EstadoPqrBadge estado={p.estado} vista="equipo" />
                    </span>
                    <span className="flex flex-col">
                      <PlazoCorto pqr={p} />
                      {p.estado_plazo !== "pausada" && (
                        <span className="text-xs text-muted-foreground">Límite {fechaCorta(p.fecha_vencimiento)}</span>
                      )}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {p.responsable_nombre ?? (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <UserX className="h-3.5 w-3.5" /> Sin asignar
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-border px-5 py-3">
              <Pagination
                page={(filtros.page ?? 1) - 1}
                pageCount={pageCount}
                onPageChange={(p) => setFiltros((f) => ({ ...f, page: p + 1 }))}
                total={datos.total}
                pageSize={POR_PAGINA}
                etiqueta="PQR"
              />
            </div>
          </>
        )}
      </div>

      <Dialog open={abierta != null} onOpenChange={(o) => !o && setAbierta(null)}>
        <DialogContent className="flex max-h-[92vh] w-full max-w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 shadow-2xl sm:max-w-5xl">
          {abierta != null && (
            <DetalleGestion
              id={abierta}
              catalogo={catalogo}
              responsables={responsables}
              usuarioId={usuarioId}
              onCambio={cargar}
            />
          )}
        </DialogContent>
      </Dialog>

      <CargarEjemplos
        open={ejemplos}
        onOpenChange={setEjemplos}
        onListo={(n) => {
          setEjemplos(false);
          toast.success(`Se crearon ${n} PQR de ejemplo`);
          filtrar({ estado: undefined, plazo: undefined, categoria: undefined, responsable: undefined });
        }}
      />

      <RadicarPorCliente
        open={radicar}
        onOpenChange={setRadicar}
        onRadicada={(p) => {
          setRadicar(false);
          toast.success(`Radicada ${p.radicado}`);
          cargar();
          setAbierta(p.id_pqr);
        }}
      />
    </div>
  );
}

// ─── Detalle con acciones ─────────────────────────────────────────────────

function DetalleGestion({
  id,
  catalogo,
  responsables,
  usuarioId,
  onCambio,
}: {
  id: number;
  catalogo: PqrCategoria[];
  responsables: { id_usuario: number; nombre: string }[];
  usuarioId?: number;
  onCambio: () => void;
}) {
  const [pqr, setPqr] = useState<PqrDetalle | null>(null);
  const [accion, setAccion] = useState<Accion>("mensaje");
  const [texto, setTexto] = useState("");
  const [dias, setDias] = useState(5);
  const [decision, setDecision] = useState<DecisionPqr>("favorable");
  const [enviando, setEnviando] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setCategoria(pqr?.categoria ?? "");
    setMotivo(pqr?.motivo ?? "");
  }, [pqr?.categoria, pqr?.motivo]);

  useEffect(() => {
    pqrService.ver(id).then(setPqr).catch((e) => toast.error(mensajeError(e, "No se pudo abrir la PQR")));
  }, [id]);

  useEffect(() => {
    setTexto("");
  }, [accion]);

  const ejecutar = async (fn: () => Promise<PqrDetalle>, ok: string) => {
    setEnviando(true);
    try {
      const nuevo = await fn();
      setPqr(nuevo);
      setTexto("");
      toast.success(ok);
      onCambio();
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo completar la acción"));
    } finally {
      setEnviando(false);
    }
  };

  if (!pqr) {
    return (
      <div className="flex h-72 items-center justify-center" role="status">
        <DialogTitle className="sr-only">Cargando PQR</DialogTitle>
        <DialogDescription className="sr-only">Cargando el detalle de la solicitud</DialogDescription>
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  const abierta = ["radicada", "en_tramite", "esperando_cliente"].includes(pqr.estado);
  const decisiones: DecisionPqr[] =
    pqr.tipo === "reclamo" ? ["favorable", "parcial", "desfavorable"] : ["favorable", "parcial", "desfavorable", "informativa"];
  const acciones: { id: Accion; texto: string; visible: boolean }[] = [
    { id: "mensaje", texto: "Escribir al cliente", visible: abierta },
    { id: "nota", texto: "Nota interna", visible: abierta },
    { id: "respuesta", texto: "Respuesta de fondo", visible: abierta && pqr.estado !== "esperando_cliente" },
    { id: "informacion", texto: "Pedir información", visible: pqr.puede_solicitar_informacion },
    { id: "prorroga", texto: "Ampliar plazo", visible: pqr.puede_prorrogar },
    { id: "cierre", texto: "Cerrar", visible: pqr.estado === "respondida" || pqr.estado === "esperando_cliente" },
  ];
  const visibles = acciones.filter((a) => a.visible);
  const actual = visibles.find((a) => a.id === accion) ? accion : visibles[0]?.id;

  const minimo: Record<Accion, number> = {
    mensaje: 2,
    nota: 2,
    informacion: 20,
    prorroga: 20,
    respuesta: decision === "parcial" || decision === "desfavorable" ? 80 : 30,
    cierre: 10,
  };
  // Mismos máximos que el backend (schemas/pqr_schema.py).
  const maximo: Record<Accion, number> = {
    mensaje: 3000,
    nota: 3000,
    informacion: 2000,
    prorroga: 2000,
    respuesta: 8000,
    cierre: 1000,
  };
  const tipificada = !!pqr.categoria;
  const listo =
    (actual ? texto.trim().length >= minimo[actual] : false) && (actual !== "respuesta" || tipificada);
  const motivos = catalogo.find((c) => c.categoria === categoria)?.motivos ?? [];
  const cambioTipificacion = categoria !== (pqr.categoria ?? "") || motivo !== (pqr.motivo ?? "");

  const enviar = () => {
    const t = texto.trim();
    switch (actual) {
      case "mensaje":
        return ejecutar(() => pqrService.escribir(pqr.id_pqr, t), "Mensaje enviado al cliente");
      case "nota":
        return ejecutar(() => pqrService.escribir(pqr.id_pqr, t, true), "Nota interna guardada");
      case "informacion":
        return ejecutar(() => pqrService.solicitarInformacion(pqr.id_pqr, t), "Le pedimos la información al cliente");
      case "prorroga":
        return ejecutar(() => pqrService.prorrogar(pqr.id_pqr, dias, t), "Plazo ampliado y cliente notificado");
      case "respuesta":
        return ejecutar(() => pqrService.responder(pqr.id_pqr, decision, t), "Respuesta enviada al cliente");
      case "cierre":
        return ejecutar(() => pqrService.cerrar(pqr.id_pqr, t), "PQR cerrada");
    }
  };

  const placeholder: Record<Accion, string> = {
    mensaje: "Lo verá el cliente en su perfil y le llegará por correo.",
    nota: "Solo la ve el equipo. Ej.: Llamé al hotel, quedan de confirmar mañana.",
    informacion: "Qué dato o documento falta y para qué. El plazo se pausa hasta que el cliente responda.",
    prorroga: "Motivo de la demora. El cliente recibe el motivo y la nueva fecha.",
    respuesta:
      decision === "parcial" || decision === "desfavorable"
        ? "Explica los motivos de hecho y de derecho por los que no se accede a todo lo pedido."
        : "Respuesta clara y completa a lo que pidió el cliente.",
    cierre:
      pqr.estado === "esperando_cliente"
        ? "Solo procede si pasó un mes sin respuesta del cliente (desistimiento tácito)."
        : "Motivo del cierre. Ej.: Cliente no calificó en 10 días.",
  };

  return (
    <>
      <header className="border-b border-border bg-card px-6 py-5 pr-14">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">{pqr.radicado}</span>
          <span>· {pqr.tipo_nombre}</span>
          <span>· canal {pqr.canal}</span>
          {pqr.es_ejemplo && <EtiquetaEjemplo />}
          <EstadoPqrBadge estado={pqr.estado} vista="equipo" />
        </div>
        <DialogTitle className="mt-1.5 text-xl font-bold tracking-tight text-foreground md:text-2xl">{pqr.asunto}</DialogTitle>
        <DialogDescription className="mt-0.5 text-sm text-muted-foreground">
          {pqr.cliente_nombre ?? `Cliente #${pqr.id_cliente}`} · radicada el {fechaCorta(pqr.fecha_radicacion)}
          {pqr.id_reserva ? ` · ${codigoReserva(pqr.id_reserva)}` : ""}
        </DialogDescription>
      </header>

      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:overflow-hidden">
      <div className="space-y-5 p-6 lg:overflow-y-auto">
        <PlazoDetalle pqr={pqr} vista="equipo" />

        {abierta && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pqr-responsable" className={labelCls}>
                Responsable
              </label>
              <select
                id="pqr-responsable"
                value={pqr.id_responsable ?? 0}
                onChange={(e) =>
                  ejecutar(() => pqrService.actualizar(pqr.id_pqr, { id_responsable: Number(e.target.value) }), "Responsable actualizado")
                }
                className={inputCls}
              >
                <option value={0}>Sin asignar</option>
                {responsables.map((p) => (
                  <option key={p.id_usuario} value={p.id_usuario}>
                    {p.nombre}
                    {p.id_usuario === usuarioId ? " (yo)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pqr-prioridad" className={labelCls}>
                Prioridad
              </label>
              <select
                id="pqr-prioridad"
                value={pqr.prioridad}
                onChange={(e) =>
                  ejecutar(
                    () => pqrService.actualizar(pqr.id_pqr, { prioridad: e.target.value as "normal" | "alta" }),
                    "Prioridad actualizada",
                  )
                }
                className={inputCls}
              >
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            {pqr.estado === "radicada" && (
              <button
                type="button"
                onClick={() => ejecutar(() => pqrService.actualizar(pqr.id_pqr, { estado: "en_tramite" }), "PQR en trámite")}
                className="rounded-xl border border-primary/40 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/5 sm:col-span-2"
              >
                Tomar y poner en trámite
              </button>
            )}
          </div>
        )}

        <section
          className={`rounded-xl border p-4 ${tipificada ? "border-border bg-card" : "border-warning/50 bg-warning/5"}`}
          aria-label="Tipificación"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Tags className="h-4 w-4 text-primary" /> Tipificación
            </p>
            {!tipificada && <span className="text-xs font-medium text-warning">Obligatoria para responder</span>}
          </div>
          {abierta ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <label htmlFor="pqr-categoria" className={labelCls}>
                  Categoría
                </label>
                <select
                  id="pqr-categoria"
                  value={categoria}
                  onChange={(e) => {
                    setCategoria(e.target.value);
                    setMotivo("");
                  }}
                  className={inputCls}
                >
                  <option value="">Elige…</option>
                  {catalogo.map((c) => (
                    <option key={c.categoria} value={c.categoria}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pqr-motivo" className={labelCls}>
                  Motivo
                </label>
                <select
                  id="pqr-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  disabled={!categoria}
                  className={inputCls}
                >
                  <option value="">Elige…</option>
                  {motivos.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!categoria || !motivo || !cambioTipificacion || enviando}
                onClick={() =>
                  ejecutar(() => pqrService.actualizar(pqr.id_pqr, { categoria, motivo }), "PQR tipificada")
                }
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-foreground">
              {pqr.categoria_nombre ? `${pqr.categoria_nombre} → ${pqr.motivo}` : "Sin tipificar"}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lo que pide el cliente</p>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">{pqr.descripcion}</p>
          {pqr.pretension && (
            <p className="mt-3 rounded-lg bg-muted/60 p-3 text-sm text-foreground">
              <span className="font-semibold">Pretensión: </span>
              {pqr.pretension}
            </p>
          )}
        </section>

        {pqr.respuesta && pqr.decision && (
          <section className={`rounded-xl border p-4 ${DECISION_PQR[pqr.decision].clase}`}>
            <p className="text-sm font-bold">{DECISION_PQR[pqr.decision].texto}</p>
            <p className="mt-2 whitespace-pre-line text-sm text-foreground">{pqr.respuesta}</p>
            {pqr.satisfaccion && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-foreground">
                <Smile className="h-4 w-4" /> Calificación del cliente: {pqr.satisfaccion}/5
                {pqr.comentario_satisfaccion ? ` — ${pqr.comentario_satisfaccion}` : ""}
              </p>
            )}
          </section>
        )}

        {visibles.length > 0 && actual && (
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Acción">
              {visibles.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={actual === a.id}
                  onClick={() => setAccion(a.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    actual === a.id ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/70"
                  }`}
                >
                  {a.id === "nota" && <Lock className="mr-1 inline h-3 w-3" />}
                  {a.id === "prorroga" && <CalendarPlus className="mr-1 inline h-3 w-3" />}
                  {a.id === "mensaje" && <MessageSquare className="mr-1 inline h-3 w-3" />}
                  {a.texto}
                </button>
              ))}
            </div>

            {actual === "respuesta" && !tipificada && (
              <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
                Primero tipifica la PQR (categoría y motivo) para poder dar la respuesta.
              </p>
            )}
            {actual === "respuesta" && (
              <div className="mb-3">
                <label htmlFor="pqr-decision" className={labelCls}>
                  Decisión {pqr.tipo === "reclamo" && "(en un reclamo debe ser expresa)"}
                </label>
                <select
                  id="pqr-decision"
                  value={decision}
                  onChange={(e) => setDecision(e.target.value as DecisionPqr)}
                  className={inputCls}
                >
                  {decisiones.map((d) => (
                    <option key={d} value={d}>
                      {DECISION_PQR[d].texto}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {actual === "prorroga" && (
              <div className="mb-3">
                <label htmlFor="pqr-dias" className={labelCls}>
                  Días hábiles adicionales (máximo {pqr.dias_termino})
                </label>
                <input
                  id="pqr-dias"
                  type="number"
                  min={1}
                  max={pqr.dias_termino}
                  value={dias}
                  onChange={(e) => setDias(Math.min(pqr.dias_termino, Math.max(1, Number(e.target.value) || 1)))}
                  className={inputCls}
                />
              </div>
            )}
            <label htmlFor="pqr-texto" className="sr-only">
              Texto
            </label>
            <textarea
              maxLength={maximo[actual]}
              id="pqr-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={actual === "respuesta" ? 7 : 4}
              placeholder={placeholder[actual]}
              className={`${inputCls} resize-y ${actual === "nota" ? "border-warning/50 bg-warning/5" : ""}`}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className={`text-xs ${listo ? "text-muted-foreground" : "text-muted-foreground/80"}`}>
                {texto.trim().length < minimo[actual]
                  ? `Mínimo ${minimo[actual]} caracteres · ${texto.length}/${maximo[actual].toLocaleString("es-CO")}`
                  : `${texto.length.toLocaleString("es-CO")}/${maximo[actual].toLocaleString("es-CO")}`}
              </span>
              <button
                type="button"
                disabled={!listo || enviando}
                onClick={enviar}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {actual === "respuesta" ? "Enviar respuesta" : actual === "nota" ? "Guardar nota" : "Enviar"}
              </button>
            </div>
          </section>
        )}

      </div>
        <aside className="border-t border-border bg-muted/30 p-6 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Historial">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Historial</h3>
          <HiloPqr actuaciones={pqr.actuaciones} vista="equipo" />
        </aside>
      </div>
    </>
  );
}

// ─── Radicar en nombre de un cliente ─────────────────────────────────────

function RadicarPorCliente({
  open,
  onOpenChange,
  onRadicada,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onRadicada: (p: PqrDetalle) => void;
}) {
  const [cliente, setCliente] = useState<ClienteBusqueda | null>(null);
  const [tipo, setTipo] = useState<TipoPqr>("peticion");
  const [canal, setCanal] = useState<"telefono" | "presencial" | "correo" | "whatsapp">("telefono");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pretension, setPretension] = useState("");
  const [autoriza, setAutoriza] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const listo =
    !!cliente &&
    asunto.trim().length >= 5 &&
    descripcion.trim().length >= 20 &&
    (tipo !== "reclamo" || pretension.trim().length >= 10) &&
    autoriza;

  const enviar = async () => {
    setEnviando(true);
    try {
      const p = await pqrService.radicar({
        tipo,
        canal,
        id_cliente: cliente!.id_cliente,
        asunto: asunto.trim(),
        descripcion: descripcion.trim(),
        pretension: pretension.trim() || undefined,
        autoriza_datos: autoriza,
      });
      onRadicada(p);
      setCliente(null);
      setAsunto("");
      setDescripcion("");
      setPretension("");
      setAutoriza(false);
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo radicar"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <AdminModal
      open={open}
      onOpenChange={onOpenChange}
      title="Radicar PQR por un cliente"
      description="Para solicitudes que llegan por teléfono, en persona, por correo o por WhatsApp. El cliente la verá en su perfil."
      maxWidth="sm:max-w-2xl"
      footer={
        <button
          type="button"
          disabled={!listo || enviando}
          onClick={enviar}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Radicar
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <ClienteCombobox value={cliente} onChange={setCliente} />
        </div>
        <div>
          <label htmlFor="rad-tipo" className={labelCls}>
            Tipo
          </label>
          <select id="rad-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoPqr)} className={inputCls}>
            {TIPOS_PQR.map((t) => (
              <option key={t.tipo} value={t.tipo}>
                {t.nombre} ({t.dias} días hábiles)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="rad-canal" className={labelCls}>
            Canal
          </label>
          <select id="rad-canal" value={canal} onChange={(e) => setCanal(e.target.value as typeof canal)} className={inputCls}>
            <option value="telefono">Teléfono</option>
            <option value="presencial">Presencial</option>
            <option value="correo">Correo</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="rad-asunto" className={labelCls}>
            Asunto
          </label>
          <input id="rad-asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} maxLength={150} className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="rad-desc" className={labelCls}>
            Lo que cuenta el cliente
          </label>
          <textarea
            maxLength={4000}
            id="rad-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={4}
            className={`${inputCls} resize-y`}
          />
          <ContadorCaracteres valor={descripcion} max={4000} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="rad-pret" className={labelCls}>
            Lo que pide {tipo === "reclamo" ? "(obligatorio en reclamos)" : "(opcional)"}
          </label>
          <textarea
            maxLength={2000}
            id="rad-pret"
            value={pretension}
            onChange={(e) => setPretension(e.target.value)}
            rows={2}
            className={`${inputCls} resize-y`}
          />
          <ContadorCaracteres valor={pretension} max={2000} />
        </div>
        <label className="flex items-start gap-2 text-sm text-foreground sm:col-span-2">
          <input type="checkbox" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} className="mt-0.5" />
          El cliente autorizó el tratamiento de sus datos para tramitar esta solicitud.
        </label>
      </div>
    </AdminModal>
  );
}

// ─── PQR de ejemplo ───────────────────────────────────────────────────────

function CargarEjemplos({
  open,
  onOpenChange,
  onListo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onListo: (n: number) => void;
}) {
  const [cliente, setCliente] = useState<ClienteBusqueda | null>(null);
  const [enviando, setEnviando] = useState(false);

  return (
    <AdminModal
      open={open}
      onOpenChange={onOpenChange}
      title="Cargar PQR de ejemplo"
      description="Para demostraciones: se crean 8 solicitudes en todos los estados (en trámite, por vencer, vencida, prorrogada, esperando al cliente, respondida y cerrada) para el cliente que elijas."
      maxWidth="sm:max-w-lg"
      footer={
        <button
          type="button"
          disabled={!cliente || enviando}
          onClick={async () => {
            setEnviando(true);
            try {
              const { creadas } = await pqrService.cargarEjemplos(cliente!.id_cliente);
              onListo(creadas);
            } catch (e) {
              toast.error(mensajeError(e, "No se pudieron crear los ejemplos"));
            } finally {
              setEnviando(false);
            }
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Crear ejemplos
        </button>
      }
    >
      <div className="space-y-3">
        <ClienteCombobox
          value={cliente}
          onChange={setCliente}
          label="Cliente que verá los ejemplos en su perfil"
          ayuda="Escribe su nombre, cédula o correo y elígelo de la lista."
          autoFocus
        />
        <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          Usa una cuenta de prueba o la tuya: a ese correo llegan 2 respuestas marcadas «[Ejemplo]». Las PQR llevan la
          etiqueta «Ejemplo» en el panel y en el perfil, y las quitas todas con «Quitar ejemplos».
        </p>
      </div>
    </AdminModal>
  );
}
