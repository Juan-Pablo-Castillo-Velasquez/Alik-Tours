import { Lock, Mail, Plane, RefreshCw, Shield, User, X } from "lucide-react";
import { tomarVuelta } from "../utils/volverTrasLogin";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { borradorLogin } from "../utils/borradorAuth";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import ModalBackdrop from "./ui/ModalBackdrop";
import OtpCodeInput from "./ui/OtpCodeInput";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth.service";
import { useT } from "../i18n";
import PanelMarcaAuth from "./auth/PanelMarcaAuth";
import { BotonPrincipal, CampoTexto, ErrorFormulario } from "./forms/Campos";

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchToRegister?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;
// Mensaje exacto que devuelve login_user() en auth_service.py cuando la
// cuenta existe y la contraseña es correcta, pero verificado=False --
// antes esto solo se mostraba como un error de texto plano sin ninguna
// salida real: la persona quedaba estancada sin saber cómo confirmar su
// correo desde aquí. Ahora, al detectar este mensaje puntual, se abre el
// mismo panel de código de 6 dígitos que ya existe en RegisterModal.tsx
// (mismo componente OtpCodeInput), para no obligar a cerrar este modal,
// abrir el de registro, y buscar otra vez cómo reenviar el código.
const MENSAJE_NO_VERIFICADO = "Por favor verifica tu email antes de continuar";

