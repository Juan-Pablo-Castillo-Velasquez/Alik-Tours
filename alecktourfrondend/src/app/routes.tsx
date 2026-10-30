import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import { LoginRedirect, RegisterRedirect } from "./components/AuthRedirects";
import ProtectedRoute from "./components/ProtectedRoute";
import RouteErrorBoundary from "./components/RouteErrorBoundary";
import RootLayout from "./layouts/RootLayout";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

// Code-splitting por ruta (ver también el comentario en RootLayout.tsx):
// antes estas ~20 páginas se importaban TODAS arriba de este archivo, así
// que la primera visita a "/" descargaba también el bundle completo del
// panel admin, checkout, detalle de hotel, etc. -- ese era el chunk único
// de ~2.2MB que "vite build" ya marcaba como advertencia ("Some chunks are
// larger than 500 kB"), y pesa directo en el hallazgo de "rendimiento" que
// reportó Search Console. Con lazy() cada página baja solo cuando alguien
// navega a su ruta. Home queda con import normal porque es la puerta de
// entrada más común del sitio (no tiene sentido retrasarla con un splash
// de carga extra).
const AdminDashboard = lazy(() => import("./pages/Admindashboard"));
const Benefits = lazy(() => import("./pages/Benefits"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Confirmation = lazy(() => import("./pages/Confirmation"));
const Comunidad = lazy(() => import("./pages/Comunidad"));
const Contact = lazy(() => import("./pages/Contact"));
const Corporate = lazy(() => import("./pages/Corporate"));
const FAQ = lazy(() => import("./pages/faq"));
const HotelDetail = lazy(() => import("./pages/HotelDetail"));
const PackageDetail = lazy(() => import("./pages/PackageDetail"));
const Packages = lazy(() => import("./pages/Packages"));
const Personalization = lazy(() => import("./pages/Personalization"));
const PreferencesForm = lazy(() => import("./pages/PreferencesForm"));
const Profile = lazy(() => import("./pages/Profile"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const Testimonios = lazy(() => import("./pages/Testimonios"));
const TravelInfo = lazy(() => import("./pages/TravelInfo"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    // Atrapa cualquier error no manejado en cualquier página (incluye un
    // lazy() que falla en cargar su chunk, ver RouteErrorBoundary.tsx) --
    // sin esto, React Router muestra su propia pantalla genérica de
    // desarrollo ("💿 Hey developer...") en producción.
    errorElement: <RouteErrorBoundary />,
    children: [
      { path: "/", Component: Home },
      { path: "/search", Component: SearchResults },
      { path: "/package/:id", Component: PackageDetail },
      { path: "/packages", Component: Packages },
      { path: "/login", Component: LoginRedirect },
      { path: "/register", Component: RegisterRedirect },
      { path: "/checkout/:id", Component: Checkout },
      { path: "/confirmation", Component: Confirmation },
      { path: "/benefits", Component: Benefits },
      { path: "/corporate", Component: Corporate },
      { path: "/travel-info", Component: TravelInfo },
      { path: "/hotel/:id", Component: HotelDetail },
      { path: "/verify", Component: VerifyEmail },
      { path: "/faq", Component: FAQ },
      { path: "/comunidad", Component: Comunidad },
      { path: "/contact", Component: Contact },
      { path: "/testimonios", Component: Testimonios },
      { path: "/reset-password", Component: ResetPassword },
      { path: "/terms", Component: TermsAndConditions },
      { path: "/privacy", Component: PrivacyPolicy },
      { path: "*", Component: NotFound },

      // Rutas protegidas (requieren login)
      {
        path: "/profile",
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: "/personalize/:id",
        element: (
          <ProtectedRoute>
            <Personalization />
          </ProtectedRoute>
        ),
      },
      {
        path: "/preferences",
        element: (
          <ProtectedRoute>
            <PreferencesForm />
          </ProtectedRoute>
        ),
      },

      // Admin y empleado (asesor) -- ProtectedRoute con requiredRole="empleado"
      // deja pasar a AMBOS roles (ver ProtectedRoute.tsx), el panel de
      // adentro (Admindashboard.tsx) es el que muestra la versión recortada
      // cuando quien entra no es admin.
      {
        path: "/admin",
        element: (
          <ProtectedRoute requiredRole="empleado">
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
    ],
  },
]);
