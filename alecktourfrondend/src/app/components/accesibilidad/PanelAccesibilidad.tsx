import {
  Accessibility,
  Contrast,
  Focus,
  Languages,
  Link2,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Speech,
  Type,
  Volume2,
  WholeWord,
  Zap,
} from "lucide-react";
import { useEffect, useState, type ElementType } from "react";
import { Link } from "react-router";
import { useAccesibilidad, type PreferenciasA11y } from "../../context/AccesibilidadContext";
import { IDIOMAS, useIdioma } from "../../i18n";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import {
  VELOCIDADES,
  continuarVoz,
  guardarAjustesVoz,
  hablar,
  leerAjustesVoz,
  leerEnVoz,
  pausarVoz,
  useEstadoVoz,
  vocesPara,
  vozDisponible,
} from "./lecturaVoz";

type Interruptor = { clave: keyof Omit<PreferenciasA11y, "texto">; icono: ElementType; titulo: string; desc?: string };

/** Panel de accesibilidad: centrado, se abre desde la barra superior, el
 * pie de página o con Alt + A. */
export default function PanelAccesibilidad() {
  const { prefs, cambiar, restablecer, panelAbierto, setPanelAbierto } = useAccesibilidad();
  const { idioma, setIdioma, t } = useIdioma();
  const estadoVoz = useEstadoVoz();
  const [ajustesVoz, setAjustesVoz] = useState(leerAjustesVoz);
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>(() => vocesPara(idioma));

  // Las voces del navegador cargan tarde (evento voiceschanged).
  useEffect(() => {
    if (!vozDisponible()) return;
    const cargar = () => setVoces(vocesPara(idioma));
    cargar();
    window.speechSynthesis.addEventListener?.("voiceschanged", cargar);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", cargar);
  }, [idioma]);

  const cambiarVoz = (cambio: Partial<typeof ajustesVoz>) => {
    const nuevo = { ...ajustesVoz, ...cambio };
    setAjustesVoz(nuevo);
    guardarAjustesVoz(nuevo);
  };

  const interruptores: Interruptor[] = [
    { clave: "contraste", icono: Contrast, titulo: t("a11y.contraste"), desc: t("a11y.contrasteDesc") },
    { clave: "enlaces", icono: Link2, titulo: t("a11y.enlaces"), desc: t("a11y.enlacesDesc") },
    { clave: "movimiento", icono: Zap, titulo: t("a11y.movimiento"), desc: t("a11y.movimientoDesc") },
    { clave: "lectura", icono: WholeWord, titulo: t("a11y.lectura"), desc: t("a11y.lecturaDesc") },
    { clave: "foco", icono: Focus, titulo: t("a11y.foco"), desc: t("a11y.focoDesc") },
    { clave: "cursor", icono: MousePointer2, titulo: t("a11y.cursor") },
    { clave: "leerAlEnfocar", icono: Speech, titulo: t("a11y.leerAlEnfocar"), desc: t("a11y.leerAlEnfocarDesc") },
  ];
  const tamanos = [t("a11y.textoNormal"), t("a11y.textoGrande"), t("a11y.textoMuyGrande")];

  const leer = (seleccion: boolean) => {
    const texto = seleccion ? window.getSelection()?.toString().trim() : undefined;
    if (seleccion && !texto) return;
    setPanelAbierto(false);
    setTimeout(() => leerEnVoz(idioma, texto), 250);
  };

  return (
    <>
      <Dialog open={panelAbierto} onOpenChange={setPanelAbierto}>
        <DialogContent className="max-h-[90vh] w-full overflow-y-auto rounded-2xl border-border bg-card p-0 shadow-2xl sm:max-w-xl">
          <div className="border-b border-border px-6 py-5 pr-12">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm" aria-hidden>
                <Accessibility className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">{t("a11y.titulo")}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">{t("a11y.descripcion")}</DialogDescription>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Languages className="h-4 w-4 text-primary" aria-hidden /> {t("idioma.titulo")}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {IDIOMAS.map((i) => (
                  <button
                    key={i.codigo}
                    type="button"
                    lang={i.codigo}
                    aria-pressed={idioma === i.codigo}
                    onClick={() => setIdioma(i.codigo)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      idioma === i.codigo ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"
                    }`}
                  >
                    {i.nombre}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Type className="h-4 w-4 text-primary" aria-hidden /> {t("a11y.texto")}
              </legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("a11y.texto")}>
                {tamanos.map((nombre, i) => (
                  <button
                    key={nombre}
                    type="button"
                    role="radio"
                    aria-checked={prefs.texto === i}
                    onClick={() => cambiar("texto", i as 0 | 1 | 2)}
                    className={`rounded-xl border px-3 py-2.5 font-semibold transition-colors ${
                      prefs.texto === i ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                    }`}
                    style={{ fontSize: `${0.8 + i * 0.12}rem` }}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            </fieldset>

            <ul className="grid gap-2 sm:grid-cols-2">
              {interruptores.map(({ clave, icono: Icono, titulo, desc }) => {
                const activo = prefs[clave];
                return (
                  <li key={clave}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activo}
                      onClick={() => cambiar(clave, !activo)}
                      className={`flex h-full w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                        activo ? "border-primary bg-primary/5" : "border-border hover:bg-muted/60"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          activo ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                        aria-hidden
                      >
                        <Icono className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{titulo}</span>
                          <span
                            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${activo ? "bg-primary" : "bg-border"}`}
                            aria-hidden
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${activo ? "left-[18px]" : "left-0.5"}`}
                            />
                          </span>
                        </span>
                        {desc && <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <section className="rounded-xl border border-border p-4" aria-labelledby="a11y-voz">
              <h3 id="a11y-voz" className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Volume2 className="h-4 w-4 text-primary" aria-hidden /> {t("a11y.voz")}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {vozDisponible() ? t("a11y.vozDesc") : t("a11y.sinVoz")}
              </p>
              {vozDisponible() && (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => leer(false)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      <Volume2 className="h-4 w-4" aria-hidden /> {t("a11y.leer")}
                    </button>
                    <button
                      type="button"
                      onClick={() => leer(true)}
                      className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                    >
                      {t("a11y.leerSeleccion")}
                    </button>
                    {estadoVoz !== "inactiva" && (
                      <button
                        type="button"
                        onClick={estadoVoz === "leyendo" ? pausarVoz : continuarVoz}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                      >
                        {estadoVoz === "leyendo" ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
                        {estadoVoz === "leyendo" ? t("a11y.pausar") : t("a11y.continuar")}
                      </button>
                    )}
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <span id="a11y-velocidad" className="mb-1.5 block text-xs font-semibold text-foreground">
                        {t("a11y.velocidad")}
                      </span>
                      <div role="radiogroup" aria-labelledby="a11y-velocidad" className="flex flex-wrap gap-1">
                        {VELOCIDADES.map((v) => (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={ajustesVoz.velocidad === v}
                            onClick={() => cambiarVoz({ velocidad: v })}
                            className={`min-w-11 rounded-lg border px-2 py-1.5 text-xs font-semibold tabular-nums transition-colors ${
                              ajustesVoz.velocidad === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                            }`}
                          >
                            {v}×
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label htmlFor="a11y-voz-elegida" className="mb-1.5 block text-xs font-semibold text-foreground">
                        {t("a11y.vozElegida")}
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          id="a11y-voz-elegida"
                          value={voces.some((v) => v.name === ajustesVoz.voz) ? ajustesVoz.voz : ""}
                          onChange={(e) => cambiarVoz({ voz: e.target.value })}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                        >
                          <option value="">{t("a11y.vozAuto")}</option>
                          {voces.map((v) => (
                            <option key={v.voiceURI} value={v.name} translate="no">
                              {v.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => hablar(t("a11y.muestraVoz"), idioma)}
                          className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
                        >
                          {t("a11y.probarVoz")}
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{t("a11y.atajosVoz")}</p>
                </>
              )}
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
              <div className="space-y-1">
                <p>{t("a11y.atajo")}</p>
                <p>{t("a11y.lectores")}</p>
                <Link to="/accesibilidad" onClick={() => setPanelAbierto(false)} className="font-semibold text-primary hover:underline">
                  {t("a11y.declaracion")}
                </Link>
              </div>
              <button
                type="button"
                onClick={restablecer}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> {t("a11y.restablecer")}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
