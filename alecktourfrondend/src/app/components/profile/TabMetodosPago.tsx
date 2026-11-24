import {
  ShieldCheck,
  Banknote,
  Building2,
  Check,
  CreditCard,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import EncabezadoTab, { PanelPerfil, VacioPerfil } from "./EncabezadoTab";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  MetodoPagoGuardado,
  metodoPagoGuardadoService,
} from "../../services/metodoPagoGuardado.service";

// Antes esta sección vivía como "SECCIÓN 3" adentro de TabCuenta.tsx,
// mezclada entre foto de perfil, datos personales y seguridad -- se movió
// a su propio tab del sidebar (ver ProfileSidebar.tsx/Profile.tsx) para que
// el cliente la encuentre directo en vez de tener que entrar a "Mi Cuenta"
// y bajar hasta la mitad. Toda la lógica (estado, handlers, endpoints) es
// exactamente la misma que ya estaba probada ahí, solo cambió dónde vive.

const TIPOS_METODO_PAGO: { id: string; label: string; icon: typeof CreditCard }[] = [
  { id: "tarjeta_credito", label: "Tarjeta de crédito", icon: CreditCard },
  { id: "tarjeta_debito", label: "Tarjeta de débito", icon: CreditCard },
  { id: "pse", label: "PSE", icon: Building2 },
  { id: "nequi", label: "Nequi", icon: Smartphone },
  { id: "paypal", label: "PayPal", icon: Wallet },
  { id: "otro", label: "Otro", icon: Banknote },
];

function iconoMetodoPago(tipo: string) {
  return TIPOS_METODO_PAGO.find((t) => t.id === tipo)?.icon ?? Banknote;
}

function labelMetodoPago(tipo: string) {
  return TIPOS_METODO_PAGO.find((t) => t.id === tipo)?.label ?? tipo;
}

interface Props {
  // true cuando este tab es un paso obligatorio (cuenta nueva sin ningún
  // método de pago guardado todavía, ver requiereMetodoPago en Profile.tsx)
  // en vez del uso normal/opcional de este tab.
  obligatorio?: boolean;
  // Le avisa al padre (Profile.tsx) cada vez que la lista local cambia --
  // así el bloqueo del resto del perfil se levanta apenas se guarda el
  // primer método, sin recargar la página. Puede pasarse directo el
  // setState del padre (misma firma que Dispatch<SetStateAction<...>>).
  onMetodosChange?: (metodos: MetodoPagoGuardado[]) => void;
}

