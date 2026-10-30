import { TERMINOS_VERSION } from "../content/terminos";
import { esCelularValido, MENSAJE_CELULAR, normalizarCelular } from "../utils/validaciones";
import {
    AlertCircle, ArrowLeft, ArrowRight, Building2, Calendar, Check, CreditCard,
    Eye, EyeOff, Lock, Mail, MapPin, Phone, Pencil, Plane, RefreshCw, ShieldCheck, User, X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { apiFetch } from "../api/v1/api";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/auth.service";
import PrivacidadModal from "./PrivacidadModal";
import TerminosModal from "./TerminosModal";
import OtpCodeInput from "./ui/OtpCodeInput";
import ModalBackdrop from "./ui/ModalBackdrop";
import { DURACION, EASE_SUAVE } from "../utils/motion";

interface RegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSwitchToLogin?: () => void;
}

const CODE_LENGTH = 6;

// Antes este formulario era una sola pantalla larga con TODOS los campos a
// la vez (scroll interminable) y un indicador de pasos que en realidad
// nunca avanzaba -- siempre marcaba "Acceso" como activo sin importar qué
// tan abajo hubieras hecho scroll (era puramente decorativo). Ahora es un
// wizard real: cada paso muestra solo sus campos, "Continuar" valida antes
// de avanzar, y el indicador de arriba refleja el paso real en el que
// estás. El paso 4 (Código) es nuevo: antes crear la cuenta te mandaba a
// una pantalla de "revisa tu correo" sin más -- ahora se te pide el código
// de 6 dígitos ahí mismo, sin salir del modal.
type Step = 1 | 2 | 3 | 4;
const STEP_LABELS = ["Acceso", "Perfil", "Listo", "Código"];

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
    1: { title: "Crea tu cuenta", subtitle: "Empecemos por tu correo y una contraseña segura." },
    2: { title: "Cuéntanos de ti", subtitle: "Así preparamos tus reservas y facturas a tu nombre." },
    3: { title: "Ya casi está", subtitle: "Revisa que todo esté bien antes de confirmar." },
    4: { title: "Confirma tu correo", subtitle: "Te enviamos un código de 6 dígitos." },
};

const initialFormData = {
    correo_electronico: "", password: "", confirmPassword: "",
    nombre: "", apellido: "", cedula: "", celular: "",
    direccion: "", barrio: "", departamento: "", codigo_postal: "",
    ciudad: "", pais: "Colombia", fecha_nacimiento: "",
};

