import { BRAND } from "../config/brand";

// Fuente ÚNICA de los términos y condiciones: la usan la página /terms,
// el modal del registro (TerminosModal.tsx), la descarga en PDF y la
// evidencia de aceptación (TERMINOS_VERSION se guarda con el usuario al
// registrarse y con cada reserva). Al cambiar el texto, sube la versión.
//
// ESTADO: BORRADOR pendiente de revisión jurídica. Los datos marcados como
// "[Pendiente: ...]" debe suministrarlos la agencia; no se inventan.
export const TERMINOS_VERSION = "2026-10-30-borrador";
export const TERMINOS_FECHA = "30 de octubre de 2026";
export const TERMINOS_ES_BORRADOR = true;

export interface SeccionTerminos {
  titulo: string;
  parrafos: string[];
}

const PENDIENTE = (dato: string) => `[Pendiente: ${dato}]`;

export const TERMINOS_SECCIONES: SeccionTerminos[] = [
  {
    titulo: "1. Identificación del prestador",
    parrafos: [
      `${BRAND.name} es una agencia de viajes inscrita en el Registro Nacional de Turismo (RNT) con el número ${BRAND.rnt}.`,
      `Razón social: ${PENDIENTE("razón social")}. NIT: ${PENDIENTE("NIT")}. Domicilio: ${PENDIENTE("dirección")}. Correo de atención: ${PENDIENTE("correo electrónico")}. Teléfono: ${BRAND.telefono}.`,
    ],
  },
  {
    titulo: "2. Objeto y servicios",
    parrafos: [
      `A través de este sitio ${BRAND.name} informa y comercializa servicios turísticos nacionales e internacionales: alojamiento en hoteles, paquetes turísticos y servicios complementarios. Cada hotel o paquete describe en su ficha lo que incluye y lo que no incluye; solo se prestan los servicios allí indicados.`,
      `${BRAND.name} actúa como intermediaria entre el viajero y los prestadores finales (hoteles, transportadores y operadores). La agencia responde frente al viajero en los términos de la Ley 300 de 1996, el Decreto 1074 de 2015 y la Ley 1480 de 2011, y cada prestador responde por la ejecución de su propio servicio.`,
    ],
  },
  {
    titulo: "3. Aceptación de estos términos",
    parrafos: [
      "Estos términos se aceptan de forma expresa, marcando la casilla correspondiente al crear la cuenta y al confirmar una reserva. La casilla nunca está marcada por defecto, y navegar por el sitio o guardar silencio no se entiende como aceptación.",
      "Guardamos la versión de los términos aceptada y la fecha y hora de la aceptación como evidencia, conforme a la Ley 527 de 1999 sobre mensajes de datos.",
    ],
  },
  {
    titulo: "4. Cuenta de usuario",
    parrafos: [
      "Para reservar necesitas una cuenta con datos reales y vigentes, incluido un número de celular para contactarte por tu reserva. Eres responsable de la confidencialidad de tu contraseña.",
    ],
  },
  {
    titulo: "5. Reservas y confirmación",
    parrafos: [
      "Una reserva queda en estado «pendiente» hasta que Alik Tours verifica el pago (total o anticipo). Solo una reserva «confirmada» garantiza los servicios. La confirmación se informa en tu cuenta y por correo electrónico.",
      "Antes de pagar verás el resumen de la reserva: fechas, número de personas, servicios incluidos y precio total.",
    ],
  },
  {
    titulo: "6. Precios e impuestos",
    parrafos: [
      "Los precios se expresan en pesos colombianos (COP). El precio que se cobra es el total que ves antes de pagar; si algún impuesto, tasa o cargo no está incluido en ese valor, se informa de manera expresa antes del pago.",
      `${PENDIENTE("confirmar si las tarifas publicadas incluyen IVA y demás cargos")}`,
    ],
  },
  {
    titulo: "7. Medios de pago y aprobación",
    parrafos: [
      "Los medios de pago disponibles se muestran en el checkout. Un pago se considera aprobado solo cuando Alik Tours lo verifica; los pagos por transferencia (por ejemplo, Nequi) los revisa un asesor antes de confirmar la reserva.",
      "Puedes pagar el total o un anticipo del 50 %. El saldo queda visible en tu cuenta y debe pagarse antes del viaje en la fecha que te indique tu asesor.",
      "Por cada pago aprobado recibes un comprobante de pago. Ese comprobante no es una factura electrónica de venta; la factura, cuando corresponda, se expide conforme a la normativa de la DIAN.",
    ],
  },
  {
    titulo: "8. Cancelaciones",
    parrafos: [
      "Puedes solicitar la cancelación desde tu cuenta indicando el motivo. Un asesor revisa la solicitud y te informa por escrito el resultado y las condiciones aplicables según el prestador y la antelación.",
      `${PENDIENTE("política de cancelación de la agencia: plazos, penalidades y cargos no reembolsables")}`,
    ],
  },
  {
    titulo: "9. Modificaciones",
    parrafos: [
      "Los cambios de fechas, personas o servicios están sujetos a la disponibilidad y a las condiciones de cada prestador, y pueden variar el precio. Ningún cambio se aplica sin tu aceptación.",
      "Si por fuerza mayor o caso fortuito un prestador modifica un servicio, te informaremos de inmediato y podrás elegir un servicio de calidad equivalente o el reembolso de lo no prestado.",
    ],
  },
  {
    titulo: "10. Reembolsos",
    parrafos: [
      "Cuando proceda un reembolso, se hace al mismo medio de pago utilizado o al que acordemos contigo, dentro de los plazos de la Ley 1480 de 2011 y sus modificaciones (Ley 2439 de 2024).",
    ],
  },
  {
    titulo: "11. Derecho de retracto",
    parrafos: [
      "En las compras realizadas a distancia, puedes ejercer el derecho de retracto dentro de los cinco (5) días hábiles siguientes a la celebración del contrato, siempre que el servicio no haya comenzado a ejecutarse y salvo las excepciones previstas en el artículo 47 de la Ley 1480 de 2011. El dinero se devuelve dentro de los quince (15) días calendario siguientes al ejercicio del retracto.",
      "Para ejercerlo, escríbenos por los canales de atención indicando el número de tu reserva.",
    ],
  },
  {
    titulo: "12. Obligaciones del viajero",
    parrafos: [
      "Suministrar información veraz; portar documentos de identidad, pasaporte, visas, permisos de menores y certificados de salud exigidos por el destino; cumplir los horarios y reglamentos de los prestadores; y pagar el saldo en el plazo acordado.",
    ],
  },
  {
    titulo: "13. Obligaciones de Alik Tours",
    parrafos: [
      "Informar de forma veraz, suficiente y clara los servicios, precios y condiciones; entregar comprobantes de lo contratado; atender tus peticiones, quejas y reclamos; y gestionar ante los prestadores el cumplimiento de lo ofrecido.",
    ],
  },
  {
    titulo: "14. Condiciones de los prestadores",
    parrafos: [
      "Cada hotel, transportador u operador tiene condiciones propias (horarios de ingreso y salida, equipaje, políticas de menores o mascotas, etc.), que se informan en la ficha del servicio o antes de pagar. En el transporte aéreo regular aplican las normas de la Aerocivil y las condiciones de la aerolínea.",
    ],
  },
  {
    titulo: "15. Tratamiento de datos personales",
    parrafos: [
      "Tus datos se tratan conforme a la Ley 1581 de 2012 y sus decretos reglamentarios, únicamente para gestionar tu cuenta, tus reservas y la atención. Puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar la autorización, en los términos de nuestra Política de Privacidad.",
    ],
  },
  {
    titulo: "16. Canales de atención",
    parrafos: [
      `Teléfono: ${BRAND.telefono}. Mensajes desde tu cuenta (pestaña Mensajes). Instagram: ${BRAND.instagram}. Correo: ${PENDIENTE("correo electrónico de atención")}.`,
    ],
  },
  {
    titulo: "17. Peticiones, quejas y reclamos",
    parrafos: [
      "Puedes presentar peticiones, quejas o reclamos por cualquiera de los canales anteriores. Cada solicitud recibe un número de radicado y se responde dentro de los quince (15) días hábiles siguientes. Si no quedas satisfecho, puedes acudir a la Superintendencia de Industria y Comercio.",
    ],
  },
  {
    titulo: "18. Cambios a estos términos",
    parrafos: [
      "Podemos actualizar estos términos. La nueva versión se publica en esta página con su fecha y solo se aplica a las reservas hechas después de su publicación; las reservas existentes conservan la versión que aceptaste.",
    ],
  },
  {
    titulo: "19. Ley aplicable",
    parrafos: [
      "Estos términos se rigen por las leyes de la República de Colombia. Nada de lo aquí previsto limita los derechos que la ley reconoce al consumidor.",
    ],
  },
];
