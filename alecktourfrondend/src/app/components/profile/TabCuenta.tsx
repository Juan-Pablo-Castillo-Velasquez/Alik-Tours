import { Camera, Check, Eye, EyeOff, Lock, Loader2, Pencil, ShieldAlert, User, X } from "lucide-react";
import EncabezadoTab from "./EncabezadoTab";
import ErrorCampo from "../shared/ErrorCampo";
import { limpiarTelefono, mensajeErrorEnvio, validarFormulario, type Reglas } from "../../utils/validacionFormulario";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { resolveFotoUrl } from "../admin/types";
import { useAuth } from "../../context/AuthContext";
import { ClienteResponse, clienteService } from "../../services/cliente.service";
import { usuarioService } from "../../services/usuario.service";

interface Props {
  clienteData: ClienteResponse | null;
  onClienteActualizado?: (cliente: ClienteResponse) => void;
}

const CAMPOS_EDITABLES = [
  { name: "nombre", label: "Nombre", required: true, max: 100 },
  { name: "apellido", label: "Apellido", required: true, max: 100 },
  { name: "correo", label: "Correo Electrónico", type: "email", max: 100 },
  { name: "celular", label: "Teléfono Celular", max: 20 },
  { name: "ciudad", label: "Ciudad", max: 100 },
  { name: "pais", label: "País", max: 100 },
  { name: "direccion", label: "Dirección de Residencia", max: 255 },
  { name: "fecha_nacimiento", label: "Fecha de Nacimiento", type: "date" },
] as const;

type CampoTexto = "nombre" | "apellido" | "correo" | "celular" | "ciudad" | "pais" | "direccion";
// Mismos límites que ClienteUpdate en el backend (cliente_schema.py).
const REGLAS_CUENTA: Reglas<CampoTexto> = {
  nombre: { etiqueta: "El nombre", obligatorio: true, min: 2, max: 100 },
  apellido: { etiqueta: "El apellido", obligatorio: true, min: 2, max: 100 },
  correo: { etiqueta: "El correo", tipo: "correo", max: 100 },
  celular: { etiqueta: "El celular", tipo: "telefono", max: 20 },
  ciudad: { etiqueta: "La ciudad", min: 2, max: 100 },
  pais: { etiqueta: "El país", min: 2, max: 100 },
  direccion: { etiqueta: "La dirección", min: 3, max: 255 },
};

const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5MB

