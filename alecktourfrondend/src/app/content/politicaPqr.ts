// Política de atención de peticiones, quejas, reclamos, sugerencias y
// felicitaciones (PQRSF). Fuente única: la usa la página /pqr y la resume
// la sección 17 de los términos (content/terminos.ts).
//
// ESTADO: BORRADOR pendiente de revisión jurídica, igual que los términos.
// Los plazos coinciden con lo que hace el sistema (backend/app/services/
// pqr_service.py): si se cambia uno, se cambia el otro.

export const POLITICA_PQR_VERSION = "2026-11-24-borrador";
export const POLITICA_PQR_FECHA = "24 de noviembre de 2026";

export interface SeccionPolitica {
  id: string;
  titulo: string;
  parrafos: string[];
  lista?: string[];
}

export const PLAZOS_PQR = [
  { tipo: "Petición", que: "Pides una gestión, un cambio o un trámite.", dias: 15, norma: "Ley 1755 de 2015, art. 14" },
  { tipo: "Información o documentos", que: "Pides una copia, un certificado o un dato puntual.", dias: 10, norma: "Ley 1755 de 2015, art. 14 num. 1" },
  { tipo: "Consulta", que: "Pides un concepto u orientación.", dias: 30, norma: "Ley 1755 de 2015, art. 14 num. 2" },
  { tipo: "Queja", que: "Inconformidad con la atención o el trato recibido.", dias: 15, norma: "Ley 1755 de 2015, art. 14" },
  { tipo: "Reclamo", que: "Un servicio no se prestó como se ofreció.", dias: 15, norma: "Decreto 1074 de 2015 y Ley 1480 de 2011" },
  { tipo: "Sugerencia", que: "Una idea para mejorar.", dias: 15, norma: "Ley 1755 de 2015, art. 14" },
  { tipo: "Felicitación", que: "Reconocer una buena experiencia.", dias: 15, norma: "Política interna" },
];

