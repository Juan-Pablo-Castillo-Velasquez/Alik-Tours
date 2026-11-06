import { MotionConfig } from "motion/react";
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import WelcomeSplash from "./app/components/WelcomeSplash.tsx";
import { AuthProvider } from "./app/context/AuthContext";
import { FavoritosProvider } from "./app/context/FavoritosContext";
import { TemaProvider } from "./app/context/TemaContext";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  // reducedMotion="user": si la persona activó "reducir movimiento" en su
  // sistema (mareo, migraña, epilepsia), las ~50 animaciones de motion/react
  // del sitio se vuelven instantáneas en vez de deslizarse.
  <MotionConfig reducedMotion="user">
  <AuthProvider>
    <FavoritosProvider>
      <TemaProvider>
        <App />
        {/* Fuera de <App />/RouterProvider a propósito: es un overlay
            global (poster de bienvenida, sección 7 del brief) que debe
            aparecer sin importar por qué ruta entre alguien al sitio, no
            solo Home -- y una sola vez por sesión (ver WelcomeSplash.tsx). */}
        <WelcomeSplash />
      </TemaProvider>
    </FavoritosProvider>
  </AuthProvider>
  </MotionConfig>
);