import { createContext, ReactNode, useContext, useState } from "react";
import { LoginModalDiferido, RegisterModalDiferido } from "../components/ModalesAuthDiferidos";

interface AuthModalContextType {
    openLogin: () => void;
    openRegister: () => void;
    closeModals: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);

    const openLogin = () => {
        setShowRegister(false);
        setShowLogin(true);
    };

    const openRegister = () => {
        setShowLogin(false);
        setShowRegister(true);
    };

    const closeModals = () => {
        setShowLogin(false);
        setShowRegister(false);
    };

    return (
        <AuthModalContext.Provider value={{ openLogin, openRegister, closeModals }}>
            {children}

            <LoginModalDiferido
                isOpen={showLogin}
                onClose={() => setShowLogin(false)}
                onSwitchToRegister={openRegister}
            />
            <RegisterModalDiferido
                isOpen={showRegister}
                onClose={() => setShowRegister(false)}
                onSwitchToLogin={openLogin}
            />
        </AuthModalContext.Provider>
    );
}

export function useAuthModal() {
    const ctx = useContext(AuthModalContext);
    if (!ctx) throw new Error("useAuthModal debe usarse dentro de AuthModalProvider");
    return ctx;
}