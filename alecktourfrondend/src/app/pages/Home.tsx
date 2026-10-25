import Benefits from "../components/Benefits";
import BannersPromocionales from "../components/BannersPromocionales";
import BlogGuides from "../components/BlogGuides";
import DestinationsGrid from "../components/DestinationsGrid";
import Footer from "../components/Footer";
import Hero from "../components/Hero";
import Navbar from "../components/Navbar";
import Newsletter from "../components/Newsletter";
import OffersHighlight from "../components/OffersHighlight";
import PromoBar from "../components/PromoBar";
import PromocionAccordeon from "../components/PromocionAccordeon";
import ScrollToTopButton from "../components/ScrollToTopButton";
import Testimonials from "../components/Testimonials";
import WhyChooseUs from "../components/WhyChooseUs";
import { useSeoMeta } from "../hooks/useSeoMeta";

export default function Home() {
  useSeoMeta({
    title: "Agencia de Viajes y Turismo en Colombia",
    description:
      "Descubre los mejores destinos de Colombia con Alik tours. Reserva hoteles, paquetes y tours de forma rápida y segura.",
    path: "/",
  });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-clip">
      <PromoBar />
      <Navbar />
      <Hero />
      <BannersPromocionales />
      <PromocionAccordeon />
      <Benefits />
      <DestinationsGrid />
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