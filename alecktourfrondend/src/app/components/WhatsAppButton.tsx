import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Mail, MessageCircle, UserPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext";
import BotonWhatsApp from "./BotonWhatsApp";

// Antes era un enlace directo a WhatsApp ("Hablar con un asesor" ya era el
// texto del botón, pero abría wa.me en una pestaña nueva). El brief pide
// reemplazarlo: si el usuario ya está registrado, lo lleva directo al chat
// real del panel (el mismo que usa TabMensajes.tsx en su perfil, vía el
// deep-link { tab: "mensajes" } que ya usa ReservaCard para "Hablar de
// esta reserva" -- mismo mecanismo, se reutiliza tal cual). Si no está
// registrado, chatear en vivo no es posible (el chat exige un id_cliente
// real, ver mensaje_chat_route.py), así que ofrece las dos salidas reales:
// crear una cuenta, o escribir sin registrarse por el formulario de
// contacto que ya existe.
export default function WhatsAppButton() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { isAuthenticated, usuario } = useAuth();
  const { openRegister } = useAuthModal();
  const navigate = useNavigate();

  const puedeChatear = isAuthenticated && usuario?.id_cliente != null;

  const handleClick = () => {
    if (puedeChatear) {
      navigate("/profile", { state: { tab: "mensajes" } });
    } else {
      setMenuAbierto((v) => !v);
    }
  };

  return (
    <>
      {menuAbierto && !puedeChatear && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuAbierto(false)} />
      )}

      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {menuAbierto && !puedeChatear && (
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="w-64 rounded-2xl border border-border bg-card shadow-xl p-3 space-y-1.5"
          >
            {/* Lo más rápido sin cuenta: WhatsApp con la agencia. */}
            <BotonWhatsApp
              variante="bloque"
              texto="Escribir por WhatsApp"
              onClick={() => setMenuAbierto(false)}
            />
            <p className="text-xs text-muted-foreground px-1 pt-1.5 pb-1">
              O chatea en vivo desde tu cuenta:
            </p>
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false);
                openRegister();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-primary to-[#A13B55] text-primary-foreground hover:shadow-md transition-all"
            >
              <UserPlus className="w-4 h-4 flex-shrink-0" />
              Crear cuenta y chatear
            </button>
            <Link
              to="/contact"
              onClick={() => setMenuAbierto(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Mail className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              Escribir sin registrarte
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={handleClick}
          title="Hablar con un asesor"
          className="flex items-center gap-2 bg-gradient-to-r from-primary to-[#A13B55] text-primary-foreground pl-3 pr-4 py-3 rounded-full shadow-lg shadow-black/20 hover:scale-105 hover:shadow-xl transition-all duration-200"
        >
          {menuAbierto && !puedeChatear ? (
            <X className="w-6 h-6 shrink-0" />
          ) : (
            <MessageCircle className="w-6 h-6 shrink-0" />
          )}
          <span className="hidden sm:inline text-sm font-semibold whitespace-nowrap">
            Hablar con un asesor
          </span>
        </button>
      </div>
    </>
  );
}
