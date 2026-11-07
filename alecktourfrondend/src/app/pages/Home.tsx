import Benefits from "../components/Benefits";
import BannersPromocionales from "../components/BannersPromocionales";
import BlogGuides from "../components/BlogGuides";
import VideosPromocionales from "../components/comunidad/VideosPromocionales";
import DestinationsGrid from "../components/DestinationsGrid";
import Footer from "../components/Footer";
import Hero from "../components/Hero";
import Navbar from "../components/Navbar";
import Newsletter from "../components/Newsletter";
import OffersHighlight from "../components/OffersHighlight";
import PromocionAccordeon from "../components/PromocionAccordeon";
import ScrollToTopButton from "../components/ScrollToTopButton";
import Testimonials from "../components/Testimonials";
import VuelosInicio from "../components/VuelosInicio";
import WhyChooseUs from "../components/WhyChooseUs";
import { useSeoMeta } from "../hooks/useSeoMeta";

export default function Home() {
  useSeoMeta({
    title: "Agencia de Viajes en Colombia · RNT 224224",
    description:
      "Alik Tours, agencia de viajes en Colombia (RNT 224224): paquetes nacionales e internacionales, hoteles y viajes a tu medida con asesoría humana y pago en cuotas.",
    path: "/",
  });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-clip">
      <Navbar />
      <Hero />
      <BannersPromocionales />
      <PromocionAccordeon />
      {/* Zona de vuelos: buscador rápido y próximas ofertas aéreas. */}
      <VuelosInicio />
      <Benefits />
      <DestinationsGrid />
      {/* Videos que el admin marca "Mostrar en el inicio" (si no hay, no ocupa espacio). */}
      <VideosPromocionales
        inicio
        subtitulo="Lo que hacemos en cada viaje, contado por nuestro equipo."
      />
      <OffersHighlight />
      <WhyChooseUs />
      <Testimonials />
      <BlogGuides />

      <div className="bg-card">
        <Newsletter />
      </div>

      <Footer />
      <ScrollToTopButton />
    </div>
  );
}