import { useState } from "react";
import {
  Camera, Loader2, KeyRound, Eye, EyeOff, ShieldCheck, Trash2, Save, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { usuarioService } from "../../services/usuario.service";
import SectionHeader from "./ui/SectionHeader";
import { resolveFotoUrl, inputCls, labelCls, cardCls } from "./types";

const TIPOS_PERMITIDOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5MB

const ROL_LABELS: Record<string, string> = {
  admin: "Administrador",
  empleado: "Empleado",
  cliente: "Cliente",
};

interface UsuarioSesion {
  username: string;
  foto_perfil?: string | null;
  roles?: string[];
}

interface Props {
  usuario: UsuarioSesion | null;
  onFotoActualizada: (foto_perfil: string | null) => void;
}

// Módulo "Mi cuenta": conecta con endpoints que YA existían en el backend
// (POST/DELETE /usuarios/me/foto, ver usuario_route.py) pero que hasta ahora
// solo usaba el sitio público (TabCuenta.tsx) — el panel de admin no tenía
// ninguna pantalla para que el propio administrador cambiara su foto. El
// cambio de contraseña sí es nuevo (PUT /usuarios/me/password): antes solo
// existía /clientes/{id}/cambiar-contrasena (exige un id_cliente, así que
// no sirve para una cuenta de admin sin cliente vinculado) y el flujo de
// "olvidé mi contraseña" por token de correo.
export default function ModuleMiCuenta({ usuario, onFotoActualizada }: Props) {
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoError, setFotoError] = useState(false);

  const [contrasenaActual, setContrasenaActual] = useState("");
  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [verActual, setVerActual] = useState(false);
  const [verNueva, setVerNueva] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);

  const fotoUrl = resolveFotoUrl(usuario?.foto_perfil);
  const initials = usuario?.username?.[0]?.toUpperCase() ?? "A";

  async function handleSeleccionArchivo(e: React.ChangeEvent<HTMLInputElement>) {
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
    setFotoError(false);
    try {
      const actualizado = await usuarioService.uploadFoto(file);
      onFotoActualizada(actualizado.foto_perfil);
      toast.success("Foto de perfil actualizada");
    } catch (err: any) {
      toast.error(err?.message || "No pudimos subir la imagen. Intenta de nuevo.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function handleEliminarFoto() {
    if (!usuario?.foto_perfil) return;
    setSubiendoFoto(true);
    try {
      await usuarioService.deleteFoto();
      onFotoActualizada(null);
      toast.success("Foto de perfil eliminada");
    } catch (err: any) {
      toast.error(err?.message || "No pudimos eliminar la imagen.");
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function handleCambiarPassword() {
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
      await usuarioService.cambiarPassword({
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
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <SectionHeader title="Mi cuenta" subtitle="Tu foto de perfil, tus roles y tu contraseña de acceso" />

      <div className={`${cardCls} flex flex-col sm:flex-row items-center gap-6`}>
        <div className="relative group flex-shrink-0">
          <div className="w-20 h-20 rounded-full border-4 border-background shadow-md overflow-hidden flex items-center justify-center bg-primary/10 text-primary font-semibold text-2xl">
            {subiendoFoto ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : fotoUrl && !fotoError ? (
              <img
                src={fotoUrl}
                alt={usuario?.username ?? "Foto de perfil"}
                onError={() => setFotoError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <label
            className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full border-2 border-card shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="Cambiar foto de perfil"
          >
            <Camera className="w-3.5 h-3.5" />
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              disabled={subiendoFoto}
              onChange={handleSeleccionArchivo}
            />
          </label>
        </div>

        <div className="text-center sm:text-left flex-1 min-w-0">
          <p className="text-base font-semibold text-foreground truncate">{usuario?.username ?? "—"}</p>
          <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap mt-1.5 mb-3">
            {(usuario?.roles ?? []).map(r => (
              <span key={r} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> {ROL_LABELS[r] ?? r}
              </span>
            ))}
          </div>
          <div className="flex items-center justify-center sm:justify-start gap-3">
            <label className="text-sm font-medium bg-background border border-border hover:border-primary/40 hover:text-primary px-3.5 py-2 rounded-xl transition-all cursor-pointer">
              Subir nueva imagen
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                disabled={subiendoFoto}
                onChange={handleSeleccionArchivo}
              />
            </label>
            <button
              onClick={handleEliminarFoto}
              disabled={subiendoFoto || !usuario?.foto_perfil}
              className="flex items-center gap-1 text-sm font-medium text-destructive hover:text-destructive/80 px-2 py-2 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          </div>
        </div>
      </div>

      <div className={cardCls}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <KeyRound className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Cambiar contraseña</h3>
            <p className="text-xs text-muted-foreground">Necesitas tu contraseña actual para confirmar el cambio.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelCls}>Contraseña actual</label>
            <div className="relative">
              <input maxLength={72}
                type={verActual ? "text" : "password"}
                value={contrasenaActual}
                onChange={e => setContrasenaActual(e.target.value)}
                className={`${inputCls} pr-10`}
                placeholder="••••••••"
              />
              <button aria-label={verActual ? "Ocultar contraseña" : "Ver contraseña"}
                type="button"
                onClick={() => setVerActual(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-pressed={verActual}
              >
                {verActual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nueva contraseña</label>
              <div className="relative">
                <input maxLength={72}
                  type={verNueva ? "text" : "password"}
                  value={nuevaContrasena}
                  onChange={e => setNuevaContrasena(e.target.value)}
                  className={`${inputCls} pr-10`}
                  placeholder="Mínimo 8 caracteres"
                />
                <button aria-label={verNueva ? "Ocultar contraseña" : "Ver contraseña"}
                  type="button"
                  onClick={() => setVerNueva(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-pressed={verNueva}
                >
                  {verNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Confirmar nueva contraseña</label>
              <input maxLength={72}
                type={verNueva ? "text" : "password"}
                value={confirmarContrasena}
                onChange={e => setConfirmarContrasena(e.target.value)}
                className={inputCls}
                placeholder="Repite la nueva contraseña"
              />
            </div>
          </div>

          {nuevaContrasena && confirmarContrasena && nuevaContrasena === confirmarContrasena && (
            <p className="text-xs text-success flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Las contraseñas coinciden
            </p>
          )}

          <button
            onClick={handleCambiarPassword}
            disabled={guardandoPassword}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all
              bg-gradient-to-r from-primary to-[#A13B55] hover:shadow-lg hover:shadow-primary/20 disabled:opacity-50"
          >
            {guardandoPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {guardandoPassword ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
        </div>
      </div>
    </div>
  );
}
