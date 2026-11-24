import {
  ArrowLeft,
  ChevronRight,
  Copy,
  FileText,
  Info,
  Loader2,
  MessageSquareText,
  Plus,
  Scale,
  Send,
  Star,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { usePagination } from "../../hooks/usePagination";
import { pqrService, type PqrDetalle, type PqrResumen, type TipoPqr } from "../../services/pqr.service";
import { DECISION_PQR, fechaCorta, TIPOS_PQR } from "../../utils/pqr";
import { codigoReserva, tituloReserva } from "../../utils/reservaPresentacion";
import { EstadoPqrBadge, EtiquetaEjemplo, HiloPqr, PlazoCorto, PlazoDetalle } from "../pqr/PqrPiezas";
import ContadorCaracteres from "../ui/ContadorCaracteres";
import { CampoArea, CampoTexto } from "../forms/Campos";
import Pagination from "../ui/pagination";
import EncabezadoTab, { PanelPerfil, VacioPerfil } from "./EncabezadoTab";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Reserva = any;

const POR_PAGINA = 6;
const FILTROS = [
  { id: "todas", texto: "Todas" },
  { id: "abiertas", texto: "En curso" },
  { id: "respondidas", texto: "Respondidas" },
  { id: "cerradas", texto: "Cerradas" },
] as const;
type Filtro = (typeof FILTROS)[number]["id"];

const mensajeError = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto);