export default function TabMetodosPago({ obligatorio = false, onMetodosChange }: Props) {
  const [metodosGuardados, setMetodosGuardados] = useState<MetodoPagoGuardado[]>([]);
  const [cargandoMetodos, setCargandoMetodos] = useState(true);
  const [mostrarFormMetodo, setMostrarFormMetodo] = useState(false);
  const [guardandoMetodo, setGuardandoMetodo] = useState(false);
  const [eliminandoMetodoId, setEliminandoMetodoId] = useState<number | null>(null);
  const [editandoMetodoId, setEditandoMetodoId] = useState<number | null>(null);
  const [formMetodo, setFormMetodo] = useState({
    alias: "",
    tipo: "tarjeta_credito",
    ultimos4: "",
    clave: "",
    confirmarClave: "",
    predeterminado: false,
  });

  useEffect(() => {
    metodoPagoGuardadoService
      .getAll()
      .then(setMetodosGuardados)
      .catch(() => setMetodosGuardados([]))
      .finally(() => setCargandoMetodos(false));
  }, []);

  // Reenvía cada cambio de la lista local al padre -- crear/editar/eliminar
  // pasan todos por el mismo setMetodosGuardados de arriba, así que un solo
  // efecto alcanza para mantener a Profile.tsx sincronizado sin duplicar
  // los handlers de abajo. El guard de cargandoMetodos es importante: sin
  // él, este efecto reportaría el [] inicial (antes de que el fetch de
  // arriba resuelva) cada vez que este tab se vuelve a montar, pisando por
  // un instante el metodosGuardados real que Profile.tsx ya tenía y
  // haciendo parpadear el bloqueo para un cliente que ya había guardado un
  // método y solo volvió a esta pestaña a revisarlo.
  useEffect(() => {
    if (cargandoMetodos) return;
    onMetodosChange?.(metodosGuardados);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metodosGuardados, cargandoMetodos]);

  // Con la lista ya cargada y todavía vacía, si este tab es obligatorio se
  // abre el formulario de una vez -- evita el clic extra de "Agregar" en un
  // flujo donde el cliente no tiene otra opción de todas formas.
  useEffect(() => {
    if (obligatorio && !cargandoMetodos && metodosGuardados.length === 0) {
      setMostrarFormMetodo(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obligatorio, cargandoMetodos, metodosGuardados.length]);

  // Solo cuando es obligatorio Y todavía no hay ningún método guardado no
  // tiene sentido dejar "Cancelar" -- no habría nada que conservar y de
  // todas formas no puede salir de este tab hasta guardar uno.
  const puedeCancelarFormulario = useMemo(
    () => !(obligatorio && metodosGuardados.length === 0),
    [obligatorio, metodosGuardados.length],
  );

  const resetFormMetodo = () => {
    setEditandoMetodoId(null);
    setFormMetodo({
      alias: "",
      tipo: "tarjeta_credito",
      ultimos4: "",
      clave: "",
      confirmarClave: "",
      predeterminado: false,
    });
  };

  const iniciarEdicionMetodo = (metodo: MetodoPagoGuardado) => {
    setEditandoMetodoId(metodo.id_metodo_guardado);
    setMostrarFormMetodo(true);
    setFormMetodo({
      alias: metodo.alias,
      tipo: metodo.tipo,
      ultimos4: metodo.ultimos4 ?? "",
      // La clave real está hasheada y no puede mostrarse: al editar se deja
      // en blanco para CONSERVAR la actual; solo se re-emite si se escribe.
      clave: "",
      confirmarClave: "",
      predeterminado: metodo.predeterminado,
    });
  };

  const handleGuardarMetodo = async () => {
    const esEdicion = editandoMetodoId !== null;
    if (!formMetodo.alias.trim()) {
      toast.error("Ponle un alias a tu método de pago (ej. \"Visa personal\").");
      return;
    }
    if (formMetodo.ultimos4 && !/^\d{4}$/.test(formMetodo.ultimos4)) {
      toast.error("Los últimos 4 dígitos deben ser 4 números.");
      return;
    }
    // Al crear, la clave es obligatoria; al editar, opcional (si se deja en
    // blanco se conserva la actual, que está hasheada y no puede mostrarse).
    const claveIngresada = formMetodo.clave;
    if (claveIngresada && !/^\d{4,6}$/.test(claveIngresada)) {
      toast.error("La clave de confirmación debe ser numérica, de 4 a 6 dígitos.");
      return;
    }
    if (claveIngresada && claveIngresada !== formMetodo.confirmarClave) {
      toast.error("Las claves no coinciden.");
      return;
    }
    if (!esEdicion && !claveIngresada) {
      toast.error("Ingresa una clave de confirmación (4 a 6 dígitos).");
      return;
    }

    setGuardandoMetodo(true);
    try {
      if (esEdicion) {
        const actualizado = await metodoPagoGuardadoService.update(editandoMetodoId, {
          alias: formMetodo.alias.trim(),
          tipo: formMetodo.tipo,
          ultimos4: formMetodo.ultimos4 || undefined,
          ...(claveIngresada ? { clave: claveIngresada } : {}),
          predeterminado: formMetodo.predeterminado,
        });
        setMetodosGuardados((prev) =>
          prev.map((m) =>
            m.id_metodo_guardado === actualizado.id_metodo_guardado
              ? actualizado
              : actualizado.predeterminado
                ? { ...m, predeterminado: false }
                : m
          )
        );
        resetFormMetodo();
        setMostrarFormMetodo(false);
        toast.success("Método de pago actualizado.");
      } else {
        const nuevo = await metodoPagoGuardadoService.create({
          alias: formMetodo.alias.trim(),
          tipo: formMetodo.tipo,
          ultimos4: formMetodo.ultimos4 || undefined,
          clave: formMetodo.clave,
          predeterminado: formMetodo.predeterminado,
        });
        setMetodosGuardados((prev) => [
          nuevo,
          ...(nuevo.predeterminado ? prev.map((m) => ({ ...m, predeterminado: false })) : prev),
        ]);
        resetFormMetodo();
        setMostrarFormMetodo(false);
        toast.success("Método de pago guardado. Tu clave quedó protegida con hash, nunca en texto plano.");
      }
    } catch (err: any) {
      toast.error(err?.message || "No pudimos guardar el método de pago.");
    } finally {
      setGuardandoMetodo(false);
    }
  };

  const handleEliminarMetodo = async (id: number) => {
    setEliminandoMetodoId(id);
    try {
      await metodoPagoGuardadoService.delete(id);
      setMetodosGuardados((prev) => prev.filter((m) => m.id_metodo_guardado !== id));
      toast.success("Método de pago eliminado");
    } catch (err: any) {
      toast.error(err?.message || "No pudimos eliminar este método de pago.");
    } finally {
      setEliminandoMetodoId(null);
    }
  };

  return (
    <div className="w-full">
      <EncabezadoTab
        titulo="Métodos de pago"
        descripcion="Las cuentas y tarjetas con las que pagas tus reservas. Al pagar, eliges una y la confirmas con tu clave."
        accion={
          !mostrarFormMetodo && (
            <button
              onClick={() => setMostrarFormMetodo(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Agregar método
            </button>
          )
        }
      />

      <PanelPerfil>
        <div className="mb-5 flex gap-3 rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          <p>
            Nunca guardamos el número completo de tu tarjeta o cuenta: solo un alias, los últimos 4 dígitos y tu clave
            protegida con hash, igual que tu contraseña.
          </p>
        </div>

        {cargandoMetodos ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando métodos guardados...
          </div>
        ) : (
          <div className="mb-2 grid gap-3 sm:grid-cols-2">
            {metodosGuardados.map((metodo) => {
              const Icon = iconoMetodoPago(metodo.tipo);
              return (
                <div
                  key={metodo.id_metodo_guardado}
                  className={`flex items-center justify-between gap-3 rounded-2xl border bg-background p-4 ${
                    metodo.predeterminado ? "border-primary/40 ring-1 ring-primary/15" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Icon className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate flex items-center gap-2">
                        {metodo.alias}
                        {metodo.predeterminado && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            Principal
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {labelMetodoPago(metodo.tipo)}
                        {metodo.ultimos4 && ` · •••• ${metodo.ultimos4}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => iniciarEdicionMetodo(metodo)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-colors shrink-0"
                      title="Editar método de pago"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEliminarMetodo(metodo.id_metodo_guardado)}
                      disabled={eliminandoMetodoId === metodo.id_metodo_guardado}
                      className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-colors disabled:opacity-50 shrink-0"
                      title="Eliminar método de pago"
                    >
                      {eliminandoMetodoId === metodo.id_metodo_guardado ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}

            {metodosGuardados.length === 0 && !mostrarFormMetodo && (
              <div className="sm:col-span-2">
                <VacioPerfil
                  icono={Wallet}
                  titulo="Aún no tienes métodos de pago"
                  texto="Agrega Nequi, una tarjeta o tu cuenta para pagar tus reservas en pocos pasos."
                  accion={
                    <button
                      onClick={() => setMostrarFormMetodo(true)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      <Plus className="h-4 w-4" /> Agregar método
                    </button>
                  }
                />
              </div>
            )}
          </div>
        )}

        {mostrarFormMetodo && (
          <div className="bg-background border border-primary/30 rounded-2xl p-5 mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                {editandoMetodoId !== null ? "Editar método de pago" : "Nuevo método de pago"}
              </h3>
            </div>
            {editandoMetodoId !== null && (
              <p className="text-xs text-muted-foreground">
                Deja la clave en blanco para conservar la actual (está protegida con hash, no podemos mostrarla).
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Alias</label>
                <input
                  type="text"
                  value={formMetodo.alias}
                  onChange={(e) => setFormMetodo((f) => ({ ...f, alias: e.target.value }))}
                  placeholder="Ej. Visa personal"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Tipo</label>
                <select
                  value={formMetodo.tipo}
                  onChange={(e) => setFormMetodo((f) => ({ ...f, tipo: e.target.value }))}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                >
                  {TIPOS_METODO_PAGO.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Últimos 4 dígitos (opcional)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={formMetodo.ultimos4}
                  onChange={(e) => setFormMetodo((f) => ({ ...f, ultimos4: e.target.value.replace(/\D/g, "") }))}
                  placeholder="1234"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Marcar como predeterminado
                </span>
                <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formMetodo.predeterminado}
                    onChange={(e) => setFormMetodo((f) => ({ ...f, predeterminado: e.target.checked }))}
                    className="w-4 h-4 text-primary rounded"
                  />
                  <span className="text-sm text-foreground">Usar por defecto al pagar</span>
                </label>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Clave de confirmación (4-6 dígitos)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={formMetodo.clave}
                  onChange={(e) => setFormMetodo((f) => ({ ...f, clave: e.target.value.replace(/\D/g, "") }))}
                  placeholder="••••"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Confirmar clave</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={formMetodo.confirmarClave}
                  onChange={(e) => setFormMetodo((f) => ({ ...f, confirmarClave: e.target.value.replace(/\D/g, "") }))}
                  placeholder="••••"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleGuardarMetodo}
                disabled={guardandoMetodo}
                className="text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 px-5 py-2.5 rounded-full transition-colors disabled:opacity-50"
              >
                {guardandoMetodo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editandoMetodoId !== null ? "Guardar cambios" : "Guardar método"}
              </button>
              {puedeCancelarFormulario && (
                <button
                  onClick={() => {
                    setMostrarFormMetodo(false);
                    resetFormMetodo();
                  }}
                  disabled={guardandoMetodo}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 px-4 py-2.5 rounded-full transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </PanelPerfil>
    </div>
  );
}