const DEPARTAMENTOS_COLOMBIA = [
    "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar",
    "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó",
    "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira",
    "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío",
    "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima",
    "Valle del Cauca", "Vaupés", "Vichada",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Mínimo 6 caracteres, al menos 1 mayúscula, 1 minúscula y 1 número
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
// Formato real de dirección colombiana: tipo de vía + número + '#' +
// número-número (ej. "Calle 45 #12-34", "Cra. 10 # 20-30B", "Av 68#15-40").
// Se valida solo si el usuario escribió algo -- el campo sigue siendo
// opcional en su conjunto, igual que antes.
const DIRECCION_REGEX = /^(calle|cl|carrera|cra|avenida|av|diagonal|dg|transversal|tv)\.?\s*\d+\w{0,3}\s*#\s*\d+\w{0,3}\s*-\s*\d+\w{0,3}/i;

function calcAge(dateStr: string) {
    if (!dateStr) return 0;
    const birth = new Date(dateStr);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

interface FieldProps {
    label: string;
    icon: React.ReactNode;
    error?: string;
    suffix?: React.ReactNode;
    optional?: boolean;
    children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
}

// Antes los campos no tenían ninguna etiqueta visible -- solo un ícono +
// placeholder ("Departamento (opcional)", "Barrio / Localidad (opcional)")
// que se cortaba a mitad de palabra en columnas angostas de 2, porque todo
// el texto vivía dentro del placeholder. Ahora cada campo tiene una
// etiqueta corta arriba (igual que ya hacía LoginModal) y el "(opcional)"
// vive en la etiqueta, no en un placeholder larguísimo -- el placeholder
// queda libre para un ejemplo útil en vez de repetir la etiqueta.
function Field({ label, icon, error, suffix, optional, children }: FieldProps) {
    return (
        <div className="space-y-1.5 w-full">
            <label className="flex items-center gap-1 text-xs font-semibold text-foreground/80 pl-0.5">
                {label}
                {optional && <span className="text-muted-foreground font-normal">(opcional)</span>}
            </label>
            <div className="relative group">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors duration-200">
                    {icon}
                </span>
                {children}
                {suffix && (
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">{suffix}</span>
                )}
            </div>
            <AnimatePresence>
                {error && (
                    <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[11px] text-destructive font-medium flex items-center gap-1 pl-1"
                    >
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        {error}
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
}

// Indicador visual de fuerza de contraseña
function PasswordStrength({ password }: { password: string }) {
    if (!password) return null;
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasLength = password.length >= 6;

    const checks = [
        { label: "Minúscula", ok: hasLower },
        { label: "Mayúscula", ok: hasUpper },
        { label: "Número", ok: hasNumber },
        { label: "6+ chars", ok: hasLength },
    ];

    const passed = checks.filter(c => c.ok).length;
    const barColor =
        passed <= 1 ? "bg-destructive" :
            passed <= 2 ? "bg-[#C9A227]" :
                passed <= 3 ? "bg-[#A13B55]" :
                    "bg-[#7B1E3A]";

    return (
        <div className="space-y-1.5 px-1">
            <div className="flex gap-1 h-1">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className={`flex-1 rounded-full transition-all duration-300 ${i <= passed ? barColor : "bg-border"}`} />
                ))}
            </div>
            <div className="flex gap-2 flex-wrap">
                {checks.map(({ label, ok }) => (
                    <span key={label} className={`text-[10px] font-medium flex items-center gap-0.5 transition-colors ${ok ? "text-[#7B1E3A]" : "text-muted-foreground"}`}>
                        <span>{ok ? "✓" : "○"}</span> {label}
                    </span>
                ))}
            </div>
        </div>
    );
}

// Stepper real: usa .step-dot/.step-line, definidos en theme.css desde
// hace tiempo para justamente esto ("Aplica .step-done a los pasos
// completados, .step-active al actual") pero que ningún componente
// llegaba a usar todavía.
function Stepper({ step }: { step: Step }) {
    return (
        <div className="flex items-start px-8 pt-5 pb-4 bg-card border-b border-border flex-shrink-0">
            {STEP_LABELS.map((label, i) => {
                const idx = (i + 1) as Step;
                const isDone = step > idx;
                const isActive = step === idx;
                return (
                    <div key={label} className={`flex items-center ${idx < STEP_LABELS.length ? "flex-1" : ""}`}>
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                            <div className={`step-dot text-xs ${isActive ? "step-active" : ""} ${isDone ? "step-done" : ""}`}>
                                {isDone ? <Check className="w-4 h-4" /> : idx}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${isActive ? "text-primary" : isDone ? "text-[color:var(--gold)]" : "text-muted-foreground"}`}>
                                {label}
                            </span>
                        </div>
                        {idx < STEP_LABELS.length && (
                            <div className={`step-line flex-1 mx-2 mb-4 ${isDone ? "step-line-done" : ""}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default function RegisterModal({ isOpen, onClose, onSwitchToLogin }: RegisterModalProps) {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [step, setStep] = useState<Step>(1);
    const [direction, setDirection] = useState(1);
    const [loading, setLoading] = useState(false);
    const [accountEmail, setAccountEmail] = useState("");

    // Verificación por código -- reemplaza a la vieja pantalla estática de
    // "revisa tu correo". `resending`/`resendCooldown` evitan spamear el
    // botón (y el buzón del usuario) con reenvíos seguidos.
    const [codeDigits, setCodeDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
    const [verifying, setVerifying] = useState(false);
    const [verifyError, setVerifyError] = useState("");
    const [resending, setResending] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const autoSubmitted = useRef(false);

    const [formData, setFormData] = useState(initialFormData);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [formError, setFormError] = useState("");
    const [showTerminos, setShowTerminos] = useState(false);
    const [showPrivacidad, setShowPrivacidad] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (formError) setFormError("");
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
        setTouched((t) => ({ ...t, [e.target.name]: true }));
    };

    const errors = useMemo(() => {
        const e: Record<string, string> = {};
        if (formData.correo_electronico && !EMAIL_REGEX.test(formData.correo_electronico))
            e.correo_electronico = "Correo inválido";
        if (formData.password && !PASSWORD_REGEX.test(formData.password))
            e.password = "Debe tener mayúscula, minúscula y número";
        if (formData.confirmPassword && formData.confirmPassword !== formData.password)
            e.confirmPassword = "Las contraseñas no coinciden";
        if (formData.cedula && !/^\d{6,12}$/.test(formData.cedula))
            e.cedula = "Solo números, 6–12 dígitos";
        if (!formData.celular.trim())
            e.celular = "El celular es obligatorio";
        else if (!esCelularValido(formData.celular))
            e.celular = MENSAJE_CELULAR;
        if (formData.fecha_nacimiento && calcAge(formData.fecha_nacimiento) < 18)
            e.fecha_nacimiento = "Debes ser mayor de 18 años";
        if (formData.direccion && !DIRECCION_REGEX.test(formData.direccion.trim()))
            e.direccion = "Formato: Calle/Carrera/Avenida + número #número-número (ej. Calle 45 #12-34)";
        return e;
    }, [formData]);

    // Cuenta regresiva del botón de reenvío -- se resetea cada vez que se
    // abre el modal (resetState) y baja de a 1 por segundo hasta 0.
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [resendCooldown]);

    const step1Valid =
        EMAIL_REGEX.test(formData.correo_electronico) &&
        PASSWORD_REGEX.test(formData.password) &&
        formData.confirmPassword === formData.password;

    const step2Valid =
        formData.nombre.trim().length > 0 &&
        formData.apellido.trim().length > 0 &&
        /^\d{6,12}$/.test(formData.cedula) &&
        formData.ciudad.trim().length > 0 &&
        formData.fecha_nacimiento.length > 0 &&
        calcAge(formData.fecha_nacimiento) >= 18 &&
        esCelularValido(formData.celular) &&
        (formData.direccion.trim() === "" || DIRECCION_REGEX.test(formData.direccion.trim()));

    const isFormValid = step1Valid && step2Valid && acceptedTerms;
    const fieldError = (name: string) => (touched[name] ? errors[name] : undefined);

    const resetState = () => {
        setStep(1);
        setDirection(1);
        setFormData(initialFormData);
        setAccountEmail("");
        setAcceptedTerms(false);
        setTouched({});
        setFormError("");
        setShowPassword(false);
        setShowConfirmPassword(false);
        setCodeDigits(Array(CODE_LENGTH).fill(""));
        setVerifyError("");
        setVerifying(false);
        setResending(false);
        setResendCooldown(0);
        autoSubmitted.current = false;
    };

    const handleClose = () => { resetState(); onClose(); };

    const goToStep = (next: Step) => {
        setDirection(next > step ? 1 : -1);
        setFormError("");
        setStep(next);
    };

    const handleContinueStep1 = () => {
        setTouched((t) => ({ ...t, correo_electronico: true, password: true, confirmPassword: true }));
        if (!step1Valid) return;
        goToStep(2);
    };

    const handleContinueStep2 = () => {
        setTouched((t) => ({
            ...t, nombre: true, apellido: true, cedula: true, ciudad: true,
            fecha_nacimiento: true, celular: true, direccion: true,
        }));
        if (!step2Valid) return;
        goToStep(3);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (step !== 3 || !isFormValid) return;
        setFormError("");
        setLoading(true);
        try {
            // username = correo_electronico (mismo valor)
            const username = formData.correo_electronico;

            const res = await authService.register({
                username,
                correo_electronico: formData.correo_electronico,
                password: formData.password,
                terminos_version: TERMINOS_VERSION,
            });
            // Auto-login: el registro devuelve un access_token (rol cliente).
            // Se guarda para que crear/vincular el cliente (que exigen sesión)
            // no fallen con 401. Este token "provisional" queda reemplazado
            // por uno completo apenas se confirme el código (ver
            // handleVerifyCode / AuthContext.login).
            if (res.access_token) {
                localStorage.setItem("token", res.access_token);
            }
            const cliente = await apiFetch<{ id_cliente: number }>("/clientes", {
                method: "POST",
                body: {
                    nombre: formData.nombre, apellido: formData.apellido,
                    cedula: formData.cedula, correo: formData.correo_electronico,
                    celular: normalizarCelular(formData.celular), direccion: formData.direccion,
                    barrio: formData.barrio, departamento: formData.departamento,
                    codigo_postal: formData.codigo_postal,
                    ciudad: formData.ciudad, pais: formData.pais,
                    fecha_nacimiento: formData.fecha_nacimiento,
                },
            });
            await apiFetch(`/api/usuarios/${res.user_id}/vincular-cliente`, {
                method: "PUT",
                body: { id_cliente: cliente.id_cliente },
            });
            setAccountEmail(res.email);
            goToStep(4);
            // El primer correo (con el código) ya se dispara solo desde el
            // backend (POST /auth/register) -- este cooldown es solo para
            // el botón de REENVÍO, para que no se pueda golpear de inmediato.
            setResendCooldown(30);
        } catch (err: any) {
            const message = err?.message || "Error al crear la cuenta";
            setFormError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || resending) return;
        setResending(true);
        try {
            const r = await authService.resendVerification(accountEmail);
            toast.success(r.message || "Código reenviado, revisa tu bandeja de entrada.");
            setCodeDigits(Array(CODE_LENGTH).fill(""));
            setVerifyError("");
            autoSubmitted.current = false;
            setResendCooldown(30);
        } catch (err: any) {
            toast.error(err.message || "No se pudo reenviar el código");
        } finally {
            setResending(false);
        }
    };

    const handleVerifyCode = async () => {
        const codigo = codeDigits.join("");
        if (codigo.length !== CODE_LENGTH || verifying) return;
        setVerifying(true);
        setVerifyError("");
        try {
            const tokens = await authService.verifyEmailCode(accountEmail, codigo);
            login(tokens.access_token, {
                username: tokens.username ?? accountEmail,
                user_id: tokens.user_id,
                id_cliente: tokens.id_cliente,
                roles: tokens.roles ?? [],
                foto_perfil: tokens.foto_perfil,
                verificado: tokens.verificado,
                activo: tokens.activo,
            });
            toast.success("¡Cuenta verificada! Bienvenido a Alik Tours.");
            handleClose();
            navigate("/profile");
        } catch (err: any) {
            const message = err?.message || "Código incorrecto";
            setVerifyError(message);
            setCodeDigits(Array(CODE_LENGTH).fill(""));
            autoSubmitted.current = false;
        } finally {
            setVerifying(false);
        }
    };

    // Auto-envía apenas se completan los 6 dígitos (a mano o pegados de
    // golpe) -- `autoSubmitted` evita reintentar solo en bucle si el
    // código resulta incorrecto y las 6 casillas quedan iguales por algún
    // motivo (no debería pasar porque se limpian en el catch, pero es una
    // salvaguarda barata).
    const codigoCompleto = codeDigits.join("");
    useEffect(() => {
        if (step === 4 && codigoCompleto.length === CODE_LENGTH && !verifying && !autoSubmitted.current) {
            autoSubmitted.current = true;
            handleVerifyCode();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoCompleto, step]);

    // Evita copiar/pegar la contraseña (obliga a escribirla realmente en
    // ambos campos, en vez de copiar el mismo valor y quedar "confirmada"
    // sin haberla tecleado dos veces).
    const bloquearPortapapeles = (e: React.ClipboardEvent<HTMLInputElement>) => e.preventDefault();

    const inputBase = (name: string) =>
        `w-full pl-11 pr-4 py-3 text-sm rounded-lg border outline-none transition-all duration-200 bg-input-background text-foreground font-medium placeholder:text-muted-foreground/60 focus:bg-card ${fieldError(name)
            ? "border-destructive focus:border-destructive focus:ring-4 focus:ring-destructive/10"
            : "border-border focus:border-primary focus:ring-4 focus:ring-primary/10"
        }`;

    const stepVariants = {
        enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
        center: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
    };

    return (
        <>
            <TerminosModal isOpen={showTerminos} onClose={() => setShowTerminos(false)} />
            <PrivacidadModal isOpen={showPrivacidad} onClose={() => setShowPrivacidad(false)} />

            <AnimatePresence>
                {isOpen && (
                    <ModalBackdrop zIndex={100} onClick={handleClose}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 15 }}
                            transition={{ type: "spring", damping: 25, stiffness: 360 }}
                            onClick={(e) => e.stopPropagation()}
                            className="relative w-full max-w-lg my-8 rounded-xl shadow-2xl border border-border overflow-hidden bg-card text-card-foreground max-h-[90vh] flex flex-col"
                        >
                            {/* ── Header ── */}
                            <div className="relative px-8 py-6 flex-shrink-0 overflow-hidden bg-primary text-primary-foreground">
                                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 blur-xl" />
                                <div className="absolute top-4 -right-4 w-20 h-20 rounded-full bg-white/5 blur-lg" />

                                <button
                                    onClick={handleClose}
                                    className="absolute top-5 right-5 p-2 rounded-lg text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10 transition-all duration-200"
                                >
                                    <X className="w-4 h-4" />
                                </button>

                                <div className="flex items-center gap-4 relative">
                                    <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center shadow-inner border border-white/10">
                                        {step === 4
                                            ? <ShieldCheck className="w-6 h-6 text-primary-foreground" />
                                            : <Plane className="w-6 h-6 text-primary-foreground transform -rotate-12" />}
                                    </div>
                                    <div>
                                        <p className="text-primary-foreground/70 text-[11px] font-bold tracking-widest uppercase">Alik Tours</p>
                                        <AnimatePresence mode="wait">
                                            <motion.h1
                                                key={step}
                                                initial={{ opacity: 0, y: -6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 6 }}
                                                transition={{ duration: DURACION.rapida, ease: EASE_SUAVE }}
                                                className="text-primary-foreground font-medium text-2xl tracking-tight leading-none mt-0.5"
                                            >
                                                {STEP_COPY[step].title}
                                            </motion.h1>
                                        </AnimatePresence>
                                    </div>
                                </div>

                                <AnimatePresence mode="wait">
                                    <motion.p
                                        key={step}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: DURACION.rapida, ease: EASE_SUAVE }}
                                        className="text-primary-foreground/80 text-xs font-normal mt-3 relative max-w-[85%]"
                                    >
                                        {STEP_COPY[step].subtitle}
                                    </motion.p>
                                </AnimatePresence>
                            </div>

                            <Stepper step={step} />

                            {/* ── Cuerpo ── */}
                            <div className="px-8 py-6 overflow-y-auto flex-1 bg-card">
                                <AnimatePresence>
                                    {formError && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="flex items-start gap-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4 text-xs font-medium mb-6 shadow-sm"
                                        >
                                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <span>{formError}</span>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <form onSubmit={handleSubmit}>
                                    <AnimatePresence mode="wait" custom={direction}>
                                        {step === 1 && (
                                            <motion.div
                                                key="step1"
                                                custom={direction}
                                                variants={stepVariants}
                                                initial="enter" animate="center" exit="exit"
                                                transition={{ duration: DURACION.rapida, ease: EASE_SUAVE }}
                                                className="space-y-4"
                                            >
                                                <Field label="Correo electrónico" icon={<Mail className="w-4 h-4" />} error={fieldError("correo_electronico")}>
                                                    <input
                                                        type="email"
                                                        name="correo_electronico"
                                                        value={formData.correo_electronico}
                                                        onChange={handleChange}
                                                        onBlur={handleBlur}
                                                        placeholder="tu@correo.com (será tu usuario)"
                                                        autoComplete="email"
                                                        inputMode="email"
                                                        required
                                                        className={inputBase("correo_electronico")}
                                                    />
                                                </Field>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <Field
                                                        label="Contraseña"
                                                        icon={<Lock className="w-4 h-4" />}
                                                        error={fieldError("password")}
                                                        suffix={
                                                            <button type="button" tabIndex={-1}
                                                                onClick={() => setShowPassword(s => !s)}
                                                                className="text-muted-foreground hover:text-primary transition-colors p-1">
                                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                            </button>
                                                        }
                                                    >
                                                        <input
                                                            type={showPassword ? "text" : "password"}
                                                            name="password"
                                                            value={formData.password}
                                                            onChange={handleChange}
                                                            onBlur={handleBlur}
                                                            onCopy={bloquearPortapapeles}
                                                            onPaste={bloquearPortapapeles}
                                                            onCut={bloquearPortapapeles}
                                                            placeholder="••••••••"
                                                            autoComplete="new-password"
                                                            required
                                                            className={inputBase("password") + " pr-10"}
                                                        />
                                                    </Field>
                                                    <Field
                                                        label="Confirmar contraseña"
                                                        icon={<Lock className="w-4 h-4" />}
                                                        error={fieldError("confirmPassword")}
                                                        suffix={
                                                            <button type="button" tabIndex={-1}
                                                                onClick={() => setShowConfirmPassword(s => !s)}
                                                                className="text-muted-foreground hover:text-primary transition-colors p-1">
                                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                            </button>
                                                        }
                                                    >
                                                        <input
                                                            type={showConfirmPassword ? "text" : "password"}
                                                            name="confirmPassword"
                                                            value={formData.confirmPassword}
                                                            onChange={handleChange}
                                                            onBlur={handleBlur}
                                                            onCopy={bloquearPortapapeles}
                                                            onPaste={bloquearPortapapeles}
                                                            onCut={bloquearPortapapeles}
                                                            placeholder="••••••••"
                                                            autoComplete="new-password"
                                                            required
                                                            className={inputBase("confirmPassword") + " pr-10"}
                                                        />
                                                    </Field>
                                                </div>

                                                <PasswordStrength password={formData.password} />

                                                <div className="pt-3">
                                                    <button
                                                        type="button"
                                                        onClick={handleContinueStep1}
                                                        className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm tracking-wide transition-all duration-200 shadow-md hover:opacity-95 active:scale-[0.99] flex items-center justify-center gap-2"
                                                    >
                                                        Continuar <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <p className="text-center text-xs font-medium text-muted-foreground">
                                                    ¿Ya tienes cuenta?{" "}
                                                    <button type="button"
                                                        onClick={() => { handleClose(); onSwitchToLogin?.(); }}
                                                        className="text-primary font-bold hover:underline transition-colors">
                                                        Inicia sesión
                                                    </button>
                                                </p>
                                            </motion.div>
                                        )}

                                        {step === 2 && (
                                            <motion.div
                                                key="step2"
                                                custom={direction}
                                                variants={stepVariants}
                                                initial="enter" animate="center" exit="exit"
                                                transition={{ duration: DURACION.rapida, ease: EASE_SUAVE }}
                                                className="space-y-3"
                                            >
                                                <div className="grid grid-cols-2 gap-3">
                                                    <Field label="Nombre" icon={<User className="w-4 h-4" />}>
                                                        <input type="text" name="nombre" value={formData.nombre}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            placeholder="Ej. Juan Pablo" autoComplete="given-name" required className={inputBase("nombre")} />
                                                    </Field>
                                                    <Field label="Apellido" icon={<User className="w-4 h-4" />}>
                                                        <input type="text" name="apellido" value={formData.apellido}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            placeholder="Ej. Castillo" autoComplete="family-name" required className={inputBase("apellido")} />
                                                    </Field>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <Field label="Cédula" icon={<CreditCard className="w-4 h-4" />} error={fieldError("cedula")}>
                                                        <input type="text" name="cedula" value={formData.cedula}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            placeholder="1020304050" required inputMode="numeric"
                                                            className={inputBase("cedula")} />
                                                    </Field>
                                                    <Field label="Celular" icon={<Phone className="w-4 h-4" />} error={fieldError("celular")}>
                                                        <input type="tel" name="celular" value={formData.celular}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            placeholder="3001234567" inputMode="tel" autoComplete="tel" required
                                                            className={inputBase("celular")} />
                                                    </Field>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <Field label="Ciudad" icon={<MapPin className="w-4 h-4" />} error={fieldError("ciudad")}>
                                                        <select
                                                            name="ciudad"
                                                            value={formData.ciudad}
                                                            onChange={handleChange}
                                                            onBlur={handleBlur}
                                                            className={inputBase("ciudad")}
                                                        >
                                                            <option value="" disabled>Selecciona tu ciudad</option>
                                                            <option value="Bogotá">Bogotá</option>
                                                            <option value="Medellín">Medellín</option>
                                                            <option value="Cali">Cali</option>
                                                            <option value="Barranquilla">Barranquilla</option>
                                                            <option value="Cartagena">Cartagena</option>
                                                            <option value="Bucaramanga">Bucaramanga</option>
                                                            <option value="Pereira">Pereira</option>
                                                            <option value="Manizales">Manizales</option>
                                                            <option value="Santa Marta">Santa Marta</option>
                                                            <option value="Cúcuta">Cúcuta</option>
                                                        </select>
                                                    </Field>
                                                    <Field label="Fecha de nacimiento" icon={<Calendar className="w-4 h-4" />} error={fieldError("fecha_nacimiento")}>
                                                        <input type="date"
                max="2100-12-31" name="fecha_nacimiento" value={formData.fecha_nacimiento}
                                                            onChange={handleChange} onBlur={handleBlur}
                                                            required className={inputBase("fecha_nacimiento") + " text-foreground"} />
                                                    </Field>
                                                </div>

                                                <Field label="Dirección" icon={<MapPin className="w-4 h-4" />} error={fieldError("direccion")} optional>
                                                    <input type="text" name="direccion" value={formData.direccion}
                                                        onChange={handleChange} onBlur={handleBlur}
                                                        placeholder="Ej. Calle 45 #12-34"
                                                        autoComplete="street-address"
                                                        className={inputBase("direccion")} />
                                                </Field>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <Field label="Barrio / Localidad" icon={<Building2 className="w-4 h-4" />} optional>
                                                        <input type="text" name="barrio" value={formData.barrio}
                                                            onChange={handleChange}
                                                            placeholder="Ej. Chapinero"
                                                            className={inputBase("barrio")} />
                                                    </Field>
                                                    <Field label="Departamento" icon={<MapPin className="w-4 h-4" />} optional>
                                                        <select
                                                            name="departamento"
                                                            value={formData.departamento}
                                                            onChange={handleChange}
                                                            className={inputBase("departamento")}
                                                        >
                                                            <option value="">Selecciona</option>
                                                            {DEPARTAMENTOS_COLOMBIA.map((d) => (
                                                                <option key={d} value={d}>{d}</option>
                                                            ))}
                                                        </select>
                                                    </Field>
                                                </div>

                                                <Field label="Código postal" icon={<MapPin className="w-4 h-4" />} optional>
                                                    <input type="text" name="codigo_postal" value={formData.codigo_postal}
                                                        onChange={handleChange} placeholder="Ej. 110221"
                                                        inputMode="numeric" autoComplete="postal-code"
                                                        className={inputBase("codigo_postal")} />
                                                </Field>

                                                <div className="flex gap-3 pt-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => goToStep(1)}
                                                        className="flex-1 py-3.5 rounded-lg border border-border text-foreground font-medium text-sm tracking-wide transition-all hover:bg-muted flex items-center justify-center gap-2"
                                                    >
                                                        <ArrowLeft className="w-4 h-4" /> Atrás
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleContinueStep2}
                                                        className="flex-[2] py-3.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm tracking-wide transition-all shadow-md hover:opacity-95 active:scale-[0.99] flex items-center justify-center gap-2"
                                                    >
                                                        Continuar <ArrowRight className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}

                                        {step === 3 && (
                                            <motion.div
                                                key="step3"
                                                custom={direction}
                                                variants={stepVariants}
                                                initial="enter" animate="center" exit="exit"
                                                transition={{ duration: DURACION.rapida, ease: EASE_SUAVE }}
                                                className="space-y-5"
                                            >
                                                <div className="bg-muted/40 border border-border p-5 rounded-lg space-y-3 shadow-sm">
                                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Revisa tus datos</p>
                                                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                                                        <dt className="text-muted-foreground">Nombre</dt>
                                                        <dd className="font-medium text-foreground text-right">{formData.nombre} {formData.apellido}</dd>
                                                        <dt className="text-muted-foreground">Correo</dt>
                                                        <dd className="font-medium text-foreground text-right truncate">{formData.correo_electronico}</dd>
                                                        <dt className="text-muted-foreground">Cédula</dt>
                                                        <dd className="font-medium text-foreground text-right">{formData.cedula}</dd>
                                                        <dt className="text-muted-foreground">Ciudad</dt>
                                                        <dd className="font-medium text-foreground text-right">{formData.ciudad}</dd>
                                                    </dl>
                                                    <div className="flex items-center gap-3 pt-1 border-t border-border">
                                                        <button type="button" onClick={() => goToStep(1)}
                                                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 pt-2">
                                                            <Pencil className="w-3 h-3" /> Datos de acceso
                                                        </button>
                                                        <button type="button" onClick={() => goToStep(2)}
                                                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 pt-2">
                                                            <Pencil className="w-3 h-3" /> Datos personales
                                                        </button>
                                                    </div>
                                                </div>

                                                <label className="flex items-start gap-3 cursor-pointer select-none px-1 py-1 group">
                                                    <div className="relative mt-0.5 flex-shrink-0">
                                                        <input type="checkbox" checked={acceptedTerms}
                                                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                                                            className="sr-only peer" />
                                                        <div className="w-4 h-4 rounded border-2 border-border peer-checked:border-primary peer-checked:bg-primary transition-all duration-200 flex items-center justify-center group-hover:border-primary/80">
                                                            {acceptedTerms && (
                                                                <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="text-[11px] text-muted-foreground font-medium leading-normal">
                                                        He leído y acepto los{" "}
                                                        <button type="button"
                                                            onClick={(e) => { e.preventDefault(); setShowTerminos(true); }}
                                                            className="text-primary hover:underline font-bold transition-colors">
                                                            Términos y Condiciones
                                                        </button>{" "}
                                                        y la{" "}
                                                        <button type="button"
                                                            onClick={(e) => { e.preventDefault(); setShowPrivacidad(true); }}
                                                            className="text-primary hover:underline font-bold transition-colors">
                                                            Política de Privacidad
                                                        </button>{" "}
                                                        de Alik Tours
                                                    </span>
                                                </label>

                                                <div className="flex gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => goToStep(2)}
                                                        className="flex-1 py-3.5 rounded-lg border border-border text-foreground font-medium text-sm tracking-wide transition-all hover:bg-muted flex items-center justify-center gap-2"
                                                    >
                                                        <ArrowLeft className="w-4 h-4" /> Atrás
                                                    </button>
                                                    <button type="submit" disabled={!isFormValid || loading}
                                                        className="flex-[2] py-3.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm tracking-wide transition-all duration-200 shadow-md hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                        {loading ? (
                                                            <span className="flex items-center justify-center gap-2">
                                                                <svg className="animate-spin w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                                </svg>
                                                                Creando cuenta...
                                                            </span>
                                                        ) : "Crear cuenta →"}
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}

                                        {step === 4 && (
                                            <motion.div
                                                key="step4"
                                                custom={direction}
                                                variants={stepVariants}
                                                initial="enter" animate="center" exit="exit"
                                                transition={{ duration: DURACION.rapida, ease: EASE_SUAVE }}
                                                className="text-center py-4"
                                            >
                                                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-accent text-accent-foreground shadow-md ring-4 ring-primary/5">
                                                    <Mail className="w-7 h-7" />
                                                </div>
                                                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
                                                    Enviamos un código de 6 dígitos a <br />
                                                    <span className="font-bold text-foreground">{accountEmail}</span>
                                                </p>

                                                <OtpCodeInput
                                                    value={codeDigits}
                                                    onChange={setCodeDigits}
                                                    disabled={verifying}
                                                    autoFocus
                                                    error={!!verifyError}
                                                />

                                                <AnimatePresence>
                                                    {verifyError && (
                                                        <motion.p
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: "auto" }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="text-[12px] text-destructive font-medium flex items-center justify-center gap-1 mt-3"
                                                        >
                                                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                                            {verifyError}
                                                        </motion.p>
                                                    )}
                                                </AnimatePresence>

                                                <button
                                                    type="button"
                                                    onClick={handleVerifyCode}
                                                    disabled={verifying || codigoCompleto.length !== CODE_LENGTH}
                                                    className="w-full mt-6 py-3.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm tracking-wide transition-all shadow-md hover:opacity-95 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                >
                                                    {verifying ? (
                                                        <>
                                                            <svg className="animate-spin w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                            </svg>
                                                            Verificando...
                                                        </>
                                                    ) : "Verificar cuenta"}
                                                </button>

                                                <button
                                                    onClick={handleResend}
                                                    disabled={resending || resendCooldown > 0}
                                                    className="w-full py-3 mt-2 rounded-lg text-primary font-medium text-xs tracking-wide transition-all hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
                                                >
                                                    <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                                                    {resending
                                                        ? "Reenviando..."
                                                        : resendCooldown > 0
                                                            ? `Reenviar código (${resendCooldown}s)`
                                                            : "Reenviar código"}
                                                </button>

                                                <p className="text-[11px] font-medium text-muted-foreground mt-4 bg-muted py-1.5 px-3 rounded-lg border border-border inline-block">
                                                    ¿No te llegó? Revisa spam/promociones -- también puedes abrir el enlace del mismo correo.
                                                </p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </form>
                            </div>
                        </motion.div>
                    </ModalBackdrop>
                )}
            </AnimatePresence>
        </>
    );
}
