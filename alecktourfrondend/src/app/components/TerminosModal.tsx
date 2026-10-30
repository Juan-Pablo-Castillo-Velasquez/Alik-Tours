import { useEffect } from "react";
import { TERMINOS_ES_BORRADOR, TERMINOS_FECHA, TERMINOS_SECCIONES, TERMINOS_VERSION } from "../content/terminos";
import ModalBackdrop from "./ui/ModalBackdrop";

interface TerminosModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function TerminosModal({ isOpen, onClose }: TerminosModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            {/* ── Estilos para un Scrollbar Premium ── */}
            <style>{`
        .modal-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .modal-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .modal-scrollbar::-webkit-scrollbar-thumb {
          background-color: var(--border);
          border-radius: 10px;
        }
        .dark .modal-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.15);
        }
      `}</style>

            <ModalBackdrop zIndex={200} onClick={onClose}>
                <div
                    className="bg-card text-card-foreground rounded-2xl shadow-2xl dark:shadow-[0_10px_40px_rgba(0,0,0,0.6)] w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-border dark:border-white/10"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ── Header Comercial Granate Agencia ── */}
                    <div className="relative flex items-center justify-between px-6 py-5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground border-b border-primary-foreground/10 overflow-hidden">
                        {/* Patrón de fondo sutil para el header */}
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent"></div>

                        <div className="relative flex items-center gap-4">
                            <div className="bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-xl p-2.5 border border-white/20 dark:border-white/10 shadow-sm">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-white font-semibold text-xl tracking-tight">Términos y Condiciones</h2>
                                <p className="text-white/80 text-xs font-medium mt-0.5">Alik Tours · RNT 224224 · {TERMINOS_FECHA}</p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="relative bg-white/10 hover:bg-white/20 dark:bg-black/20 dark:hover:bg-black/40 text-white rounded-xl p-2 transition-all duration-200"
                            aria-label="Cerrar modal"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* ── Contenido Semántico ── */}
                    <div className="modal-scrollbar overflow-y-auto px-6 py-8 flex-1 text-sm bg-card space-y-8">
                        {TERMINOS_ES_BORRADOR && (
                            <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-xs text-foreground">
                                Borrador pendiente de revisión jurídica · Versión {TERMINOS_VERSION} · {TERMINOS_FECHA}
                            </p>
                        )}
                        {TERMINOS_SECCIONES.map((s) => (
                            <Section key={s.titulo} title={s.titulo}>
                                {s.parrafos.map((p, i) => (
                                    <p key={i} className={i > 0 ? "mt-2" : undefined}>{p}</p>
                                ))}
                            </Section>
                        ))}
                    </div>

                    {/* ── Footer ── */}
                    <div className="px-6 py-5 border-t border-border dark:border-white/10 flex justify-end bg-muted/40 dark:bg-white/[0.02] backdrop-blur-sm">
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-[0_4px_14px_0_rgba(123,30,58,0.39)] hover:shadow-[0_6px_20px_rgba(123,30,58,0.23)] dark:shadow-none transition-all duration-200 active:scale-95 flex items-center gap-2"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </ModalBackdrop>
        </>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2 group">
            <h3 className="font-semibold text-foreground text-base tracking-tight flex items-center gap-2">
                {title}
            </h3>
            <div className="text-muted-foreground leading-relaxed text-[14.5px]">
                {children}
            </div>
        </div>
    );
}