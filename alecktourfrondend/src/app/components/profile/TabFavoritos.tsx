import { Heart, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import { Link } from "react-router";
import HotelCard from "../HotelCard";
import { favoritoService, FavoritoResponse } from "../../services/favorito.service";
import SectionHeader from "./TabReservas/SectionHeader";

export default function TabFavoritos() {
  const [favoritos, setFavoritos] = useState<FavoritoResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    favoritoService
      .listar()
      .then(setFavoritos)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pagFavoritos = usePagination(
    favoritos.filter((f) => f.hotel),
    6,
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          Tus Hoteles Favoritos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Los hoteles que guardaste para comparar o reservar más adelante.
        </p>
      </div>

      {loading ? (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Cargando tus favoritos...</p>
        </div>
      ) : favoritos.length === 0 ? (
        <div className="bg-card text-card-foreground border border-border rounded-xl p-12 text-center shadow-sm">
          <Heart className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground tracking-tight">
            Aún no tienes favoritos
          </h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
            Toca el corazón en cualquier hotel del catálogo para guardarlo aquí.
          </p>
          <Link
            to="/search"
            className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-95 transition-all shadow-sm"
          >
            Explorar Catálogo
          </Link>
        </div>
      ) : (
        <section>
          <SectionHeader
            title="Hoteles guardados"
            subtitle={`${favoritos.length} hotel${favoritos.length !== 1 ? "es" : ""} en tu lista`}
            icon={Heart}
          />
          <div className="flex flex-col gap-5">
            <AnimatePresence mode="popLayout">
              {pagFavoritos.slice
                .map((f) => (
                  <motion.div
                    key={f.id_favorito}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <HotelCard hotel={f.hotel!} />
                  </motion.div>
                ))}
            </AnimatePresence>
          </div>
          <Pagination page={pagFavoritos.page} pageCount={pagFavoritos.pageCount} onPageChange={pagFavoritos.setPage} className="mt-5" />
        </section>
      )}
    </div>
  );
}
