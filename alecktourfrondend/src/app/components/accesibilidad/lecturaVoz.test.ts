import { afterEach, describe, expect, it } from "vitest";
import { describirElemento, nombreAccesible, textoPrincipal, trocear } from "./lecturaVoz";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lectura en voz alta", () => {
  it("divide el texto por oraciones y descarta trozos sin letras", () => {
    expect(trocear("Hola. ¿Cómo estás? Bien!\n—")).toEqual(["Hola.", "¿Cómo estás?", "Bien!"]);
  });

  it("toma el contenido principal sin navegación, pie ni campos", () => {
    document.body.innerHTML = `<nav>Menú</nav><main id="contenido-principal"><h1>Mis reservas</h1><input value="secreto"/><p aria-hidden="true">x</p></main><footer>Pie</footer>`;
    const texto = textoPrincipal();
    expect(texto).toContain("Mis reservas");
    expect(texto).not.toMatch(/Menú|Pie|secreto/);
  });

  it("describe botones, campos y casillas como un lector de pantalla", () => {
    document.body.innerHTML = `
      <button aria-label="Cerrar">X</button>
      <label for="c">Correo</label><input id="c" required />
      <input type="checkbox" id="k" checked aria-label="Acepto" />
      <h2>Pagos</h2>
      <button aria-expanded="false">Más</button>`;
    expect(describirElemento(document.querySelector("button")!, "es")).toBe("Cerrar, botón");
    expect(describirElemento(document.getElementById("c")!, "es")).toBe("Correo, campo de texto, obligatorio, vacío");
    expect(describirElemento(document.getElementById("k")!, "en")).toBe("Acepto, checkbox, checked");
    expect(describirElemento(document.querySelector("h2")!, "es")).toBe("Pagos, título 2");
    expect(describirElemento(document.querySelectorAll("button")[1], "es")).toBe("Más, botón, cerrado");
  });

  it("usa aria-labelledby para el nombre", () => {
    document.body.innerHTML = `<span id="t">Total</span><div role="region" aria-labelledby="t">…</div>`;
    expect(nombreAccesible(document.querySelector("[role=region]")!)).toBe("Total");
  });
});
