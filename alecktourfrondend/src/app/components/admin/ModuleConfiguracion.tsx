import { useEffect, useState } from "react";
import { Settings, Plus, Pencil, Trash2, AlertCircle, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  configuracionService, type ConfiguracionItem,
} from "../../services/configuracion.service";
import AdminModal from "./ui/AdminModal";
import SectionHeader from "./ui/SectionHeader";
import EmptyState from "./ui/EmptyState";
import { labelCls } from "./types";

function formatFecha(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Módulo de "Configuración": administra ConfiguracionSistema, un almacén
// clave/valor real (ver backend/app/models/configuracion_model.py) — no
// una lista de switches inventados. Cada parámetro guardado acá se conecta
// a comportamiento real del sitio a medida que esa parte se construye; por
// ahora es el lugar centralizado para no seguir hardcodeando valores en el
// código (en vez de fabricar un panel de ajustes que en realidad no
// cambiaría nada).
export default function ModuleConfiguracion() {
  const [items, setItems] = useState<ConfiguracionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ConfiguracionItem | null>(null);
  const [form, setForm] = useState({ clave: "", valor: "", descripcion: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<ConfiguracionItem | null>(null);

  const cargar = async () => {
    setLoading(true);
    try { setItems(await configuracionService.getAll()); } catch { /* no crítico */ } finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, []);

  // Valor del call center (precio/honorario): se crea automáticamente la
  // primera vez que se abre el módulo si aún no existe, como una clave/valor
  // real de ConfiguracionSistema — así el honorario siempre está visible y
  // editable por el admin, sin necesidad de un seed manual en la BD.
  useEffect(() => {
    if (loading) return;
    const yaExiste = items.some((i) => i.clave === "call_center_honorario");
    if (!yaExiste) {
      configuracionService
        .create({
          clave: "call_center_honorario",
          valor: "50000",
          descripcion: "Valor del call center: precio/honorario por asesoría (COP).",
        })
        .then(() => cargar())
        .catch(() => { /* no bloquea: el admin puede crearla a mano */ });
    }
  }, [loading, items]);

  // Formatea el valor del call center como moneda cuando la clave existe.
  function formatearValor(item: ConfiguracionItem): string {
    if (item.clave !== "call_center_honorario" || !item.valor) return item.valor || "";
    const numero = Number(String(item.valor).replace(/[^\d-]/g, ""));
    if (Number.isNaN(numero)) return item.valor;
    return `$${numero.toLocaleString("es-CO")} COP`;
  }

  function openCreate() {
    setEditing(null);
    setForm({ clave: "", valor: "", descripcion: "" });
    setError("");
    setModalOpen(true);
  }
  function openEdit(item: ConfiguracionItem) {
    setEditing(item);
    setForm({ clave: item.clave, valor: item.valor ?? "", descripcion: item.descripcion ?? "" });
    setError("");
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.clave.trim() && !editing) { setError("La clave es obligatoria"); return; }
    setSaving(true); setError("");
    try {
      if (editing) {
        await configuracionService.update(editing.id_config, { valor: form.valor, descripcion: form.descripcion });
        toast.success("Parámetro actualizado");
      } else {
        await configuracionService.create({ clave: form.clave.trim(), valor: form.valor, descripcion: form.descripcion });
        toast.success("Parámetro creado");
      }
      setModalOpen(false);
      await cargar();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el parámetro");
    } finally {
      setSaving(false);
    }
  }

  async function confirmarEliminar() {
    if (!deleting) return;
    try {
      await configuracionService.delete(deleting.id_config);
      toast.success("Parámetro eliminado");
      setDeleting(null);
      await cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar el parámetro");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <SectionHeader
          title="Configuración"
          subtitle={`${items.length} parámetro${items.length === 1 ? "" : "s"} guardado${items.length === 1 ? "" : "s"}`}
        />        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all
            bg-gradient-to-r from-primary to-[#A13B55] hover:shadow-lg hover:shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Nuevo parámetro
        </button>
      </div>

      {loading ? (
        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length > 0 ? (
        <div className="bg-card rounded-2xl shadow-sm border border-border divide-y divide-border/50">
          {items.map(item => (
            <div key={item.id_config} className="flex items-start gap-3 p-4">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Settings className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground font-mono">{item.clave}</p>
                <p className="text-sm text-foreground/80 mt-0.5 break-words">
                  {item.clave === "call_center_honorario"
                    ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="font-bold text-primary">{formatearValor(item) || <span className="text-muted-foreground italic font-normal">sin valor</span>}</span>
                        {item.valor && <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Honorario call center</span>}
                      </span>
                    )
                    : (item.valor || <span className="text-muted-foreground italic">sin valor</span>)}
                </p>
                {item.descripcion && <p className="text-xs text-muted-foreground mt-1">{item.descripcion}</p>}
                <p className="text-[11px] text-muted-foreground mt-1.5">Actualizado {formatFecha(item.actualizado_en)}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button aria-label="Editar" onClick={() => openEdit(item)} className="p-1.5 text-primary/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all" title="Editar">
                  <Pencil className="w-4 h-4" />
                </button>
                <button aria-label="Eliminar" onClick={() => setDeleting(item)} className="p-1.5 text-destructive/60 hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all" title="Eliminar">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Settings}
          title="Sin parámetros configurados"
          description="Todavía no hay ningún parámetro del sistema guardado."
          action={(
            <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-2 bg-muted hover:bg-muted/70 text-foreground rounded-lg text-xs font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" /> Crear el primero
            </button>
          )}
        />
      )}

      <AdminModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? `Editar ${editing.clave}` : "Nuevo parámetro"}
        maxWidth="sm:max-w-sm"
      >
        <div className="space-y-3">
          {!editing && (
            <div>
              <label className={labelCls}>Clave</label>
              <input maxLength={100}
                value={form.clave}
                onChange={e => setForm({ ...form, clave: e.target.value })}
                placeholder="ej. contacto_whatsapp"
                className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          )}
          <div>
            <label className={labelCls}>Valor</label>
            <input maxLength={80}
              value={form.valor}
              onChange={e => setForm({ ...form, valor: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div>
            <label className={labelCls}>Descripción (opcional)</label>
            <input maxLength={80}
              value={form.descripcion}
              onChange={e => setForm({ ...form, descripcion: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-border rounded-lg text-sm bg-card text-foreground outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          {error && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {error}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
              bg-gradient-to-r from-primary to-[#A13B55] text-white hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </AdminModal>

      <AdminModal open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} title="Eliminar parámetro" maxWidth="sm:max-w-sm">
        {deleting && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">¿Eliminar <span className="font-mono font-medium text-foreground">{deleting.clave}</span>? Esta acción no se puede deshacer.</p>
            <button
              onClick={confirmarEliminar}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-white bg-destructive hover:opacity-90 transition-all"
            >
              <Trash2 className="w-4 h-4" /> Eliminar
            </button>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