export const POLITICA_PQR: SeccionPolitica[] = [
  {
    id: "objeto",
    titulo: "1. Objeto y alcance",
    parrafos: [
      "Esta política explica cómo Alik Tours recibe, tramita y responde las peticiones, quejas, reclamos, sugerencias y felicitaciones (PQR) de sus clientes, y qué puedes esperar en cada paso.",
      "Aplica a todas las solicitudes relacionadas con nuestros servicios: reservas de hoteles, paquetes y vuelos, pagos, cancelaciones, atención y uso de la plataforma. Presentar una PQR es gratis y no necesitas abogado.",
    ],
  },
  {
    id: "definiciones",
    titulo: "2. Qué es cada tipo de solicitud",
    parrafos: [],
    lista: [
      "Petición: solicitud respetuosa para que hagamos algo, por ejemplo un cambio de fecha o una gestión ante un hotel.",
      "Solicitud de información o documentos: pides copia de un documento, un certificado o un dato de tu reserva.",
      "Consulta: nos pides un concepto u orientación sobre un tema de nuestros servicios.",
      "Queja: manifiestas tu inconformidad con la conducta o la atención de alguien de nuestro equipo.",
      "Reclamo: un servicio no se prestó, se prestó de forma distinta a la ofrecida o se cobró algo indebido, y pides que se corrija, se repare o se reembolse.",
      "Sugerencia y felicitación: una propuesta para mejorar o el reconocimiento de una buena experiencia.",
      "Radicado: número único (por ejemplo PQR-2026-000045) con el que identificas tu solicitud.",
      "Días hábiles: de lunes a viernes, sin contar los festivos nacionales de Colombia.",
    ],
  },
  {
    id: "canales",
    titulo: "3. Cómo presentar una solicitud",
    parrafos: [
      "El canal principal es tu cuenta: en tu perfil, sección «Solicitudes PQR», eliges el tipo, cuentas qué pasó y, si es un reclamo, qué esperas que hagamos. Puedes asociarla a una de tus reservas.",
      "Si nos contactas por teléfono, WhatsApp, correo o en persona, un asesor la radica por ti y queda en tu perfil con el canal por el que llegó, para que puedas seguirla igual.",
      "Al radicar te damos el número de radicado, la fecha de recibo y la fecha límite de respuesta, en pantalla y por correo electrónico.",
    ],
  },
  {
    id: "requisitos",
    titulo: "4. Qué debe tener tu solicitud",
    parrafos: [
      "Tu identificación (la tomamos de tu cuenta), el asunto, la descripción de los hechos y, en los reclamos, lo que pides concretamente. Entre más detalles incluyas (fechas, nombres, número de reserva), más rápido podemos resolver.",
      "Para tramitarla necesitamos tu autorización para el tratamiento de los datos que nos das, conforme a nuestra Política de Privacidad.",
      "No rechazamos una solicitud porque esté incompleta o mal fundamentada: si falta algo, te lo pedimos (ver punto 6).",
    ],
  },
  {
    id: "plazos",
    titulo: "5. Plazos de respuesta",
    parrafos: [
      "El plazo se cuenta en días hábiles desde el día hábil siguiente a la radicación. La regla general es de 15 días hábiles; las solicitudes de información o documentos se responden en 10 y las consultas en 30 (Ley 1755 de 2015, art. 14).",
      "Los reclamos sobre servicios turísticos se responden en máximo 15 días hábiles, como lo exige la reclamación directa ante prestadores de servicios turísticos (Decreto 1074 de 2015).",
      "En tu perfil siempre ves cuántos días hábiles faltan y la fecha límite.",
    ],
  },
  {
    id: "incompletas",
    titulo: "6. Si necesitamos más información",
    parrafos: [
      "Si a tu solicitud le falta un dato o un documento indispensable para resolverla, te lo pediremos una sola vez y dentro de los 10 días hábiles siguientes a la radicación (Ley 1755 de 2015, art. 17).",
      "Mientras esperamos tu respuesta, el plazo queda en pausa. Cuando nos envías lo que falta, el plazo vuelve a empezar completo desde el día siguiente.",
      "Si pasa un mes sin que respondas, podremos archivar la solicitud por desistimiento tácito y te lo informaremos. Siempre puedes volver a radicarla.",
    ],
  },
  {
    id: "prorroga",
    titulo: "7. Ampliación del plazo",
    parrafos: [
      "Si por una razón justificada no podemos responder a tiempo (por ejemplo, esperamos la respuesta formal de un hotel o una aerolínea), te avisaremos antes de que venza el plazo, con el motivo y la nueva fecha.",
      "La ampliación se hace una sola vez y el nuevo plazo no puede superar el doble del inicial (Ley 1755 de 2015, art. 14, parágrafo).",
    ],
  },
  {
    id: "respuesta",
    titulo: "8. Cómo te respondemos",
    parrafos: [
      "La respuesta es por escrito, de fondo, clara y completa: resuelve lo que pediste y no se limita a acusar recibo. La ves en tu perfil y te llega al correo registrado.",
      "En los reclamos te decimos expresamente si accedemos, si accedemos en parte o si no accedemos a lo que pediste. Si no accedemos a todo, explicamos los motivos de hecho y de derecho.",
      "Mientras tu solicitud está abierta puedes escribirnos en ella y ver todo su historial: radicación, mensajes, ampliaciones y respuesta.",
    ],
  },
  {
    id: "insatisfaccion",
    titulo: "9. Si no estás de acuerdo con la respuesta",
    parrafos: [
      "Puedes escribirnos de nuevo con información adicional o acudir a la Superintendencia de Industria y Comercio (www.sic.gov.co), autoridad de protección al consumidor, presentando tu número de radicado como constancia de la reclamación directa.",
      "Nada de esta política limita los derechos que la ley te reconoce como consumidor (Ley 1480 de 2011).",
    ],
  },
  {
    id: "desistimiento",
    titulo: "10. Desistir de una solicitud",
    parrafos: [
      "Puedes desistir en cualquier momento antes de que respondamos, desde tu perfil con la opción «Ya no la necesito». La solicitud queda cerrada y su historial se conserva.",
    ],
  },
  {
    id: "calificacion",
    titulo: "11. Calificación del servicio",
    parrafos: [
      "Después de la respuesta puedes calificar la atención de 1 a 5 y dejar un comentario. La calificación cierra la solicitud y la usamos solo para mejorar; no cambia la respuesta ni tus derechos.",
    ],
  },
  {
    id: "uso",
    titulo: "12. Términos de uso del canal de PQR",
    parrafos: ["Al usar este canal te comprometes a:"],
    lista: [
      "Presentar solicitudes respetuosas. Las peticiones irrespetuosas pueden rechazarse; si no entendemos el objeto, te pediremos que lo aclares (Ley 1755 de 2015, art. 19).",
      "Dar información veraz y actuar en tu propio nombre o, si representas a alguien, decirlo.",
      "No compartir datos sensibles que no sean necesarios, ni números completos de tarjetas, claves o códigos de verificación: nunca te los pediremos.",
      "No usar el canal para publicidad, contenido ofensivo, amenazas o para suplantar a otra persona.",
      "Si una solicitud repite otra ya resuelta sin hechos nuevos, podremos remitirte a la respuesta anterior.",
      "Mantener actualizado el correo de tu cuenta, porque es el medio por el que te notificamos.",
    ],
  },
  {
    id: "compromisos",
    titulo: "13. Nuestros compromisos",
    parrafos: [],
    lista: [
      "Cada solicitud tiene un responsable del equipo y se gestiona por orden de vencimiento.",
      "Solo el personal autorizado (administradores y asesores) accede a tu solicitud. Las notas internas del equipo sirven para coordinar la atención y no reemplazan la respuesta.",
      "Presentar una queja o un reclamo nunca afecta la atención de tus reservas.",
      "Medimos cuántas solicitudes respondemos a tiempo y la satisfacción de nuestros clientes para mejorar.",
    ],
  },
  {
    id: "datos",
    titulo: "14. Tratamiento de datos personales",
    parrafos: [
      "Usamos los datos de tu solicitud solo para tramitarla, responderla y como soporte de la atención, conforme a la Ley 1581 de 2012 y a nuestra Política de Privacidad. Conservamos el historial de cada solicitud mientras sea necesario para atender reclamaciones posteriores o requerimientos de autoridad.",
    ],
  },
  {
    id: "normas",
    titulo: "15. Normas de referencia",
    parrafos: [],
    lista: [
      "Constitución Política de Colombia, artículo 23 (derecho de petición).",
      "Ley 1755 de 2015, que regula el derecho fundamental de petición, también ante organizaciones privadas.",
      "Ley 1480 de 2011, Estatuto del Consumidor.",
      "Decreto 1074 de 2015, que compila las reglas de la reclamación directa ante prestadores de servicios turísticos.",
      "Ley 1581 de 2012, protección de datos personales.",
    ],
  },
];
