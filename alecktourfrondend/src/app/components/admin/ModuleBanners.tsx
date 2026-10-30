import { useEffect, useState } from "react";
import {
  Megaphone, Plus, Pencil, Trash2, ArrowUp, ArrowDown, ImageIcon, Calendar, Link as LinkIcon, Sparkles, Newspaper,
} from "lucide-react";
import { Banner, BannerFormData, resolveImagenBanner } from "../../services/banner.service";
import { Tema, temaService } from "../../services/tema.service";
import AdminModal from "./ui/AdminModal";
import SectionHeader from "./ui/SectionHeader";
import EmptyState from "./ui/EmptyState";
import StatusBadge from "./ui/StatusBadge";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";

interface Props {
  banners: Banner[];
  onSubmit: (data: BannerFormData, id?: number) => Promise<void>;
  onDelete: (id: number) => void;
  onToggleActivo: (banner: Banner) => Promise<void>;
  onReordenar: (items: { id_banner: number; orden: number }[]) => Promise<void>;
  loading: boolean;
}

const FORM_VACIO: BannerFormData = {
  titulo: "", descripcion_corta: "", texto_boton: "", link_destino: "",
  fecha_inicio: "", fecha_fin: "", temporada: "", tipo: "banner", activo: true,
};

function formatFecha(f: string | null): string {
  if (!f) return "Sin límite";
  return new Date(f + "T00:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

// Sección 7 del plan de mejora: banners publicitarios administrables (home
// carousel / oferta destacada) — /api/banners es una tabla real nueva,
// distinta de /api/promociones (que deriva de hoteles). Ver
// BannersPromocionales.tsx para el consumo público.
export default function ModuleBanners({ banners, onSubmit, onDelete, onToggleActivo, onReordenar, loading }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<BannerFormData>(FORM_VACIO);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Catálogo de temas de temporada (Navidad, Halloween, etc.) para el
  // selector de "Temporada" -- se pide solo acá (no llega por props) para
  // no acoplar Admindashboard.tsx a esto; si falla, el selector simplemente
  // queda con una sola opción ("Todo el año"), nunca rompe el módulo.
  const [temas, setTemas] = useState<Tema[]>([]);

  useEffect(() => {
    temaService.getAll().then(setTemas).catch(() => setTemas([]));
  }, []);

  const nombreTemporada = (clave: string | null): string | null => {
    if (!clave) return null;
    return temas.find((t) => t.clave === clave)?.nombre ?? clave;
  };

  const ordenados = [...banners].sort((a, b) => a.orden - b.orden);
  // Banners (carrusel del home + acordeón "Ventajas de la oferta", y
  // respaldo del splash si no hay ningún folleto activo) y folletos (el
  // anuncio a pantalla completa que se ve al entrar al sitio, ver
  // WelcomeSplash.tsx) se administran en la misma tabla pero se muestran en
  // dos grupos separados acá -- cada uno se reordena de forma independiente,
  // nunca se mezclan entre sí porque el sitio público también los pide por
  // separado (bannerService.getActivos("banner"|"folleto")).
  const bannersOrdenados = ordenados.filter((b) => b.tipo !== "folleto");
  const folletosOrdenados = ordenados.filter((b) => b.tipo === "folleto");

  const abrirCrear = (tipo: "banner" | "folleto" = "banner") => {
    setEditing(null);
    setForm({ ...FORM_VACIO, tipo });
    setImagenPreview(null);
    setError("");
    setModalOpen(true);
  };

  const abrirEditar = (banner: Banner) => {
    setEditing(banner);
    setForm({
      titulo: banner.titulo,
      descripcion_corta: banner.descripcion_corta ?? "",
      texto_boton: banner.texto_boton ?? "",
      link_destino: banner.link_destino ?? "",
      fecha_inicio: banner.fecha_inicio ?? "",
      fecha_fin: banner.fecha_fin ?? "",
      temporada: banner.temporada ?? "",
      tipo: banner.tipo,
      activo: banner.activo,
    });
    setImagenPreview(resolveImagenBanner(banner.imagen_url));
    setError("");
    setModalOpen(true);
  };

  const onSeleccionarImagen = (file: File | undefined) => {
    if (!file) return;
    setForm(prev => ({ ...prev, imagen: file }));
    // Preview local vía createObjectURL — nunca se sube nada hasta el submit
    // real del formulario (ver AdminModal / handleSubmit más abajo).
    setImagenPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!form.titulo.trim()) {
      setError("El título es obligatorio.");
      return;
    }
    if (!editing && !form.imagen) {
      setError("Selecciona una imagen para el banner.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(form, editing?.id_banner);
      setModalOpen(false);
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el banner.");
    } finally {
      setSaving(false);
    }
  };

  const moverEnLista = (lista: Banner[], index: number, direction: -1 | 1) => {
    const destino = index + direction;
    if (destino < 0 || destino >= lista.length) return;
    const copia = [...lista];
    [copia[index], copia[destino]] = [copia[destino], copia[index]];
    onReordenar(copia.map((b, i) => ({ id_banner: b.id_banner, orden: i })));
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Promociones y banners"
        subtitle="Banners del carrusel del home y folletos del anuncio de bienvenida a pantalla completa"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => abrirCrear("banner")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:opacity-90 transition-all"
            >
              <Plus className="w-4 h-4" /> Nuevo banner
            </button>
            <button
              onClick={() => abrirCrear("folleto")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-all"
            >
              <Newspaper className="w-4 h-4" /> Nuevo folleto
            </button>
          </div>
        }
      />

      {ordenados.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Todavía no hay banners ni folletos"
          description="Crea un banner para el carrusel del home, o un folleto para el anuncio de bienvenida a pantalla completa."
        />
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-bold text-foreground">Banners (carrusel del home)</h3>
            {bannersOrdenados.length === 0 ? (
              <p className="text-xs text-muted-foreground">Todavía no hay banners.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {bannersOrdenados.map((banner, i) => (
                  <div key={banner.id_banner} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="relative h-36 bg-muted">
                      <img src={resolveImagenBanner(banner.imagen_url)} alt={banner.titulo} className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2">
                        <StatusBadge status={banner.activo ? "activo" : "inactivo"} />
                      </div>
                      {banner.temporada && (
                        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-semibold">
                          <Sparkles className="w-2.5 h-2.5" />
                          {nombreTemporada(banner.temporada)}
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-2">
                      <p className="font-semibold text-foreground text-sm truncate">{banner.titulo}</p>
                      {banner.descripcion_corta && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{banner.descripcion_corta}</p>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        {formatFecha(banner.fecha_inicio)} → {formatFecha(banner.fecha_fin)}
                      </div>
                      {banner.link_destino && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                          <LinkIcon className="w-3 h-3 flex-shrink-0" /> {banner.link_destino}
                        </div>
                      )}

                      <div className="mt-auto pt-3 flex items-center justify-between border-t border-border/60">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moverEnLista(bannersOrdenados, i, -1)}
                            disabled={i === 0}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Subir"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moverEnLista(bannersOrdenados, i, 1)}
                            disabled={i === bannersOrdenados.length - 1}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Bajar"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={banner.activo}
                            onCheckedChange={() => onToggleActivo(banner)}
                          />
                          <button
                            onClick={() => abrirEditar(banner)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(banner.id_banner)}
                            className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Newspaper className="w-4 h-4 text-primary" /> Folletos (anuncio de bienvenida a pantalla completa)
            </h3>
            <p className="text-xs text-muted-foreground -mt-1">
              Todos los folletos activos se muestran como carrusel al entrar al sitio, en este orden (usa las flechas
              para cambiarlo). Pasan solos cada 5 segundos y el visitante puede deslizarlos.
            </p>
            {folletosOrdenados.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Todavía no hay folletos -- el anuncio de bienvenida simplemente cae al banner activo (si hay) hasta que crees el primero.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {folletosOrdenados.map((banner, i) => (
                  <div key={banner.id_banner} className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col">
                    <div className="relative h-36 bg-muted">
                      <img src={resolveImagenBanner(banner.imagen_url)} alt={banner.titulo} className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2">
                        <StatusBadge status={banner.activo ? "activo" : "inactivo"} />
                      </div>
                      {banner.temporada && (
                        <div className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-semibold">
                          <Sparkles className="w-2.5 h-2.5" />
                          {nombreTemporada(banner.temporada)}
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col gap-2">
                      <p className="font-semibold text-foreground text-sm truncate">{banner.titulo}</p>
                      <p className="text-[10px] text-muted-foreground italic">Nombre interno -- no se muestra en el sitio.</p>
                      {banner.link_destino && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                          <LinkIcon className="w-3 h-3 flex-shrink-0" /> {banner.link_destino}
                        </div>
                      )}

                      <div className="mt-auto pt-3 flex items-center justify-between border-t border-border/60">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => moverEnLista(folletosOrdenados, i, -1)}
                            disabled={i === 0}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Subir"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moverEnLista(folletosOrdenados, i, 1)}
                            disabled={i === folletosOrdenados.length - 1}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Bajar"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={banner.activo}
                            onCheckedChange={() => onToggleActivo(banner)}
                          />
                          <button
                            onClick={() => abrirEditar(banner)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(banner.id_banner)}
                            className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-all"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <AdminModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={
          form.tipo === "folleto"
            ? (editing ? "Editar folleto" : "Nuevo folleto")
            : (editing ? "Editar banner" : "Nuevo banner")
        }
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
            <Label>Imagen {!editing && <span className="text-destructive">*</span>}</Label>
            <label className="mt-1.5 flex items-center justify-center h-36 rounded-xl border-2 border-dashed border-border bg-muted/40 cursor-pointer overflow-hidden hover:border-primary/40 transition-colors">
              {imagenPreview ? (
                <img src={imagenPreview} alt="Vista previa" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                  <ImageIcon className="w-6 h-6" />
                  <span className="text-xs px-4 text-center">
                    {form.tipo === "folleto"
                      ? "Sube la pieza completa (JPG, PNG o WEBP, máx. 5MB) -- el texto de la oferta ya va dibujado en la imagen"
                      : "Haz clic para elegir una imagen (JPG, PNG o WEBP, máx. 5MB)"}
                  </span>
                </div>
              )}
              <input
                type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => onSeleccionarImagen(e.target.files?.[0])}
              />
            </label>
          </div>

          <div>
            <Label htmlFor="banner-titulo">
              {form.tipo === "folleto" ? "Nombre interno" : "Título"}
            </Label>
            <Input
              id="banner-titulo" value={form.titulo}
              onChange={(e) => setForm(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder={form.tipo === "folleto" ? "Ej. Folleto Halloween - vuelos" : "Ej. Escápate a San Andrés"}
            />
            {form.tipo === "folleto" && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Solo para identificarlo acá en el panel -- no se muestra en el sitio (el texto de la oferta ya va dibujado en la imagen).
              </p>
            )}
          </div>

          {form.tipo !== "folleto" && (
            <div>
              <Label htmlFor="banner-descripcion">Descripción corta</Label>
              <Textarea
                id="banner-descripcion" value={form.descripcion_corta}
                onChange={(e) => setForm(prev => ({ ...prev, descripcion_corta: e.target.value }))}
                placeholder="Una línea que aparece debajo del título en el banner"
                rows={2}
              />
            </div>
          )}

          <div className={form.tipo === "folleto" ? "" : "grid grid-cols-2 gap-3"}>
            {form.tipo !== "folleto" && (
              <div>
                <Label htmlFor="banner-boton">Texto del botón</Label>
                <Input
                  id="banner-boton" value={form.texto_boton}
                  onChange={(e) => setForm(prev => ({ ...prev, texto_boton: e.target.value }))}
                  placeholder="Ej. Ver oferta"
                />
              </div>
            )}
            <div>
              <Label htmlFor="banner-link">Link de destino {form.tipo === "folleto" && "(opcional)"}</Label>
              <Input
                id="banner-link" value={form.link_destino}
                onChange={(e) => setForm(prev => ({ ...prev, link_destino: e.target.value }))}
                placeholder="/search?destino=..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="banner-inicio">Vigente desde</Label>
              <Input
                id="banner-inicio" type="date" value={form.fecha_inicio}
                onChange={(e) => setForm(prev => ({ ...prev, fecha_inicio: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="banner-fin">Vigente hasta</Label>
              <Input
                id="banner-fin" type="date" value={form.fecha_fin}
                onChange={(e) => setForm(prev => ({ ...prev, fecha_fin: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">Deja las fechas vacías para que no tenga límite en ese extremo.</p>

          <div>
            <Label htmlFor="banner-temporada">Temporada</Label>
            <select
              id="banner-temporada"
              value={form.temporada ?? ""}
              onChange={(e) => setForm(prev => ({ ...prev, temporada: e.target.value }))}
              className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground"
            >
              <option value="">Todo el año (sin temporada)</option>
              {temas.filter(t => !t.es_predeterminado).map((t) => (
                <option key={t.id_tema} value={t.clave}>{t.nombre}</option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Si eliges una temporada, este banner solo aparece en el carrusel público mientras ese tema esté activo (ver ModuleTemas.tsx) — el resto del tiempo queda oculto automáticamente.
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl">
            <Label htmlFor="banner-activo" className="cursor-pointer">Banner activo</Label>
            <Switch
              id="banner-activo" checked={form.activo}
              onCheckedChange={(v) => setForm(prev => ({ ...prev, activo: v }))}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </AdminModal>
    </div>
  );
}