const campo =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export default function TabPqr({ reservas = [], pqrIdInicial }: { reservas?: Reserva[]; pqrIdInicial?: number | null }) {
  const [lista, setLista] = useState<PqrResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<"lista" | "nueva" | "detalle">(pqrIdInicial ? "detalle" : "lista");
  const [idAbierta, setIdAbierta] = useState<number | null>(pqrIdInicial ?? null);
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setLista(await pqrService.mias());
    } catch (e) {
      setError(mensajeError(e, "No pudimos cargar tus solicitudes."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const filtradas = useMemo(() => {
    switch (filtro) {
      case "abiertas":
        return lista.filter((p) => ["radicada", "en_tramite", "esperando_cliente"].includes(p.estado));
      case "respondidas":
        return lista.filter((p) => p.estado === "respondida");
      case "cerradas":
        return lista.filter((p) => p.estado === "cerrada" || p.estado === "desistida");
      default:
        return lista;
    }
  }, [lista, filtro]);
  const { page, pageCount, slice, setPage } = usePagination(filtradas, POR_PAGINA);
  const pendientesDeTi = lista.filter((p) => p.estado === "esperando_cliente").length;

  const abrir = (id: number) => {
    setIdAbierta(id);
    setVista("detalle");
    document.getElementById("contenido-perfil")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const volver = () => {
    setVista("lista");
    setIdAbierta(null);
    cargar();
  };

  if (vista === "nueva") {
    return (
      <FormularioPqr
        reservas={reservas}
        onCancelar={() => setVista("lista")}
        onRadicada={(p) => {
          toast.success(`Radicamos tu solicitud ${p.radicado}`, {
            description: `Te respondemos a más tardar el ${fechaCorta(p.fecha_vencimiento)}.`,
          });
          cargar();
          abrir(p.id_pqr);
        }}
      />
    );
  }
  if (vista === "detalle" && idAbierta) {
    return <DetallePqr id={idAbierta} onVolver={volver} />;
  }

  return (
    <div className="w-full">
      <EncabezadoTab
        titulo="Solicitudes (PQR)"
        descripcion="Peticiones, quejas, reclamos, sugerencias y felicitaciones. Cada una recibe un número de radicado y una fecha límite de respuesta."
        accion={
          <button
            type="button"
            onClick={() => setVista("nueva")}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nueva solicitud
          </button>
        }
      />

      {pendientesDeTi > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm text-foreground">
            {pendientesDeTi === 1 ? "Tienes una solicitud" : `Tienes ${pendientesDeTi} solicitudes`} esperando tu
            respuesta. Mientras no nos respondas, el plazo queda en pausa.
          </p>
        </div>
      )}

      <PanelPerfil>
        {cargando ? (
          <div className="space-y-3" aria-label="Cargando solicitudes">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <VacioPerfil
            icono={Info}
            titulo="No pudimos cargar tus solicitudes"
            texto={error}
            accion={
              <button type="button" onClick={cargar} className="text-sm font-semibold text-primary hover:underline">
                Intentar de nuevo
              </button>
            }
          />
        ) : lista.length === 0 ? (
          <VacioPerfil
            icono={MessageSquareText}
            titulo="Aún no tienes solicitudes"
            texto="Si algo de tu viaje no salió como esperabas, o quieres pedirnos algo, radícalo aquí y te respondemos por escrito dentro del plazo de ley."
            accion={
              <button
                type="button"
                onClick={() => setVista("nueva")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> Radicar una solicitud
              </button>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar solicitudes">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f.id}
                  onClick={() => {
                    setFiltro(f.id);
                    setPage(0);
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    filtro === f.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  {f.texto}
                </button>
              ))}
            </div>

            {filtradas.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No hay solicitudes en este filtro.</p>
            ) : (
              <ul className="divide-y divide-border">
                {slice.map((p) => (
                  <li key={p.id_pqr}>
                    <button
                      type="button"
                      onClick={() => abrir(p.id_pqr)}
                      className="group flex w-full items-center gap-4 rounded-xl px-2 py-4 text-left transition-colors hover:bg-muted/50 sm:px-3"
                    >
                      <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:flex">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-xs font-semibold text-muted-foreground">{p.radicado}</span>
                          <span className="text-xs text-muted-foreground">· {p.tipo_nombre}</span>
                          {p.es_ejemplo && <EtiquetaEjemplo />}
                        </div>
                        <p className="mt-0.5 truncate font-semibold text-foreground">{p.asunto}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <EstadoPqrBadge estado={p.estado} />
                          <PlazoCorto pqr={p} />
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {filtradas.length > POR_PAGINA && (
              <Pagination
                className="mt-4 border-t border-border pt-4"
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                total={filtradas.length}
                pageSize={POR_PAGINA}
                etiqueta="solicitudes"
              />
            )}
          </>
        )}
      </PanelPerfil>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { n: "1", t: "Radicas", d: "Te damos un número de radicado y la fecha límite de respuesta." },
          { n: "2", t: "La gestionamos", d: "Un asesor la revisa y te escribe aquí si necesita algo." },
          { n: "3", t: "Te respondemos", d: "Por escrito, de fondo, y también por correo." },
        ].map((paso) => (
          <div key={paso.n} className="rounded-2xl border border-border bg-card p-4">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {paso.n}
            </span>
            <p className="mt-2 text-sm font-semibold text-foreground">{paso.t}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{paso.d}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Plazos y reglas en la{" "}
        <Link to="/pqr" className="font-semibold text-primary hover:underline">
          política de atención de PQR
        </Link>
        .
      </p>
    </div>
  );
}

// ─── Formulario ───────────────────────────────────────────────────────────

function FormularioPqr({
  reservas,
  onCancelar,
  onRadicada,
}: {
  reservas: Reserva[];
  onCancelar: () => void;
  onRadicada: (p: PqrDetalle) => void;
}) {
  const [tipo, setTipo] = useState<TipoPqr | null>(null);
  const [idReserva, setIdReserva] = useState<string>("");
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pretension, setPretension] = useState("");
  const [autoriza, setAutoriza] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = TIPOS_PQR.find((t) => t.tipo === tipo);
  const pidePretension = tipo === "reclamo" || tipo === "peticion" || tipo === "queja";
  const listo =
    !!tipo &&
    asunto.trim().length >= 5 &&
    descripcion.trim().length >= 20 &&
    (tipo !== "reclamo" || pretension.trim().length >= 10) &&
    autoriza;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipo || !listo) return;
    setEnviando(true);
    setError(null);
    try {
      const p = await pqrService.radicar({
        tipo,
        asunto: asunto.trim(),
        descripcion: descripcion.trim(),
        pretension: pretension.trim() || undefined,
        id_reserva: idReserva ? Number(idReserva) : null,
        autoriza_datos: autoriza,
      });
      onRadicada(p);
    } catch (err) {
      setError(mensajeError(err, "No pudimos radicar tu solicitud. Intenta de nuevo."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onCancelar}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a mis solicitudes
      </button>
      <EncabezadoTab
        titulo="Nueva solicitud"
        descripcion="Cuéntanos con detalle qué pasó y qué esperas. Entre más claro, más rápido te respondemos."
      />

      <form onSubmit={enviar} className="space-y-5">
        <PanelPerfil>
          <fieldset>
            <legend className="text-sm font-semibold text-foreground">1. ¿Qué tipo de solicitud es?</legend>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {TIPOS_PQR.map((t) => (
                <label
                  key={t.tipo}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    tipo === t.tipo ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={t.tipo}
                    checked={tipo === t.tipo}
                    onChange={() => setTipo(t.tipo)}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-foreground">{t.nombre}</span>
                      <span className="text-xs text-muted-foreground">{t.dias} días hábiles</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{t.ayuda}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </PanelPerfil>

        <PanelPerfil className="space-y-4">
          <p className="text-sm font-semibold text-foreground">2. Cuéntanos qué pasó</p>
          {reservas.length > 0 && (
            <div>
              <label htmlFor="pqr-reserva" className="mb-1 block text-sm font-medium text-foreground">
                ¿Es sobre una reserva? <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <select id="pqr-reserva" value={idReserva} onChange={(e) => setIdReserva(e.target.value)} className={campo}>
                <option value="">No, es algo general</option>
                {reservas.map((r) => (
                  <option key={r.id_reserva} value={r.id_reserva}>
                    {codigoReserva(r.id_reserva)} · {tituloReserva(r)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <CampoTexto
            id="pqr-asunto"
            label="Asunto"
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            maxLength={150}
            placeholder="Ej.: No me llegaron los vouchers del hotel"
          />
          <CampoArea
            id="pqr-descripcion"
            label="Descripción"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={6}
            maxLength={4000}
            minimo={20}
            placeholder="Qué pasó, cuándo y con quién. Incluye fechas, nombres o números que nos ayuden a revisarlo."
          />
          {pidePretension && (
            <CampoArea
              id="pqr-pretension"
              label="¿Qué esperas que hagamos?"
              opcional={tipo !== "reclamo"}
              value={pretension}
              onChange={(e) => setPretension(e.target.value)}
              rows={3}
              maxLength={2000}
              minimo={tipo === "reclamo" ? 10 : undefined}
              placeholder="Ej.: Que me reembolsen la noche que no se prestó."
              ayuda={
                tipo === "reclamo"
                  ? "En un reclamo es obligatorio: te diremos de forma expresa si accedemos o no y por qué."
                  : undefined
              }
            />
          )}
        </PanelPerfil>

        <PanelPerfil className="space-y-4">
          {info && (
            <div className="flex items-start gap-3 rounded-xl bg-muted/60 p-3.5">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm text-foreground">
                Te responderemos en máximo <strong>{info.dias} días hábiles</strong> desde el día siguiente a la
                radicación. Si necesitamos un dato más, te lo pediremos aquí y el plazo se pausa hasta que respondas.
              </p>
            </div>
          )}
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={autoriza}
              onChange={(e) => setAutoriza(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            <span className="text-sm text-foreground">
              Autorizo a Alik Tours a usar mis datos para tramitar esta solicitud, según la{" "}
              <Link to="/privacy" target="_blank" className="font-semibold text-primary hover:underline">
                política de privacidad
              </Link>
              .
            </span>
          </label>
          {error && (
            <p role="alert" className="rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!listo || enviando}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Radicar solicitud
            </button>
          </div>
        </PanelPerfil>
      </form>
    </div>
  );
}

// ─── Detalle ──────────────────────────────────────────────────────────────

function DetallePqr({ id, onVolver }: { id: number; onVolver: () => void }) {
  const [pqr, setPqr] = useState<PqrDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState("");
  const [confirmarDesistir, setConfirmarDesistir] = useState(false);

  useEffect(() => {
    pqrService
      .ver(id)
      .then(setPqr)
      .catch((e) => setError(mensajeError(e, "No pudimos abrir la solicitud.")));
  }, [id]);

  const accion = async (fn: () => Promise<PqrDetalle>, ok?: string) => {
    setEnviando(true);
    try {
      setPqr(await fn());
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo completar la acción."));
      return false;
    } finally {
      setEnviando(false);
    }
  };

  if (error) {
    return (
      <PanelPerfil>
        <VacioPerfil
          icono={Info}
          titulo="No pudimos abrir la solicitud"
          texto={error}
          accion={
            <button type="button" onClick={onVolver} className="text-sm font-semibold text-primary hover:underline">
              Volver a mis solicitudes
            </button>
          }
        />
      </PanelPerfil>
    );
  }
  if (!pqr) {
    return <div className="h-96 animate-pulse rounded-2xl bg-muted" aria-label="Cargando solicitud" />;
  }

  const abierta = ["radicada", "en_tramite", "esperando_cliente"].includes(pqr.estado);
  const decision = pqr.decision ? DECISION_PQR[pqr.decision] : null;
  const mostrarSic = (pqr.tipo === "reclamo" || pqr.tipo === "queja") && (pqr.decision === "parcial" || pqr.decision === "desfavorable");

  return (
    <div className="w-full space-y-5">
      <button
        type="button"
        onClick={onVolver}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a mis solicitudes
      </button>

      <PanelPerfil>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(pqr.radicado);
              toast.success("Radicado copiado");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 font-mono text-xs font-semibold text-foreground hover:bg-muted/70"
            aria-label={`Copiar radicado ${pqr.radicado}`}
          >
            {pqr.radicado} <Copy className="h-3 w-3" />
          </button>
          <span className="text-xs text-muted-foreground">{pqr.tipo_nombre}</span>
          {pqr.es_ejemplo && <EtiquetaEjemplo />}
          <span className="ml-auto">
            <EstadoPqrBadge estado={pqr.estado} />
          </span>
        </div>
        <h1 className="mt-3 text-xl font-bold tracking-tight text-foreground md:text-2xl">{pqr.asunto}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Radicada el {fechaCorta(pqr.fecha_radicacion)}
          {pqr.reserva_titulo && pqr.id_reserva ? ` · ${codigoReserva(pqr.id_reserva)}` : ""}
        </p>
        <div className="mt-4">
          <PlazoDetalle pqr={pqr} />
        </div>
      </PanelPerfil>

      {decision && pqr.respuesta && (
        <section className={`rounded-2xl border p-5 md:p-6 ${decision.clase}`}>
          <p className="text-xs font-semibold uppercase tracking-wide">Nuestra respuesta</p>
          <p className="mt-1 text-lg font-bold">{decision.texto}</p>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">{pqr.respuesta}</p>
          {mostrarSic && (
            <p className="mt-4 rounded-xl bg-background/70 p-3 text-xs text-foreground">
              Si no estás de acuerdo, puedes acudir a la Superintendencia de Industria y Comercio (
              <a href="https://www.sic.gov.co" target="_blank" rel="noreferrer" className="font-semibold underline">
                sic.gov.co
              </a>
              ), autoridad de protección al consumidor, con este número de radicado.
            </p>
          )}
        </section>
      )}

      {pqr.estado === "respondida" && (
        <PanelPerfil>
          <p className="font-semibold text-foreground">¿Cómo te pareció la atención?</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Tu calificación cierra la solicitud y nos ayuda a mejorar.</p>
          <div className="mt-3 flex gap-1" role="radiogroup" aria-label="Calificación">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={estrellas === n}
                aria-label={`${n} de 5`}
                onClick={() => setEstrellas(n)}
                className="rounded-md p-1 hover:bg-muted"
              >
                <Star className={`h-7 w-7 ${n <= estrellas ? "fill-warning text-warning" : "text-muted-foreground/40"}`} />
              </button>
            ))}
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Comentario (opcional)"
            className={`${campo} mt-3`}
          />
          <ContadorCaracteres valor={comentario} max={1000} />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!estrellas || enviando}
              onClick={() => accion(() => pqrService.calificar(pqr.id_pqr, estrellas, comentario || undefined), "¡Gracias por calificarnos!")}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Enviar calificación
            </button>
          </div>
        </PanelPerfil>
      )}

      <PanelPerfil>
        <h2 className="font-semibold text-foreground">Lo que nos contaste</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{pqr.descripcion}</p>
        {pqr.pretension && (
          <div className="mt-4 rounded-xl bg-muted/60 p-3.5">
            <p className="text-xs font-semibold text-muted-foreground">Lo que esperas</p>
            <p className="mt-1 text-sm text-foreground">{pqr.pretension}</p>
          </div>
        )}
        {pqr.reserva_titulo && <p className="mt-3 text-xs text-muted-foreground">Sobre: {pqr.reserva_titulo}</p>}
      </PanelPerfil>

      <PanelPerfil>
        <h2 className="mb-4 font-semibold text-foreground">Seguimiento</h2>
        <HiloPqr actuaciones={pqr.actuaciones} vista="cliente" />

        {abierta && (
          <form
            className="mt-5 border-t border-border pt-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (texto.trim().length < 2) return;
              if (await accion(() => pqrService.escribir(pqr.id_pqr, texto.trim()), "Mensaje enviado")) setTexto("");
            }}
          >
            {pqr.estado === "esperando_cliente" && (
              <p className="mb-2 text-sm font-medium text-warning">
                Responde aquí con lo que te pedimos: el plazo vuelve a correr desde que lo envíes.
              </p>
            )}
            <label htmlFor="pqr-mensaje" className="sr-only">
              Escribe un mensaje
            </label>
            <textarea
              id="pqr-mensaje"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={3}
              maxLength={3000}
              placeholder="Escribe un mensaje para el equipo…"
              className={`${campo} resize-y`}
            />
            <ContadorCaracteres valor={texto} max={3000} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              {confirmarDesistir ? (
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-foreground">¿Seguro que ya no necesitas respuesta?</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (await accion(() => pqrService.desistir(pqr.id_pqr), "Cerramos la solicitud")) setConfirmarDesistir(false);
                    }}
                    className="font-semibold text-destructive hover:underline"
                  >
                    Sí, desistir
                  </button>
                  <button type="button" onClick={() => setConfirmarDesistir(false)} className="text-muted-foreground hover:underline">
                    No
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmarDesistir(true)}
                  className="text-sm text-muted-foreground hover:text-destructive hover:underline"
                >
                  Ya no la necesito
                </button>
              )}
              <button
                type="submit"
                disabled={texto.trim().length < 2 || enviando}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar
              </button>
            </div>
          </form>
        )}
      </PanelPerfil>
    </div>
  );
}
