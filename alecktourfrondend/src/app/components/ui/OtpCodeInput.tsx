import { useRef } from "react";

interface OtpCodeInputProps {
    length?: number;
    value: string[];
    onChange: (digits: string[]) => void;
    disabled?: boolean;
    autoFocus?: boolean;
    error?: boolean;
}

/**
 * Casillas de código de un dígito cada una (patrón OTP estándar), en vez de
 * un solo <input> de 6 caracteres -- avanza sola al siguiente dígito,
 * retrocede con Backspace, y pega un código completo copiado (ej. desde el
 * correo) repartiéndolo en las 6 casillas de una sola vez.
 *
 * Compartido entre RegisterModal.tsx (verificación justo después de crear
 * la cuenta) y LoginModal.tsx (cuando alguien intenta iniciar sesión antes
 * de verificar) -- mismo componente para no mantener dos copias del mismo
 * manejo de foco/pegado.
 */
export default function OtpCodeInput({
    length = 6,
    value,
    onChange,
    disabled,
    autoFocus,
    error,
}: OtpCodeInputProps) {
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    const setDigit = (index: number, raw: string) => {
        const digit = raw.replace(/\D/g, "").slice(-1);
        const next = [...value];
        next[index] = digit;
        onChange(next);
        if (digit && index < length - 1) refs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !value[index] && index > 0) {
            const next = [...value];
            next[index - 1] = "";
            onChange(next);
            refs.current[index - 1]?.focus();
        } else if (e.key === "ArrowLeft" && index > 0) {
            refs.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < length - 1) {
            refs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (!pasted) return;
        e.preventDefault();
        const next = Array(length).fill("");
        for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
        onChange(next);
        const lastIndex = Math.max(0, Math.min(pasted.length, length) - 1);
        refs.current[lastIndex]?.focus();
    };

    return (
        <div className="flex items-center justify-center gap-2">
            {Array.from({ length }).map((_, i) => (
                <input
                    key={i}
                    ref={(el) => { refs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    // Accesibilidad (bootcamp, semana 7): 6 cajas sin nombre.
                    aria-label={`Dígito ${i + 1} de ${length}`}
                    maxLength={1}
                    autoFocus={autoFocus && i === 0}
                    disabled={disabled}
                    value={value[i] ?? ""}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    className={`w-11 h-12 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-lg border-2 bg-input-background text-foreground outline-none transition-all duration-150 focus:bg-card disabled:opacity-50 ${error
                        ? "border-destructive focus:ring-4 focus:ring-destructive/10"
                        : "border-border focus:border-primary focus:ring-4 focus:ring-primary/10"
                        }`}
                />
            ))}
        </div>
    );
}
