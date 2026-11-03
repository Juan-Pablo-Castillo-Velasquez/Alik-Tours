import { useRef, useState } from "react";
import { Palette, Plus, Pencil, Trash2, CheckCircle2, ShieldCheck, ImagePlus, FileVideo, X, Loader2 } from "lucide-react";
import { resolveImagenTema, resolveVideoTema, Tema, TemaFormData } from "../../services/tema.service";
import { getTemaIcono, TEMA_ICONOS_OPCIONES } from "../../utils/temaIconos";
import { PALETAS_PRESET } from "../../utils/temaPaletas";
import AdminModal from "./ui/AdminModal";
import SectionHeader from "./ui/SectionHeader";
import EmptyState from "./ui/EmptyState";
import StatusBadge from "./ui/StatusBadge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "../ui/tooltip";
import { AA_MINIMO, contraste, cumpleAA } from "../../utils/contrasteWcag";

interface Props {
  temas: Tema[];
  onSubmit: (data: TemaFormData, id?: number) => Promise<void>;
  onDelete: (tema: Tema) => void;
  onActivar: (tema: Tema) => Promise<void>;
  onSubirImagen: (id: number, imagen: File) => Promise<void>;
  onBorrarImagen: (id: number) => Promise<void>;
  onSubirVideo: (id: number, video: File) => Promise<void>;
  onBorrarVideo: (id: number) => Promise<void>;
  loading: boolean;
}

const FORM_VACIO: TemaFormData = {
  nombre: "",
  color_primario_claro: "#6e1832",
  color_primario_oscuro: "#c24d6e",
  color_secundario_claro: "#b8912e",
  color_secundario_oscuro: "#e8c77a",
  icono: "sparkles",
};

// ── Contraste WCAG 2.1 AA (Resolución MinTIC 1519 de 2020 exige este mismo
// nivel para sitios del Estado colombiano) — misma fórmula de luminancia
// relativa que se usó para verificar los 7 temas sembrados en la
// migración. Se recalcula en vivo mientras el admin edita colores, para
// que nunca guarde una combinación que no se lea bien. ──
// (hexToRgbNums, luminanciaRelativa, contraste y AA_MINIMO viven ahora en
// utils/contrasteWcag.ts, donde tienen sus tests unitarios.)

