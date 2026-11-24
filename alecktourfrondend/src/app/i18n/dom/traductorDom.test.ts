import { afterEach, describe, expect, it } from "vitest";
import dic from "./en.json";
import { TraductorDom, crearTraductor, type Diccionario } from "./traductorDom";

const traducir = crearTraductor(dic as unknown as Diccionario);
const esperar = () => new Promise((r) => setTimeout(r, 0));

describe("diccionario es→en", () => {
  it("traduce textos exactos ignorando espacios", () => {
    expect(traducir("Mis reservas")).toBe("My bookings");
    expect(traducir("  Mis   reservas ")).toBe("  My bookings ");
  });
  it("traduce plantillas con variables", () => {
    expect(traducir("Faltan 5 días")).toBe("5 days left");
    expect(traducir("Hola Ana, quiero pagar mi reserva #12.")).toBe("Hi Ana, I want to pay my booking #12.");
  });
  it("acepta el texto con dos puntos o asterisco al final", () => {
    expect(traducir("Mis reservas:")).toBe("My bookings:");
  });
  it("deja intacto lo que no conoce", () => {
    expect(traducir("Cartagena")).toBeNull();
    expect(traducir("123")).toBeNull();
  });
  it("traduce mensajes del servidor", () => {
    expect(traducir("Credenciales inválidas")).toBe("Invalid credentials");
  });
});

describe("TraductorDom", () => {
  let t: TraductorDom | null = null;
  afterEach(() => {
    t?.detener();
    document.body.innerHTML = "";
  });

  it("traduce texto, atributos y nodos nuevos, y restaura al volver a español", async () => {
    document.body.innerHTML = `
      <h1>Mis reservas</h1>
      <input placeholder="Buscar reserva" />
      <p translate="no">Mis reservas</p>
      <textarea>Mis reservas</textarea>`;
    t = new TraductorDom(traducir);
    t.iniciar();
    expect(document.querySelector("h1")!.textContent).toBe("My bookings");
    expect(document.querySelector("input")!.getAttribute("placeholder")).toBe("Search booking");
    expect(document.querySelector("p")!.textContent).toBe("Mis reservas");
    expect(document.querySelector("textarea")!.value).toBe("Mis reservas");

    const b = document.createElement("button");
    b.setAttribute("aria-label", "Cerrar aviso");
    b.textContent = "Pagar";
    document.body.append(b);
    await esperar();
    expect(b.textContent).toBe("Pay");
    expect(b.getAttribute("aria-label")).toBe("Close notice");

    // React cambia el texto: se vuelve a traducir
    document.querySelector("h1")!.firstChild!.nodeValue = "Pago aprobado";
    await esperar();
    expect(document.querySelector("h1")!.textContent).toBe("Payment approved");

    t.detener();
    t = null;
    expect(document.querySelector("h1")!.textContent).toBe("Pago aprobado");
    expect(b.textContent).toBe("Pagar");
    expect(document.querySelector("input")!.getAttribute("placeholder")).toBe("Buscar reserva");
  });
});

describe("casos difíciles", () => {
  it("no traduce palabras sueltas dentro de frases con plantillas cortas", () => {
    expect(traducir("Viajamos con los niños y nos sentimos muy cómodos.")).toBeNull();
    expect(traducir("El plazo se cuenta en días hábiles desde el día siguiente.")).toBeNull();
  });
  it("traduce plurales pegados a la palabra", () => {
    expect(traducir("3 usuarios registrados")).toBe("3 users registered");
    expect(traducir("1 usuario registrado")).toBe("1 user registered");
  });
  it("traduce fechas en español", () => {
    expect(traducir("21 de dic")).toBe("Dec 21");
    expect(traducir("lun, 21 de dic")).toBe("Mon, Dec 21");
    expect(traducir("24 de dic de 2026")).toBe("Dec 24, 2026");
    expect(traducir("sáb, 12 dic 2026")).toBe("Sat, Dec 12, 2026");
    expect(traducir("noviembre de 2026")).toBe("November 2026");
    expect(traducir("– 7 de dic")).toBe("– Dec 7");
  });
  it("traduce el contenido de una plantilla (anidado)", () => {
    expect(traducir("Completa el pago de Estadía en Casa Murallas")).toBe("Complete the payment for Stay in Casa Murallas");
    expect(traducir("Viajas con Alik Tours desde noviembre de 2026")).toBe("Traveling with Alik Tours since November 2026");
  });
});

describe("plantillas abiertas", () => {
  it("no se comen frases largas", () => {
    expect(traducir("Reserva #208 para 1 persona(s), del 2027-01-03 al 2027-01-06.")).toBeNull();
    expect(traducir("Certificado de la reserva para mi empresa")).toBeNull();
    expect(traducir("Hola, tengo una duda con esta reserva")).toBeNull();
  });
  it("sí traducen nombres y números", () => {
    expect(traducir("Reserva #208")).toBe("Booking #208");
    expect(traducir("12 reservas")).toBe("12 bookings");
    expect(traducir("Completa el pago de Estadía en Casa Murallas Hotel Boutique")).toBe(
      "Complete the payment for Stay in Casa Murallas Hotel Boutique",
    );
  });
});