function formatearFecha(fecha: string | null | undefined) {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return fecha;
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function TabCuenta({ clienteData, onClienteActualizado }: Props) {
  const { usuario, updateUsuario } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [contrasenaActual, setContrasenaActual] = useState("");
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  const [editandoPersonal, setEditandoPersonal] = useState(false);
  const [formPersonal, setFormPersonal] = useState<Record<string, string>>({});
  const [guardandoPersonal, setGuardandoPersonal] = useState(false);

  useEffect(() => {
    if (!clienteData) return;
    setFormPersonal({
      nombre: clienteData.nombre ?? "",
      apellido: clienteData.apellido ?? "",
      correo: clienteData.correo ?? "",
      celular: clienteData.celular ?? "",
      ciudad: clienteData.ciudad ?? "",
      pais: clienteData.pais ?? "",
      direccion: clienteData.direccion ?? "",
      fecha_nacimiento: clienteData.fecha_nacimiento ? clienteData.fecha_nacimiento.split("T")[0] : "",
    });
  }, [clienteData]);

  const iniciarEdicionPersonal = () => setEditandoPersonal(true);
  const cancelarEdicionPersonal = () => {
    setEditandoPersonal(false);
    if (clienteData) {
      setFormPersonal({
        nombre: clienteData.nombre ?? "",
        apellido: clienteData.apellido ?? "",
        correo: clienteData.correo ?? "",
        celular: clienteData.celular ?? "",
        ciudad: clienteData.ciudad ?? "",
        pais: clienteData.pais ?? "",
        direccion: clienteData.direccion ?? "",
        fecha_nacimiento: clienteData.fecha_nacimiento ? clienteData.fecha_nacimiento.split("T")[0] : "",
      });
    }
  };

  const [erroresCuenta, setErroresCuenta] = useState<Partial<Record<CampoTexto, string>>>({});

  const handleGuardarPersonal = async () => {
    if (!clienteData) return;
    if (guardandoPersonal) return; // evita el doble envío
    const textos = Object.fromEntries(
      (Object.keys(REGLAS_CUENTA) as CampoTexto[]).map((k) => [k, formPersonal[k] ?? ""]),
    ) as Record<CampoTexto, string>;
    const { errores, limpios, valido } = validarFormulario(textos, REGLAS_CUENTA);
    setErroresCuenta(errores);
    if (!valido) {
      document.getElementById(`cuenta-${Object.keys(errores)[0]}`)?.focus();
      return;
    }
    setGuardandoPersonal(true);
    try {
      // fecha_nacimiento y correo vacíos no son valores válidos para el
      // backend (date/EmailStr) — se omiten en vez de mandar "" cuando el
      // usuario los deja en blanco.
      const { fecha_nacimiento } = formPersonal;
      const { correo, ...resto } = limpios;
      const payload: Record<string, string> = { ...resto };
      if (payload.celular) payload.celular = limpiarTelefono(payload.celular);
      if (fecha_nacimiento) payload.fecha_nacimiento = fecha_nacimiento;
      if (correo) payload.correo = correo;
      const actualizado = await clienteService.update(clienteData.id_cliente, payload);
      onClienteActualizado?.(actualizado);
      setEditandoPersonal(false);
      toast.success("Datos personales actualizados");
    } catch (err: any) {
      toast.error(/demasiadas solicitudes/i.test(err?.message ?? "") ? mensajeErrorEnvio(err, "") : err?.message || "No pudimos actualizar tus datos.");
    } finally {
      setGuardandoPersonal(false);
    }
  };

  const fotoUrl = resolveFotoUrl(usuario?.foto_perfil);
  // undefined (sesiones viejas que aún no pasaron por el refresco de
  // Profile.tsx) se trata como verificada -- solo false (confirmado por
  // el backend) bloquea la foto, nunca la ausencia del dato.
  const cuentaVerificada = usuario?.verificado !== false;

  const handleSeleccionArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      toast.error("Formato no soportado. Usa una imagen JPG, PNG o WEBP.");
      return;
    }
    if (file.size > TAMANO_MAXIMO) {
      toast.error("La imagen no puede superar los 5MB.");
      return;
    }

    setSubiendoFoto(true);
    try {
      const actualizado = await usuarioService.uploadFoto(file);
      updateUsuario({ foto_perfil: actualizado.foto_perfil });
      toast.success("Foto de perfil actualizada");
    } catch (err: any) {
      toast.error(err?.message || "No pudimos subir la imagen. Intenta de nuevo.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleEliminarFoto = async () => {
    if (!usuario?.foto_perfil) return;
    setSubiendoFoto(true);
    try {
      await usuarioService.deleteFoto();
      updateUsuario({ foto_perfil: null });
      toast.success("Foto de perfil eliminada");
    } catch (err: any) {
      toast.error(err?.message || "No pudimos eliminar la imagen.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handleActualizarPassword = async () => {
    if (!clienteData) return;
    if (!contrasenaActual || !nuevaContrasena || !confirmarContrasena) {
      toast.error("Completa los tres campos de contraseña.");
      return;
    }
    if (nuevaContrasena.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (nuevaContrasena !== confirmarContrasena) {
      toast.error("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    setGuardandoPassword(true);
    try {
      await clienteService.cambiarContrasena(clienteData.id_cliente, {
        contrasena_actual: contrasenaActual,
        nueva_contrasena: nuevaContrasena,
      });
      toast.success("Contraseña actualizada correctamente");
      setContrasenaActual("");
      setNuevaContrasena("");
      setConfirmarContrasena("");
    } catch (err: any) {
      toast.error(err?.message || "No pudimos actualizar tu contraseña.");
    } finally {
      setGuardandoPassword(false);
    }
  };

  const datosPersonales = [
    { label: "Nombre Completo", value: clienteData ? `${clienteData.nombre} ${clienteData.apellido}` : "—" },
    { label: "Correo Electrónico", value: clienteData?.correo || usuario?.username || "—" },
    { label: "Teléfono Celular", value: clienteData?.celular || "—" },
    { label: "Ciudad", value: clienteData?.ciudad || "—" },
    { label: "País", value: clienteData?.pais || "—" },
    { label: "Dirección de Residencia", value: clienteData?.direccion || "—" },
    { label: "Fecha de Nacimiento", value: formatearFecha(clienteData?.fecha_nacimiento) },
  ];

  const inputPersonalCls = "w-full bg-transparent text-base font-bold text-foreground focus:outline-none placeholder:text-muted-foreground/50 placeholder:font-normal";

  return (
    <div className="w-full">
      {/* ── Encabezado ── */}
      <EncabezadoTab titulo="Mi cuenta" descripcion="Tu información personal, tu foto y la seguridad de tu cuenta." />

      <div className="space-y-8">

        {/* ── SECCIÓN 1: Foto de Perfil ── */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col sm:flex-row items-center gap-6">

          {/* Avatar con botón superpuesto */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 bg-primary/10 rounded-full border-4 border-background flex items-center justify-center shadow-md overflow-hidden">
              {subiendoFoto ? (
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              ) : fotoUrl && cuentaVerificada ? (
                <img src={fotoUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-primary" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={subiendoFoto || !cuentaVerificada}
              className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full border-2 border-card shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              title={cuentaVerificada ? "Cambiar foto de perfil" : "Verifica tu cuenta para poder cambiar tu foto"}
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={handleSeleccionArchivo}
            />
          </div>

          {/* Textos y botón de acción */}
          <div className="text-center sm:text-left">
            <h2 className="text-lg font-bold text-foreground">Foto de perfil</h2>
            {cuentaVerificada ? (
              <p className="text-sm text-muted-foreground mb-4 mt-1 max-w-md">
                Sube una nueva foto para personalizar tu cuenta. Recomendamos usar una imagen cuadrada de al menos 256x256px en formato JPG o PNG.
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-sm text-amber-700 dark:text-amber-400 mb-4 mt-1 max-w-md font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                Verifica tu cuenta para poder personalizar tu foto de perfil. Revisa tu correo o contacta a soporte si el mensaje nunca llegó.
              </p>
            )}
            <div className="flex items-center justify-center sm:justify-start gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={subiendoFoto || !cuentaVerificada}
                className="text-sm font-semibold bg-background border border-border hover:border-primary/50 hover:text-primary px-5 py-2.5 rounded-full transition-all duration-200 active:scale-95 shadow-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                Subir nueva imagen
              </button>
              <button
                onClick={handleEliminarFoto}
                disabled={subiendoFoto || !usuario?.foto_perfil}
                className="text-sm font-semibold text-destructive hover:text-destructive/80 px-4 py-2.5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>

        {/* ── SECCIÓN 2: Información Personal (Estilo Bento Box) ── */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Información Personal</h2>
            {!editandoPersonal ? (
              <button
                onClick={iniciarEdicionPersonal}
                disabled={!clienteData}
                className="text-sm font-semibold text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={cancelarEdicionPersonal}
                  disabled={guardandoPersonal}
                  className="text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-1.5 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
                <button
                  onClick={handleGuardarPersonal}
                  disabled={guardandoPersonal}
                  className="text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 px-4 py-1.5 rounded-full transition-colors disabled:opacity-50"
                >
                  {guardandoPersonal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Guardar
                </button>
              </div>
            )}
          </div>

          {!editandoPersonal ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {datosPersonales.map((item) => (
                <div
                  key={item.label}
                  className="bg-background border border-border/50 rounded-2xl p-4 hover:border-primary/30 transition-colors"
                >
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
                    {item.label}
                  </label>
                  <p className="text-base font-bold text-foreground truncate">{item.value}</p>
                </div>
              ))}
              <div className="bg-background border border-border/50 rounded-2xl p-4 opacity-70">
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Documento de Identidad / Cédula
                </label>
                <p className="text-base font-bold text-foreground truncate">{clienteData?.cedula || "—"}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CAMPOS_EDITABLES.map((campo) => (
                <div
                  key={campo.name}
                  className="bg-background border border-primary/30 rounded-2xl p-4"
                >
                  <label htmlFor={`cuenta-${campo.name}`} className="text-xs font-medium text-muted-foreground block mb-1">
                    {campo.label}{"required" in campo && campo.required && <span className="text-destructive" aria-hidden> *</span>}
                  </label>
                  <input
                    id={`cuenta-${campo.name}`}
                    type={campo.type ?? "text"}
                    value={formPersonal[campo.name] ?? ""}
                    onChange={(e) => {
                      setFormPersonal((f) => ({ ...f, [campo.name]: e.target.value }));
                      setErroresCuenta((x) => ({ ...x, [campo.name]: undefined }));
                    }}
                    required={"required" in campo ? campo.required : undefined}
                    maxLength={"max" in campo ? campo.max : undefined}
                    aria-invalid={!!erroresCuenta[campo.name as CampoTexto]}
                    aria-describedby={`cuenta-${campo.name}-error`}
                    className={inputPersonalCls}
                  />
                  <ErrorCampo id={`cuenta-${campo.name}-error`} mensaje={erroresCuenta[campo.name as CampoTexto]} />
                </div>
              ))}
              <div className="bg-muted/40 border border-border/50 rounded-2xl p-4 opacity-70">
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Documento de Identidad / Cédula
                </label>
                <p className="text-base font-bold text-foreground truncate">{clienteData?.cedula || "—"}</p>
                <p className="text-[10px] text-muted-foreground mt-1">No editable</p>
              </div>
            </div>
          )}
        </div>

        {/* ── SECCIÓN 3: Seguridad de la cuenta ── */}
        <div className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 shadow-sm">

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Seguridad de la cuenta</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-6 ml-13">
            Actualiza tu contraseña de acceso para mantener la cuenta protegida
          </p>

          <div className="space-y-5 max-w-md ml-13">
            {/* Input: Contraseña actual */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Contraseña actual</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={contrasenaActual}
                  onChange={(e) => setContrasenaActual(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Input: Nueva contraseña */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Nueva contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={nuevaContrasena}
                  onChange={(e) => setNuevaContrasena(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Input: Confirmar nueva contraseña */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Confirmar nueva contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmarContrasena}
                  onChange={(e) => setConfirmarContrasena(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Botón */}
            <div className="pt-2">
              <button
                onClick={handleActualizarPassword}
                disabled={guardandoPassword || !clienteData}
                className="flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold px-6 py-3 rounded-full hover:bg-primary/90 hover:scale-[0.98] transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:pointer-events-none"
              >
                {guardandoPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {guardandoPassword ? "Actualizando..." : "Actualizar contraseña"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