function BadgeContraste({ hex, contra, etiqueta }: { hex: string; contra: string; etiqueta: string }) {
  const ratio = contraste(hex, contra);
  if (ratio === null) return null;
  const pasa = cumpleAA(ratio);
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${
        pasa ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
      }`}
    >
      {ratio.toFixed(2)}:1 {pasa ? "✓ AA" : `✗ mín. ${AA_MINIMO}:1`} · {etiqueta}
    </span>
  );
}

function CampoColor({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-11 rounded-lg border border-border cursor-pointer bg-transparent p-0.5 flex-shrink-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6e1832"
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

// Selector del ícono decorativo (Halloween, Navidad, Amor y Amistad...) que
// se muestra en el navbar y la barra de ofertas cuando este tema está
// activo -- ver PromoBar.tsx / Navbar.tsx. Catálogo cerrado (no texto
// libre) para que nunca llegue un nombre que lucide-react no reconozca.
function SelectorIcono({
  value, onChange,
}: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>Ícono decorativo</Label>
      <p className="text-[11px] text-muted-foreground mb-2">
        Se muestra en el navbar y la barra de ofertas cuando este tema está activo.
      </p>
      <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
        {TEMA_ICONOS_OPCIONES.map(({ valor, etiqueta, Icono }) => {
          const seleccionado = value === valor;
          return (
            <button
              key={valor}
              type="button"
              onClick={() => onChange(valor)}
              title={etiqueta}
              className={`h-10 flex items-center justify-center rounded-xl border transition-all ${
                seleccionado
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}
            >
              <Icono className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Temas de color de temporada (Navidad, Halloween, etc.) que el admin
// crea y activa para recolorear el acento de marca en TODO el sitio --
// ver TemaContext.tsx / theme.css. Solo un tema puede estar activo a la
// vez; el tema "Marca" (es_predeterminado) nunca se puede borrar, así
// siempre queda un color de respaldo si el admin elimina el resto.
export default function ModuleTemas({
  temas, onSubmit, onDelete, onActivar, onSubirImagen, onBorrarImagen, onSubirVideo, onBorrarVideo, loading,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tema | null>(null);
  const [form, setForm] = useState<TemaFormData>(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [activando, setActivando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const inputImagenRef = useRef<HTMLInputElement>(null);
  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const inputVideoRef = useRef<HTMLInputElement>(null);

  const abrirCrear = () => {
    setEditing(null);
    setForm(FORM_VACIO);
    setError("");
    setModalOpen(true);
  };

  const abrirEditar = (tema: Tema) => {
    setEditing(tema);
    setForm({
      nombre: tema.nombre,
      color_primario_claro: tema.color_primario_claro,
      color_primario_oscuro: tema.color_primario_oscuro,
      color_secundario_claro: tema.color_secundario_claro,
      color_secundario_oscuro: tema.color_secundario_oscuro,
      icono: tema.icono ?? "sparkles",
    });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nombre.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }
    for (const [campo, valor] of Object.entries(form)) {
      if (campo === "nombre" || campo === "icono") continue;
      if (!/^#[0-9a-fA-F]{6}$/.test(valor as string)) {
        setError(`Color inválido en "${campo}" — usa un hex de 6 dígitos, ej. #6e1832.`);
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(form, editing?.id_tema);
      setModalOpen(false);
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el tema.");
    } finally {
      setSaving(false);
    }
  };

  const handleActivar = async (tema: Tema) => {
    setActivando(tema.id_tema);
    try {
      await onActivar(tema);
    } finally {
      setActivando(null);
    }
  };

  // Aplica una paleta prestablecida a los 4 campos de color + el ícono
  // sugerido -- el admin puede seguir ajustándolos después, no queda fijo.
  // Si todavía no escribió un nombre, se lo sugiere también (sin pisar uno
  // que ya haya escrito).
  const aplicarPaleta = (paleta: (typeof PALETAS_PRESET)[number]) => {
    setForm(prev => ({
      ...prev,
      nombre: prev.nombre.trim() ? prev.nombre : paleta.etiqueta,
      color_primario_claro: paleta.color_primario_claro,
      color_primario_oscuro: paleta.color_primario_oscuro,
      color_secundario_claro: paleta.color_secundario_claro,
      color_secundario_oscuro: paleta.color_secundario_oscuro,
      icono: paleta.icono,
    }));
  };

  // Imagen decorativa real (opcional) -- solo disponible editando un tema
  // que ya existe, porque el endpoint necesita su id_tema (ver
  // tema_route.py::subir_imagen_tema). Se sube de inmediato al elegir el
  // archivo, aparte del botón "Guardar" del resto del formulario.
  const handleArchivoImagen = async (file: File) => {
    if (!editing) return;
    setSubiendoImagen(true);
    try {
      await onSubirImagen(editing.id_tema, file);
    } finally {
      setSubiendoImagen(false);
      if (inputImagenRef.current) inputImagenRef.current.value = "";
    }
  };

  const handleQuitarImagen = async () => {
    if (!editing) return;
    setSubiendoImagen(true);
    try {
      await onBorrarImagen(editing.id_tema);
    } finally {
      setSubiendoImagen(false);
    }
  };

  // Video decorativo del fondo del Hero (opcional) -- mismo criterio que
  // la imagen de arriba (ver tema_route.py::subir_video_tema).
  const handleArchivoVideo = async (file: File) => {
    if (!editing) return;
    setSubiendoVideo(true);
    try {
      await onSubirVideo(editing.id_tema, file);
    } finally {
      setSubiendoVideo(false);
      if (inputVideoRef.current) inputVideoRef.current.value = "";
    }
  };

  const handleQuitarVideo = async () => {
    if (!editing) return;
    setSubiendoVideo(true);
    try {
      await onBorrarVideo(editing.id_tema);
    } finally {
      setSubiendoVideo(false);
    }
  };

  // El tema editado puede haber cambiado (nueva imagen) sin que se cierre
  // el modal -- se busca la versión más fresca en `temas` en vez de
  // quedarse con la copia de `editing` capturada al abrir el modal.
  const editingActual = editing ? temas.find(t => t.id_tema === editing.id_tema) ?? editing : null;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Temas de temporada"
        subtitle="Colores de acento (botones, enlaces, navbar, footer) que se pueden activar por temporada -- Navidad, Halloween y las que crees"
        action={
          <button
            onClick={abrirCrear}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" /> Nuevo tema
          </button>
        }
      />

      {temas.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="Todavía no hay temas"
          description="Crea el primero -- necesitas al menos un tema activo para que el sitio tenga colores."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {temas.map((tema) => {
            const bloqueadoParaBorrar = tema.es_predeterminado || tema.activo;
            return (
              <div key={tema.id_tema} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
                <div className="h-20 flex relative">
                  <div className="flex-1" style={{ backgroundColor: tema.color_primario_claro }} />
                  <div className="flex-1" style={{ backgroundColor: tema.color_primario_oscuro }} />
                  <div className="flex-1" style={{ backgroundColor: tema.color_secundario_claro }} />
                  <div className="flex-1" style={{ backgroundColor: tema.color_secundario_oscuro }} />
                  {tema.imagen_url && (
                    <img
                      src={resolveImagenTema(tema.imagen_url)}
                      alt=""
                      className="absolute bottom-1.5 right-1.5 h-10 w-10 rounded-lg object-cover border-2 border-white shadow-md"
                    />
                  )}
                </div>
                <div className="p-4 flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground text-sm truncate flex items-center gap-1.5">
                      {(() => {
                        const IconoTema = getTemaIcono(tema.icono);
                        return <IconoTema className="w-3.5 h-3.5 text-primary flex-shrink-0" />;
                      })()}
                      {tema.nombre}
                      {tema.es_predeterminado && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>Tema de marca predeterminado -- no se puede eliminar</TooltipContent>
                        </Tooltip>
                      )}
                    </p>
                    <StatusBadge status={tema.activo ? "activo" : "inactivo"} />
                  </div>

                  <div className="flex flex-wrap gap-1">
                    <BadgeContraste hex={tema.color_primario_claro} contra="#ffffff" etiqueta="primario claro" />
                    <BadgeContraste hex={tema.color_primario_oscuro} contra="#ffffff" etiqueta="primario oscuro" />
                  </div>

                  <div className="mt-auto pt-3 flex items-center justify-between border-t border-border/60">
                    <button
                      onClick={() => handleActivar(tema)}
                      disabled={tema.activo || activando === tema.id_tema}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {tema.activo ? "Activo" : activando === tema.id_tema ? "Activando..." : "Activar"}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirEditar(tema)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <button
                              onClick={() => !bloqueadoParaBorrar && onDelete(tema)}
                              disabled={bloqueadoParaBorrar}
                              className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        </TooltipTrigger>
                        {bloqueadoParaBorrar && (
                          <TooltipContent>
                            {tema.es_predeterminado ? "El tema de marca no se puede eliminar" : "Activa otro tema primero"}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AdminModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Editar tema" : "Nuevo tema"}
        maxWidth="sm:max-w-xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || loading}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="tema-nombre">Nombre</Label>
            <Input
              id="tema-nombre" value={form.nombre}
              onChange={(e) => setForm(prev => ({ ...prev, nombre: e.target.value }))}
              placeholder="Ej. Navidad"
            />
          </div>

          {!editing && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Paletas prestablecidas
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PALETAS_PRESET.map((paleta) => (
                  <button
                    key={paleta.clave}
                    type="button"
                    onClick={() => aplicarPaleta(paleta)}
                    className="flex items-center gap-2 p-2 rounded-xl border border-border hover:border-primary/40 transition-all text-left"
                  >
                    <span className="flex h-7 w-7 rounded-lg overflow-hidden shrink-0 shadow-sm">
                      <span className="flex-1" style={{ backgroundColor: paleta.color_primario_claro }} />
                      <span className="flex-1" style={{ backgroundColor: paleta.color_secundario_claro }} />
                    </span>
                    <span className="text-xs font-medium text-foreground truncate">{paleta.etiqueta}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Aplica los 4 colores y un ícono sugerido -- puedes ajustarlos después.
              </p>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Primario -- botones, enlaces, sidebar
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CampoColor
                label="Modo claro"
                value={form.color_primario_claro}
                onChange={(v) => setForm(prev => ({ ...prev, color_primario_claro: v }))}
              />
              <CampoColor
                label="Modo oscuro"
                value={form.color_primario_oscuro}
                onChange={(v) => setForm(prev => ({ ...prev, color_primario_oscuro: v }))}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <BadgeContraste hex={form.color_primario_claro} contra="#ffffff" etiqueta="claro vs texto blanco" />
              <BadgeContraste hex={form.color_primario_oscuro} contra="#ffffff" etiqueta="oscuro vs texto blanco" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Secundario -- badges, detalles dorados
            </p>
            <div className="grid grid-cols-2 gap-3">
              <CampoColor
                label="Modo claro"
                value={form.color_secundario_claro}
                onChange={(v) => setForm(prev => ({ ...prev, color_secundario_claro: v }))}
              />
              <CampoColor
                label="Modo oscuro"
                value={form.color_secundario_oscuro}
                onChange={(v) => setForm(prev => ({ ...prev, color_secundario_oscuro: v }))}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <BadgeContraste hex={form.color_secundario_claro} contra="#1f1a12" etiqueta="claro vs texto oscuro" />
              <BadgeContraste hex={form.color_secundario_oscuro} contra="#1f1a12" etiqueta="oscuro vs texto oscuro" />
            </div>
          </div>

          <SelectorIcono
            value={form.icono}
            onChange={(v) => setForm(prev => ({ ...prev, icono: v }))}
          />

          <div>
            <Label>Imagen decorativa (opcional)</Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Una foto o ilustración real (ej. calabazas para Halloween, un
              árbol para Navidad) que se muestra junto al ícono cuando el
              tema está activo.
            </p>
            {!editing ? (
              <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-3 py-2">
                Guarda el tema primero -- podrás subirle una imagen después, al editarlo.
              </p>
            ) : (
              <div className="flex items-center gap-3">
                {editingActual?.imagen_url ? (
                  <img
                    src={resolveImagenTema(editingActual.imagen_url)}
                    alt=""
                    className="h-16 w-16 rounded-xl object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <input
                    ref={inputImagenRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleArchivoImagen(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={subiendoImagen}
                    onClick={() => inputImagenRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-all"
                  >
                    {subiendoImagen ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="w-3.5 h-3.5" />
                    )}
                    {editingActual?.imagen_url ? "Reemplazar" : "Subir imagen"}
                  </button>
                  {editingActual?.imagen_url && (
                    <button
                      type="button"
                      disabled={subiendoImagen}
                      onClick={handleQuitarImagen}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Quitar imagen
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <Label>Video decorativo (opcional)</Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Un clip corto (MP4 o WEBM, máx. 15MB) para el fondo del Hero
              cuando este tema está activo -- ej. nieve cayendo para
              Navidad. Si no subes ninguno, el Hero usa el video genérico
              de por defecto.
            </p>
            {!editing ? (
              <p className="text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-3 py-2">
                Guarda el tema primero -- podrás subirle un video después, al editarlo.
              </p>
            ) : (
              <div className="flex items-center gap-3">
                {editingActual?.video_url ? (
                  <video
                    src={resolveVideoTema(editingActual.video_url)}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="h-16 w-16 rounded-xl object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-xl border border-dashed border-border flex items-center justify-center text-muted-foreground shrink-0">
                    <FileVideo className="w-5 h-5" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <input
                    ref={inputVideoRef}
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleArchivoVideo(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={subiendoVideo}
                    onClick={() => inputVideoRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 transition-all"
                  >
                    {subiendoVideo ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileVideo className="w-3.5 h-3.5" />
                    )}
                    {editingActual?.video_url ? "Reemplazar" : "Subir video"}
                  </button>
                  {editingActual?.video_url && (
                    <button
                      type="button"
                      disabled={subiendoVideo}
                      onClick={handleQuitarVideo}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                      Quitar video
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Verificación de contraste según WCAG 2.1 AA (mínimo 4.5:1) -- el
            mismo nivel que exige la Resolución MinTIC 1519 de 2020 para
            sitios del Estado colombiano. Un tema puede guardarse aunque
            algún color falle, pero no se recomienda: el texto encima
            podría no leerse bien.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </AdminModal>
    </div>
  );
}