export default function LoginModal({ isOpen, onClose, onSwitchToRegister }: LoginModalProps) {
    const t = useT();
    const navigate = useNavigate();
    const { login } = useAuth();
    const [loading, setLoading] = useState(false);
    // Lo escrito sobrevive a cerrar el modal (ver utils/borradorAuth.ts).
    const [formData, setFormData] = useState(() => borradorLogin.leer({ username: "", password: "" }));
    const [formError, setFormError] = useState("");
    const [emailTouched, setEmailTouched] = useState(false);

    // Estado para mostrar bienvenida con rol
    const [welcomeInfo, setWelcomeInfo] = useState<{ username: string; isAdmin: boolean } | null>(null);

    // Forgot password
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotMsg, setForgotMsg] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);

    // Cuenta sin verificar -- panel de código inline (ver MENSAJE_NO_VERIFICADO)
    const [needsVerification, setNeedsVerification] = useState(false);
    const [codeDigits, setCodeDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState("");
    const [resending, setResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);

    const emailValid = EMAIL_REGEX.test(formData.username.trim());
    const isFormValid = useMemo(
        () => emailValid && formData.password.length > 0,
        [formData, emailValid]
    );

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (formError) setFormError("");
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Al abrir, retoma lo que la persona dejó escrito (también si lo escribió
    // en la otra instancia del modal, la del menú o la del contexto).
    useEffect(() => {
        if (isOpen) setFormData(borradorLogin.leer({ username: "", password: "" }));
    }, [isOpen]);

    useEffect(() => {
        borradorLogin.guardar(formData);
    }, [formData]);

    // Cerrar SIN borrar lo escrito (clic afuera, la X, pasar a registro).
    const cerrarConservando = () => {
        setFormError("");
        setShowForgot(false);
        setForgotMsg("");
        setWelcomeInfo(null);
        setVerifyError("");
        onClose();
    };

    // Solo tras un ingreso exitoso: se descarta el borrador.
    const resetAndClose = () => {
        borradorLogin.borrar();
        setFormData({ username: "", password: "" });
        setFormError("");
        setShowForgot(false);
        setForgotMsg("");
        setForgotEmail("");
        setWelcomeInfo(null);
        setNeedsVerification(false);
        setCodeDigits(Array(CODE_LENGTH).fill(""));
        setVerifyError("");
        setResendCooldown(0);
        onClose();
    };

    const aplicarSesion = (res: {
        access_token: string; username?: string; user_id?: number; id_cliente?: number;
        roles?: string[]; foto_perfil?: string | null; verificado?: boolean; activo?: boolean;
    }) => {
        login(res.access_token, {
            username: res.username ?? formData.username,
            user_id: res.user_id,
            id_cliente: res.id_cliente,
            roles: res.roles ?? [],
            foto_perfil: res.foto_perfil,
            verificado: res.verificado,
            activo: res.activo,
        });

        const roles = res.roles ?? [];
        const isAdmin = roles.includes("admin");
        // Antes solo isAdmin mandaba a /admin -- una cuenta con el rol
        // empleado (panel recortado, ver ProtectedRoute.tsx) hacia login
        // normal y terminaba en /profile como cualquier cliente, sin forma
        // visible de llegar a su propio panel.
        const isEmpleado = roles.includes("empleado");
        const displayName = res.username ?? formData.username;

        setWelcomeInfo({ username: displayName, isAdmin });
        toast.success(t("login.hola", { nombre: displayName }));

        setTimeout(() => {
            resetAndClose();
            const volver = tomarVuelta();
            navigate(isAdmin || isEmpleado ? "/admin" : (volver ?? "/profile"));
        }, 1800);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;
        setFormError("");
        setNeedsVerification(false);
        setLoading(true);
        try {
            const res = await authService.login(formData);
            aplicarSesion(res);
        } catch (err: any) {
            const message = err?.message || "Usuario o contraseña incorrectos";
            if (message === MENSAJE_NO_VERIFICADO) {
                setNeedsVerification(true);
                setResendCooldown(30);
            } else {
                setFormError(message);
                toast.error(message);
            }
        } finally {
            setLoading(false);
        }
    };

    const codigoCompleto = codeDigits.join("");

    const handleVerifyCode = async () => {
        if (codigoCompleto.length !== CODE_LENGTH || verifying) return;
        setVerifying(true);
        setVerifyError("");
        try {
            const tokens = await authService.verifyEmailCode(formData.username, codigoCompleto);
            aplicarSesion(tokens);
        } catch (err: any) {
            setVerifyError(err?.message || "Código incorrecto");
            setCodeDigits(Array(CODE_LENGTH).fill(""));
        } finally {
            setVerifying(false);
        }
    };

    useEffect(() => {
        if (needsVerification && codigoCompleto.length === CODE_LENGTH && !verifying) {
            handleVerifyCode();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoCompleto, needsVerification]);

    const handleResendCode = async () => {
        if (resendCooldown > 0 || resending) return;
        setResending(true);
        try {
            const r = await authService.resendVerification(formData.username);
            toast.success(r.message || "Código reenviado, revisa tu bandeja de entrada.");
            setCodeDigits(Array(CODE_LENGTH).fill(""));
            setVerifyError("");
            setResendCooldown(30);
        } catch (err: any) {
            toast.error(err.message || "No se pudo reenviar el código");
        } finally {
            setResending(false);
        }
    };

    async function handleForgot() {
        if (!forgotEmail) return;
        setForgotLoading(true);
        try {
            const res = await authService.forgotPassword(forgotEmail);
            setForgotMsg(res.message);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setForgotLoading(false);
        }
    }

    function closeForgotSub() {
        setShowForgot(false);
        setForgotMsg("");
        setForgotEmail("");
    }

    const verificandoTitulo = needsVerification ? t("login.tituloVerificar") : t("login.titulo");
    const verificandoSub = needsVerification ? t("login.subtituloVerificar") : t("login.subtitulo");

    return (
        <AnimatePresence>
            {isOpen && (
                <ModalBackdrop zIndex={100} onClick={cerrarConservando}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        transition={{ type: "spring", damping: 26, stiffness: 320 }}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="login-titulo"
                        aria-describedby="login-sub"
                        className="relative my-auto grid w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-2xl md:max-w-4xl md:grid-cols-[0.95fr_1.05fr]"
                    >
                        <PanelMarcaAuth variante="login" />

                        <div className="relative flex flex-col px-6 pb-7 pt-6 sm:px-10 sm:pb-10 sm:pt-9">
                            <button
                                type="button"
                                onClick={cerrarConservando}
                                aria-label={t("comun.cerrar")}
                                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <X className="h-5 w-5" aria-hidden />
                            </button>

                            <div className="mb-7 pr-8">
                                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary md:hidden" aria-hidden>
                                    <Plane className="h-5 w-5 -rotate-12" />
                                </span>
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={needsVerification ? "verify" : "login"}
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 6 }}
                                        transition={{ duration: 0.18 }}
                                    >
                                        <h1 id="login-titulo" className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.7rem]">
                                            {verificandoTitulo}
                                        </h1>
                                        <p id="login-sub" className="mt-1.5 text-sm text-muted-foreground">
                                            {verificandoSub}
                                        </p>
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            <AnimatePresence mode="wait">
                                {welcomeInfo ? (
                                    <motion.div
                                        key="welcome"
                                        initial={{ opacity: 0, scale: 0.94 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="flex flex-col items-center gap-3 py-6 text-center"
                                        role="status"
                                    >
                                        <div className={`flex h-16 w-16 items-center justify-center rounded-full shadow-md ${welcomeInfo.isAdmin ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary"}`}>
                                            {welcomeInfo.isAdmin ? <Shield className="h-8 w-8" aria-hidden /> : <User className="h-8 w-8" aria-hidden />}
                                        </div>
                                        <p className="text-lg font-bold text-foreground">{t("login.hola", { nombre: welcomeInfo.username })}</p>
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${welcomeInfo.isAdmin ? "bg-gold/15 text-gold" : "bg-primary/10 text-primary"}`}>
                                            {welcomeInfo.isAdmin ? t("login.admin") : t("login.cliente")}
                                        </span>
                                        <p className="text-sm text-muted-foreground">{t("login.redirigiendo")}</p>
                                    </motion.div>
                                ) : needsVerification ? (
                                    <motion.div key="verify-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
                                        <p className="mb-5 text-sm text-muted-foreground">
                                            {t("login.codigoEnviado")} <span className="font-bold text-foreground">{formData.username}</span>
                                        </p>
                                        <OtpCodeInput value={codeDigits} onChange={setCodeDigits} disabled={verifying} autoFocus error={!!verifyError} />
                                        {verifyError && <div className="mt-4"><ErrorFormulario>{verifyError}</ErrorFormulario></div>}
                                        <BotonPrincipal
                                            type="button"
                                            onClick={handleVerifyCode}
                                            disabled={verifying || codigoCompleto.length !== CODE_LENGTH}
                                            cargando={verifying}
                                            textoCargando={t("login.verificando")}
                                            className="mt-6"
                                        >
                                            {t("login.verificar")}
                                        </BotonPrincipal>
                                        <button
                                            type="button"
                                            onClick={handleResendCode}
                                            disabled={resending || resendCooldown > 0}
                                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-medium text-primary transition-colors hover:bg-muted disabled:opacity-50"
                                        >
                                            <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} aria-hidden />
                                            {resending ? t("login.reenviando") : resendCooldown > 0 ? t("login.reenviarEn", { n: resendCooldown }) : t("login.reenviar")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setNeedsVerification(false); setFormError(""); }}
                                            className="mt-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                                        >
                                            {t("comun.volver")}
                                        </button>
                                    </motion.div>
                                ) : (
                                    <motion.form key="form" onSubmit={handleSubmit} initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5" noValidate>
                                        <ErrorFormulario>{formError}</ErrorFormulario>
                                        <CampoTexto
                                            id="login-correo"
                                            label={t("login.correo")}
                                            icono={Mail}
                                            type="email"
                                            name="username"
                                            maxLength={120}
                                            value={formData.username}
                                            onChange={handleChange}
                                            onBlur={() => setEmailTouched(true)}
                                            placeholder="tu@correo.com"
                                            autoComplete="email"
                                            inputMode="email"
                                            required
                                            error={emailTouched && formData.username && !emailValid ? t("login.correoInvalido") : null}
                                            ayuda={t("login.correoAyuda")}
                                        />
                                        <CampoTexto
                                            id="login-password"
                                            label={t("login.password")}
                                            icono={Lock}
                                            type="password"
                                            name="password"
                                            maxLength={72}
                                            value={formData.password}
                                            onChange={handleChange}
                                            placeholder="••••••••"
                                            autoComplete="current-password"
                                            required
                                            extraEtiqueta={
                                                <button type="button" onClick={() => setShowForgot(true)} className="text-xs font-semibold text-primary hover:underline">
                                                    {t("login.olvido")}
                                                </button>
                                            }
                                        />
                                        <BotonPrincipal type="submit" disabled={!isFormValid || loading} cargando={loading} textoCargando={t("login.entrando")}>
                                            {t("login.entrar")}
                                        </BotonPrincipal>
                                    </motion.form>
                                )}
                            </AnimatePresence>

                            {!welcomeInfo && !needsVerification && (
                                <>
                                    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
                                        <span className="h-px flex-1 bg-border" />
                                        {t("login.o")}
                                        <span className="h-px flex-1 bg-border" />
                                    </div>
                                    <p className="text-center text-sm text-muted-foreground">
                                        {t("login.sinCuenta")}{" "}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                cerrarConservando();
                                                onSwitchToRegister?.();
                                            }}
                                            className="font-semibold text-primary hover:underline"
                                        >
                                            {t("login.registrate")}
                                        </button>
                                    </p>
                                </>
                            )}
                        </div>

                        {/* Recuperar contraseña: tarjeta centrada sobre el modal. */}
                        <AnimatePresence>
                            {showForgot && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-10 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"
                                    onClick={closeForgotSub}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.94, y: 12 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.94, y: 12 }}
                                        onClick={(e) => e.stopPropagation()}
                                        role="dialog"
                                        aria-modal="true"
                                        aria-labelledby="olvido-titulo"
                                        className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-2xl"
                                    >
                                        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
                                            <Mail className="h-5 w-5" />
                                        </span>
                                        <h2 id="olvido-titulo" className="text-xl font-bold text-foreground">{t("login.recuperar")}</h2>
                                        <p className="mb-5 mt-1 text-sm text-muted-foreground">{t("login.recuperarTexto")}</p>
                                        {forgotMsg ? (
                                            <div className="text-center" role="status">
                                                <p className="font-semibold text-foreground">{t("login.enviado")}</p>
                                                <p className="mt-1 text-sm text-muted-foreground">{forgotMsg}</p>
                                                <BotonPrincipal type="button" onClick={closeForgotSub} className="mt-6">
                                                    {t("comun.entendido")}
                                                </BotonPrincipal>
                                            </div>
                                        ) : (
                                            <form
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    handleForgot();
                                                }}
                                                className="space-y-4"
                                            >
                                                <CampoTexto
                                                    label={t("login.correo")}
                                                    icono={Mail}
                                                    type="email"
                                                    maxLength={120}
                                                    placeholder="tu@correo.com"
                                                    value={forgotEmail}
                                                    onChange={(e) => setForgotEmail(e.target.value)}
                                                    autoComplete="email"
                                                    autoFocus
                                                />
                                                <BotonPrincipal type="submit" disabled={forgotLoading || !forgotEmail} cargando={forgotLoading} textoCargando={t("comun.enviando")}>
                                                    {t("login.enviarEnlace")}
                                                </BotonPrincipal>
                                                <button type="button" onClick={closeForgotSub} className="w-full py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                                                    {t("comun.cancelar")}
                                                </button>
                                            </form>
                                        )}
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </ModalBackdrop>
            )}
        </AnimatePresence>
    );
}
