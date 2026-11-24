import Footer from "../components/Footer";
export default function NotFound() {
    return (
        <>
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-6 text-center">

            {/* 404 Estilo Tipográfico Minimalista */}
            {/* Usamos text-primary/20 para un granate muy sutil sobre el fondo negro */}
            <h1 className="text-[150px] md:text-[200px] font-black text-primary/20 select-none leading-none tracking-tighter">
                404
            </h1>

            {/* Mensaje de error con contraste alto */}
            <div className="-mt-10 md:-mt-16">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                    Página no encontrada
                </h2>
                <p className="mt-4 max-w-sm text-muted-foreground mx-auto">
                    Lo sentimos, esta ruta no existe. Pero el granate siempre te guía a casa.
                </p>
            </div>

            {/* Botones Estilo Premium */}
            <div className="mt-12 flex flex-col sm:flex-row gap-4">
                {/* Botón Primario: Fondo Granate, texto Blanco */}
                <a
                    href="/"
                    className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-primary px-8 font-medium text-primary-foreground transition-all hover:scale-105 active:scale-95"
                >
                    <span>Volver a casa</span>
                </a>

                {/* Botón Secundario: Borde Granate, fondo transparente */}
                <a
                    href="/contact"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-primary/50 bg-transparent px-8 font-medium text-foreground transition-all hover:bg-primary/10 hover:border-primary active:scale-95"
                >
                    Contactar Soporte
                </a>
            </div>

            {/* Footer minimalista */}
            <div className="absolute bottom-10 text-xs text-muted-foreground">
                © 2026 Agencia
            </div>

        </div>
        <Footer />

        </>
    );
}