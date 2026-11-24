import { Heart, Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import Pagination from "../ui/pagination";
import { usePagination } from "../../hooks/usePagination";
import { Link } from "react-router";
import HotelCard from "../HotelCard";
import { favoritoService, FavoritoResponse } from "../../services/favorito.service";
import EncabezadoTab, { PanelPerfil, VacioPerfil } from "./EncabezadoTab";

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

  const conHotel = favoritos.filter((f) => f.hotel);

  return (
    <div>
      <EncabezadoTab
        titulo="Favoritos"
        descripcion="Los hoteles que guardaste para comparar o reservar más adelante."
        accion={
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted"
          >
            <Search className="h-4 w-4 text-primary" /> Buscar hoteles
          </Link>
        }
      />

      {loading ? (
        <div className="grid gap-5 md:grid-cols-2" aria-busy="true" aria-label="Cargando tus favoritos">
          {[0, 1].map((i) => (
            <div key={i} className="h-96 animate-pulse rounded-3xl border border-border bg-muted/40" />
          ))}
        </div>
      ) : conHotel.length === 0 ? (
        <PanelPerfil>
          <VacioPerfil
            icono={Heart}
            titulo="Aún no tienes favoritos"
            texto="Toca el corazón en cualquier hotel para guardarlo aquí y compararlo con calma."
            accion={
              <Link
                to="/search"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
              >
                Explorar hoteles
              </Link>
            }
          />
        </PanelPerfil>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {`${conHotel.length} ${conHotel.length === 1 ? "hotel guardado" : "hoteles guardados"}`}
          </p>
          {/* Dos por fila: la tarjeta se acomoda sola a su ancho (vertical). */}
          <div className="grid gap-5 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {pagFavoritos.slice.map((f) => (
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
          <Pagination
            page={pagFavoritos.page}
            pageCount={pagFavoritos.pageCount}
            onPageChange={pagFavoritos.setPage}
            total={conHotel.length}
            pageSize={6}
            etiqueta="hoteles"
            className="mt-6"
          />
        </>
      )}
    </div>
  );
}
