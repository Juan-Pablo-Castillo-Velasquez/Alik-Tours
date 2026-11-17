// Decoración de temporada: qué trae cada tema, dónde se muestra y cómo la
// pausa el visitante.
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tema } from "../../services/tema.service";
import AdornoTarjeta from "./AdornoTarjeta";
import AmbienteTemporada from "./AmbienteTemporada";
import GuirnaldaLuces from "./GuirnaldaLuces";
import { BotonAnimacionTemporada } from "./NieveFooter";
import { decoracionDeTema, rutaPermiteAmbiente } from "./temporadas";

const tema = (extra: Partial<Tema>): Tema =>
  ({
    id_tema: 2,
    nombre: "Navidad",
    clave: "navidad",
    color_primario_claro: "#8b1e2d",
    color_primario_oscuro: "#d9606f",
    color_secundario_claro: "#b8912e",
    color_secundario_oscuro: "#e8c77a",
    activo: true,
    es_predeterminado: false,
    icono: "tree-pine",
    imagen_url: null,
    ...extra,
  }) as Tema;

let temaActivo: Tema | null = null;
vi.mock("../../context/TemaContext", () => ({
  useTema: () => ({ temaActivo, refrescarTemaActivo: async () => {} }),
}));

const enRuta = (ruta: string, ui: React.ReactNode) => render(<MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>);

beforeEach(() => {
  temaActivo = tema({});
  localStorage.clear();
});

describe("decoracionDeTema", () => {
  it("Navidad trae nieve, guirnalda y nieve acumulada", () => {
    expect(decoracionDeTema(tema({}))).toEqual({
      efecto: "nieve",
      guirnalda: true,
      nieveAcumulada: true,
      etiqueta: "Especial de Navidad",
    });
  });

  it("el tema de marca y la ausencia de tema no decoran nada", () => {
    expect(decoracionDeTema(null).efecto).toBeNull();
    expect(decoracionDeTema(tema({ es_predeterminado: true })).efecto).toBeNull();
  });

  it("un tema creado por el admin se decora según su ícono", () => {
    expect(decoracionDeTema(tema({ clave: "san-valentin", icono: "heart" })).efecto).toBe("corazones");
    expect(decoracionDeTema(tema({ clave: "otro", icono: null })).efecto).toBeNull();
  });

  it("no hay ambiente en el panel admin ni en los pasos de pago", () => {
    expect(rutaPermiteAmbiente("/")).toBe(true);
    expect(rutaPermiteAmbiente("/packages")).toBe(true);
    expect(rutaPermiteAmbiente("/admin")).toBe(false);
    expect(rutaPermiteAmbiente("/checkout/5")).toBe(false);
  });
});

describe("AmbienteTemporada", () => {
  it("muestra la nevada en el inicio con el tema de Navidad", () => {
    enRuta("/", <AmbienteTemporada />);
    const capa = screen.getByTestId("ambiente-temporada");
    expect(capa).toHaveAttribute("data-efecto", "nieve");
    expect(capa).toHaveAttribute("aria-hidden", "true");
    expect(capa.querySelectorAll(".temporada-particula").length).toBeGreaterThan(10);
  });

  it("no se monta en el panel admin", () => {
    enRuta("/admin", <AmbienteTemporada />);
    expect(screen.queryByTestId("ambiente-temporada")).toBeNull();
  });

  it("no se monta sin tema de temporada", () => {
    temaActivo = null;
    enRuta("/", <AmbienteTemporada />);
    expect(screen.queryByTestId("ambiente-temporada")).toBeNull();
  });

  it("el visitante puede pausarla y reanudarla, y la elección se recuerda", () => {
    enRuta(
      "/",
      <>
        <AmbienteTemporada />
        <BotonAnimacionTemporada />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pausar animación de temporada" }));
    expect(screen.queryByTestId("ambiente-temporada")).toBeNull();
    expect(localStorage.getItem("alik:animacion-temporada")).toBe("off");
    expect(document.documentElement).toHaveAttribute("data-animacion-temporada", "off");

    fireEvent.click(screen.getByRole("button", { name: "Reanudar animación de temporada" }));
    expect(screen.getByTestId("ambiente-temporada")).toBeInTheDocument();
  });
});

describe("Adornos", () => {
  it("la tarjeta lleva nieve e insignia en Navidad", () => {
    render(<AdornoTarjeta insignia />);
    expect(screen.getByTestId("adorno-nieve")).toBeInTheDocument();
    expect(screen.getByTestId("insignia-temporada")).toHaveTextContent("Especial de Navidad");
  });

  it("en Amor y Amistad hay insignia pero no nieve", () => {
    temaActivo = tema({ clave: "amor-amistad", nombre: "Amor y Amistad", icono: "heart" });
    render(<AdornoTarjeta insignia />);
    expect(screen.queryByTestId("adorno-nieve")).toBeNull();
    expect(screen.getByTestId("insignia-temporada")).toHaveTextContent("Especial de Amor y Amistad");
  });

  it("sin temporada, ni la tarjeta ni el navbar llevan adornos", () => {
    temaActivo = null;
    const { container } = render(
      <>
        <AdornoTarjeta insignia />
        <GuirnaldaLuces />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("la guirnalda de luces aparece en Navidad", () => {
    render(<GuirnaldaLuces />);
    expect(screen.getByTestId("guirnalda-temporada")).toBeInTheDocument();
  });
});
