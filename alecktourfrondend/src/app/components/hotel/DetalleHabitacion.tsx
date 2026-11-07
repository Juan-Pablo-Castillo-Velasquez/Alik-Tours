import {
  Bath,
  Bed,
  Building,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Expand,
  Eye,
  Maximize2,
  Minus,
  ScrollText,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { HabitacionResponse } from "../../services/hotel.service";
import { enlaceWhatsAppAgencia } from "../../utils/whatsapp";
import { resolveFotoUrl } from "../admin/types";
import { IconoWhatsApp } from "../BotonWhatsApp";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { CONDICIONES_HABITACION, serviciosAgrupados } from "./serviciosHabitacion";

/** Comodidades guardadas una por línea -> lista. */
export function listaComodidades(texto?: string | null): string[] {
  return (texto ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function textoVista(vista: string) {
  return /^(al|a la|a)\s/i.test(vista) ? `Vista ${vista}` : `Vista: ${vista}`;
}

function textoPiso(piso: number) {
  if (piso === 0) return "Planta baja";
  if (piso < 0) return `Sótano ${Math.abs(piso)}`;
  return `Piso ${piso}`;
}

/** Datos rápidos de la habitación (tarjeta): solo lo cargado, nada inventado. */
export function DatosHabitacion({ hab, className = "" }: { hab: HabitacionResponse; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground font-medium ${className}`}>
      {hab.tipo_cama && (
        <span className="flex items-center gap-1.5">
          <Bed className="w-4 h-4 text-primary" /> {hab.tipo_cama}
        </span>
      )}
      {hab.tipo_habitacion?.capacidad_personas != null && (
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary" /> Máx. {hab.tipo_habitacion.capacidad_personas} pers.
        </span>
      )}
      {hab.tamano_m2 != null && (
        <span className="flex items-center gap-1.5">
          <Maximize2 className="w-4 h-4 text-primary" /> {hab.tamano_m2} m²
        </span>
      )}
      {hab.vista && (
        <span className="flex items-center gap-1.5">
          <Eye className="w-4 h-4 text-primary" /> {textoVista(hab.vista)}
        </span>
      )}
    </div>
  );
}

/** Hasta 4 servicios destacados para la tarjeta de la habitación. */
export function ServiciosDestacados({ hab, max = 4 }: { hab: HabitacionResponse; max?: number }) {
  const todos = serviciosAgrupados(hab.servicios).flatMap((c) => c.servicios);
  if (todos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {todos.slice(0, max).map((s) => {
        const Icono = s.icono;
        return (
          <span key={s.clave} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            <Icono className="w-3 h-3" /> {s.etiqueta}
          </span>
        );
      })}
      {todos.length > max && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">+{todos.length - max} más</span>}
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-bold text-foreground">{titulo}</h3>
      {children}
    </section>
  );
}

const ESTADOS: Record<string, { texto: string; cls: string }> = {
  disponible: { texto: "Disponible", cls: "bg-success/10 text-success" },
  ocupada: { texto: "Ocupada", cls: "bg-destructive/10 text-destructive" },
  mantenimiento: { texto: "En mantenimiento", cls: "bg-warning/10 text-warning" },
};

interface Props {
  hab: HabitacionResponse | null;
  /** Foto de referencia si la habitación no tiene fotos propias. */
  fotoReferencia: string;
  /** Hotel al que pertenece (para mostrar sus políticas). */
  hotel?: { nombre_hotel: string; politicas?: string | null } | null;
  onClose: () => void;
  onElegir?: (hab: HabitacionResponse) => void;
}

/** "Ver detalles" de una habitación: galería de fotos y toda su información. */
export default function DetalleHabitacion({ hab, fotoReferencia, hotel, onClose, onElegir }: Props) {
  const [indice, setIndice] = useState(0);
  const [ampliada, setAmpliada] = useState(false);
  const [verPoliticas, setVerPoliticas] = useState(false);
  const toqueX = useRef<number | null>(null);
  const miniaturas = useRef<HTMLDivElement>(null);

  // Al abrir otra habitación, vuelve a la primera foto.
  useEffect(() => {
    setIndice(0);
    setAmpliada(false);
    setVerPoliticas(false);
  }, [hab?.id_habitacion]);

  const propias = hab?.imagenes ?? [];
  const fotos = propias.length > 0 ? propias.map((i) => ({ url: resolveFotoUrl(i.url) ?? i.url, pie: i.descripcion ?? null })) : [{ url: fotoReferencia, pie: null }];
  const total = fotos.length;
  const actual = fotos[Math.min(indice, total - 1)];

  const ir = (delta: number) => setIndice((i) => (i + delta + total) % total);

  // Flechas del teclado para pasar fotos.
  useEffect(() => {
    if (!hab || total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIndice((i) => (i + 1) % total);
      else if (e.key === "ArrowLeft") setIndice((i) => (i - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hab, total]);

  // Mantiene visible la miniatura activa.
  useEffect(() => {
    const el = miniaturas.current?.children[indice] as HTMLElement | undefined;
    el?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [indice]);

  if (!hab) return null;

  const nombre = hab.tipo_habitacion?.nombre_tipo ?? "Habitación";
  const descripcion = hab.descripcion || hab.tipo_habitacion?.descripcion;
  const grupos = serviciosAgrupados(hab.servicios);
  const totalServicios = grupos.reduce((n, g) => n + g.servicios.length, 0);
  const otras = listaComodidades(hab.comodidades);
  const condiciones = CONDICIONES_HABITACION.filter((c) => hab[c.clave] != null);
  const disponible = hab.estado === "disponible";
  const estado = ESTADOS[hab.estado];

  const esenciales: { icono: typeof Users; titulo: string; valor: string }[] = [];
  if (hab.tipo_habitacion?.capacidad_personas != null)
    esenciales.push({ icono: Users, titulo: "Huéspedes", valor: `Hasta ${hab.tipo_habitacion.capacidad_personas} ${hab.tipo_habitacion.capacidad_personas === 1 ? "persona" : "personas"}` });
  if (hab.tipo_cama) esenciales.push({ icono: Bed, titulo: "Camas", valor: hab.tipo_cama });
  if (hab.tamano_m2 != null) esenciales.push({ icono: Maximize2, titulo: "Tamaño", valor: `${hab.tamano_m2} m²` });
  if (hab.vista) esenciales.push({ icono: Eye, titulo: "Vista", valor: hab.vista });
  if (hab.tipo_bano) esenciales.push({ icono: Bath, titulo: "Baño", valor: hab.tipo_bano });
  if (hab.piso != null) esenciales.push({ icono: Building, titulo: "Ubicación", valor: textoPiso(hab.piso) });

  const pocaInfo = !hab.descripcion && totalServicios === 0 && otras.length === 0 && esenciales.length <= 1;

  const galeria = (
    <div
      className="relative bg-black select-none"
      onTouchStart={(e) => (toqueX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (toqueX.current == null || total < 2) return;
        const dx = e.changedTouches[0].clientX - toqueX.current;
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1);
        toqueX.current = null;
      }}
    >
      <img
        src={actual.url}
        alt={propias.length ? actual.pie || `Foto ${indice + 1} de la habitación ${nombre}` : "Imagen de referencia"}
        className={ampliada ? "w-full h-full object-contain" : "w-full aspect-[4/3] sm:aspect-[16/9] object-cover"}
      />
      {total > 1 && (
        <>
          <button type="button" onClick={() => ir(-1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button type="button" onClick={() => ir(1)} aria-label="Foto siguiente" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70">
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="absolute top-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white" aria-live="polite">
            {indice + 1} / {total}
          </span>
        </>
      )}
      {propias.length > 0 && (
        <button
          type="button"
          onClick={() => setAmpliada((a) => !a)}
          aria-label={ampliada ? "Salir de pantalla completa" : "Ver foto en grande"}
          className="absolute bottom-3 right-3 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
        >
          {ampliada ? <X className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
        </button>
      )}
      {propias.length === 0 ? (
        <span className="absolute bottom-3 left-3 right-14 rounded-md bg-black/60 px-2 py-1 text-[11px] text-white">
          Imagen de referencia: esta habitación aún no tiene fotos propias
        </span>
      ) : (
        actual.pie && <span className="absolute bottom-3 left-3 right-14 rounded-md bg-black/60 px-2 py-1 text-xs text-white">{actual.pie}</span>
      )}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 flex flex-col overflow-hidden w-full max-w-none sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[92vh] rounded-none sm:rounded-2xl border-0 sm:border [&>button:last-child]:z-10 [&>button:last-child]:top-3 [&>button:last-child]:right-3 [&>button:last-child]:rounded-full [&>button:last-child]:bg-black/60 [&>button:last-child]:p-2 [&>button:last-child]:text-white [&>button:last-child]:opacity-100">
        <DialogTitle className="sr-only">
          {nombre} · Habitación {hab.numero_habitacion}
        </DialogTitle>
        <DialogDescription className="sr-only">Fotos, servicios y condiciones de la habitación</DialogDescription>

        {ampliada ? (
          <div className="flex-1 min-h-0 bg-black flex flex-col">
            <div className="flex-1 min-h-0 [&>div]:h-full">{galeria}</div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {galeria}

            {total > 1 && (
              <div ref={miniaturas} className="flex gap-2 px-4 sm:px-6 pt-3 overflow-x-auto pb-1">
                {fotos.map((f, i) => (
                  <button
                    key={`${f.url}-${i}`}
                    type="button"
                    onClick={() => setIndice(i)}
                    aria-label={`Ver foto ${i + 1} de ${total}${f.pie ? `: ${f.pie}` : ""}`}
                    aria-current={i === indice}
                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-opacity ${i === indice ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
                  >
                    <img src={f.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="px-4 sm:px-6 py-5 space-y-7">
              {/* Encabezado */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-foreground">{nombre}</h2>
                  {estado && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${estado.cls}`}>{estado.texto}</span>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Habitación {hab.numero_habitacion}
                  {hotel?.nombre_hotel ? ` · ${hotel.nombre_hotel}` : ""}
                </p>
              </div>

              {/* Lo esencial */}
              {esenciales.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {esenciales.map(({ icono: Icono, titulo, valor }) => (
                    <div key={titulo} className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
                      <Icono className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{titulo}</p>
                        <p className="text-sm font-semibold text-foreground break-words">{valor}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {descripcion && (
                <Seccion titulo="Sobre esta habitación">
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{descripcion}</p>
                </Seccion>
              )}

              {(totalServicios > 0 || otras.length > 0) && (
                <Seccion titulo={totalServicios > 0 ? `Lo que incluye (${totalServicios + otras.length})` : "Lo que incluye"}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    {grupos.map((g) => (
                      <div key={g.titulo}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{g.titulo}</p>
                        <ul className="space-y-1.5">
                          {g.servicios.map((s) => {
                            const Icono = s.icono;
                            return (
                              <li key={s.clave} className="flex items-center gap-2.5 text-sm text-foreground">
                                <Icono className="w-4 h-4 text-primary shrink-0" /> {s.etiqueta}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                    {otras.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{totalServicios > 0 ? "Además" : "Comodidades"}</p>
                        <ul className="space-y-1.5">
                          {otras.map((c) => (
                            <li key={c} className="flex items-center gap-2.5 text-sm text-foreground">
                              <Check className="w-4 h-4 text-success shrink-0" /> {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Seccion>
              )}

              {condiciones.length > 0 && (
                <Seccion titulo="Condiciones">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {condiciones.map((c) => {
                      const si = hab[c.clave] === true;
                      const Icono = c.icono;
                      return (
                        <li key={c.clave} className="flex items-center gap-2.5 text-sm">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${si ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                            <Icono className="w-4 h-4" />
                          </span>
                          <span className={si ? "text-foreground" : "text-muted-foreground"}>{si ? c.si : c.no}</span>
                          {si ? <Check className="w-4 h-4 text-success ml-auto" /> : <Minus className="w-4 h-4 text-muted-foreground ml-auto" />}
                        </li>
                      );
                    })}
                  </ul>
                </Seccion>
              )}

              {hotel?.politicas && (
                <section className="rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setVerPoliticas((v) => !v)}
                    aria-expanded={verPoliticas}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground"
                  >
                    <ScrollText className="w-4 h-4 text-primary" /> Políticas del hotel
                    <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${verPoliticas ? "rotate-180" : ""}`} />
                  </button>
                  {verPoliticas && <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{hotel.politicas}</p>}
                </section>
              )}

              {pocaInfo && (
                <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                  El hotel todavía no ha cargado más detalles de esta habitación.
                </p>
              )}

              <a
                href={enlaceWhatsAppAgencia(`Hola, quiero más información de la habitación ${nombre} ${hab.numero_habitacion}${hotel?.nombre_hotel ? ` del ${hotel.nombre_hotel}` : ""}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-semibold text-success hover:underline"
              >
                <IconoWhatsApp className="w-4 h-4" /> ¿Tienes dudas de esta habitación? Pregúntanos por WhatsApp
              </a>
            </div>
          </div>
        )}

        {/* Precio y botón siempre visibles */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div>
            <p className="text-[11px] text-muted-foreground">Precio por noche</p>
            <p className="text-xl sm:text-2xl font-bold text-primary leading-tight">${Number(hab.precio_noche).toLocaleString("es-CO")}</p>
            <p className="text-[10px] text-muted-foreground">El total con fechas se muestra antes de pagar</p>
          </div>
          {onElegir && (
            <button
              type="button"
              disabled={!disponible}
              onClick={() => {
                onElegir(hab);
                onClose();
              }}
              className="shrink-0 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:bg-muted disabled:text-muted-foreground"
            >
              {disponible ? "Elegir esta habitación" : "No disponible"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
