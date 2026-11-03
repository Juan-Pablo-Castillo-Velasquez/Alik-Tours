import { CheckCircle, Lock, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { authService } from "../services/auth.service";
import ModalBackdrop from "./ui/ModalBackdrop";

interface ResetPasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    token: string;
}

export default function ResetPasswordModal({ isOpen, onClose, token }: ResetPasswordModalProps) {
    const navigate = useNavigate();
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [msg, setMsg] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const resetState = () => {
        setPassword("");
        setConfirm("");
        setMsg("");
        setError("");
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    async function handleReset() {
        setError("");
        // Misma regla que el registro y que el backend (PasswordResetConfirm,
        // user_schema.py): antes aquí solo se pedían 6 caracteres y el API
        // terminaba rechazando una clave sin mayúscula o sin número.
        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(password)) {
            setError("La contraseña debe tener mínimo 6 caracteres, una mayúscula, una minúscula y un número");
            return;
        }
        if (password !== confirm) {
            setError("Las contraseñas no coinciden");
            return;
        }
        setLoading(true);
        try {
            const res = await authService.resetPassword(token, password);
            setMsg(res.message);
            setTimeout(() => {
                handleClose();
                navigate("/");
            }, 2000);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <ModalBackdrop zIndex={100} onClick={msg ? undefined : handleClose}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 24 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 24 }}
                        transition={{ type: "spring", damping: 22, stiffness: 300 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md bg-card text-card-foreground border border-border rounded-3xl shadow-2xl p-8"
                    >
                        {!msg && (
                            <button
                                onClick={handleClose}
                                className="absolute top-5 right-5 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}

                        {msg ? (
                            <div className="text-center py-4">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle className="w-8 h-8 text-green-600" />
                                </div>
                                <h2 className="text-xl font-bold text-foreground mb-1">¡Contraseña actualizada!</h2>
                                <p className="text-muted-foreground text-sm">{msg}</p>
                                <p className="text-xs text-muted-foreground mt-3">Redirigiendo...</p>
                            </div>
                        ) : (
                            <>
                                <div className="mb-6">
                                    <div className="w-12 h-12 bg-gold/15 rounded-xl flex items-center justify-center mb-4">
                                        <Lock className="w-6 h-6 text-gold" />
                                    </div>
                                    <h1 className="text-2xl font-bold text-foreground mb-1">Nueva contraseña</h1>
                                    <p className="text-muted-foreground text-sm">Ingresa tu nueva contraseña para continuar.</p>
                                </div>

                                {error && (
                                    <div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-xl p-3 text-sm mb-4">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">Nueva contraseña</label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            autoFocus
                                            onKeyDown={(e) => e.key === "Enter" && handleReset()}
                                            className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-muted-foreground mb-1">Confirmar contraseña</label>
                                        <input
                                            type="password"
                                            value={confirm}
                                            onChange={(e) => setConfirm(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleReset()}
                                            className="w-full bg-input-background border border-border rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleReset}
                                    disabled={loading}
                                    className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:shadow-lg hover:brightness-110 transition-all disabled:opacity-60"
                                >
                                    {loading ? "Guardando..." : "Restablecer contraseña"}
                                </motion.button>
                            </>
                        )}
                    </motion.div>
                </ModalBackdrop>
            )}
        </AnimatePresence>
    );
}