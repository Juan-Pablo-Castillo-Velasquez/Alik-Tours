import { CheckCircle, Loader2, Plane, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { authService } from "../services/auth.service";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); return; }

    authService.verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/85 to-gold/20 dark:from-background dark:to-card flex items-center justify-center p-4 transition-colors duration-300">
      <div className="bg-card rounded-xl shadow-2xl p-10 max-w-md w-full text-center border border-border">

        {/* Isotipo/Logo animado superior */}
        <div className="flex justify-center mb-8">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Plane className={`w-8 h-8 text-primary ${status === 'loading' ? 'animate-bounce' : ''}`} />
          </div>
        </div>

        {/* ESTADO: CARGANDO */}
        {status === 'loading' && (
          <div className="py-6 flex flex-col items-center">
            <Loader2 className="w-10 h-10 text-gold animate-spin mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-1">Verificando tus datos</h2>
            <p className="text-sm text-muted-foreground">Espera un momento mientras validamos tu cuenta...</p>
          </div>
        )}

        {/* ESTADO: ÉXITO */}
        {status === 'success' && (
          <>
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
              <CheckCircle className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2 tracking-tight">¡Email verificado!</h2>
            <p className="text-sm text-muted-foreground mb-8">Tu cuenta de Alik Tours está lista. Ya puedes iniciar sesión y planear tu próximo destino.</p>

            <button onClick={() => navigate('/login')}
              className="w-full py-4 bg-gradient-to-r from-primary to-primary/70 text-primary-foreground font-bold uppercase text-xs tracking-widest rounded-xl hover:opacity-95 shadow-md transform active:scale-[0.98] transition-all cursor-pointer">
              Iniciar sesión
            </button>
          </>
        )}

        {/* ESTADO: ERROR */}
        {status === 'error' && (
          <>
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-destructive/20">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-2 tracking-tight">Token inválido o expirado</h2>
            <p className="text-sm text-muted-foreground mb-8">El enlace de verificación ya fue utilizado o ha caducado por motivos de seguridad.</p>

            <button onClick={() => navigate('/register')}
              className="w-full py-4 bg-gradient-to-r from-primary to-primary/70 text-primary-foreground font-bold uppercase text-xs tracking-widest rounded-xl hover:opacity-95 shadow-md transform active:scale-[0.98] transition-all cursor-pointer">
              Volver al registro
            </button>
          </>
        )}

      </div>
    </div>
  );
}