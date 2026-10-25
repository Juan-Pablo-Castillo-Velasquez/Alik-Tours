import { Link } from "react-router";

export default function AdminFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="flex-shrink-0 border-t border-border bg-card px-6 py-3 transition-colors duration-300">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <p>© {currentYear} Alik tours. Panel de administración interno.</p>
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:text-foreground transition-colors">
            Ir al sitio público
          </Link>
          <Link to="/faq" className="hover:text-foreground transition-colors">
            Ayuda
          </Link>
        </div>
      </div>
    </footer>
  );
}
