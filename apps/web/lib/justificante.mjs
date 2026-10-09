/**
 * Justificante de participación: lógica pura (sin navegador) para probarla
 * con `node --test`. El navegador la usa para generar el PDF sin enviar
 * nada al servidor.
 *
 * Regla: el justificante NUNCA debe permitir a un tercero saber qué opción
 * se votó (compra de votos y coacción). Por eso:
 *  - Solo recibe el título y el periodo de la propuesta: no hay forma de
 *    pasarle la opción, el nullifier ni la transacción.
 *  - No lleva la hora ni el día del voto: cruzados con la hora de las
 *    transacciones públicas, en una votación con poca participación,
 *    delatarían el voto. Lleva el periodo de la votación.
 *  - El PDF no lleva fecha de creación en sus metadatos, por el mismo motivo.
 */

export const TEXTO_SECRETO = "Su voto ha quedado registrado de forma secreta.";

const TEXTO_GARANTIA =
  "Este justificante solo acredita que usted ha participado. No indica qué opción eligió ni contiene ningún dato que permita averiguarlo.";
const TEXTO_NADIE = "Nadie puede exigirle que muestre su voto: ni este justificante ni ningún otro dato lo revela.";
const TEXTO_POC = "Civora: demostración técnica, sin validez para elecciones oficiales.";

/**
 * @param {string} iso
 * @param {string | undefined} zonaHoraria
 */
function fechaLarga(iso, zonaHoraria) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(zonaHoraria ? { timeZone: zonaHoraria } : {}),
  });
}

/**
 * Contenido del justificante. Solo admite los campos públicos de la
 * propuesta; cualquier otro se ignora.
 *
 * @param {{ titulo: string; fechaApertura: string; fechaCierre: string }} propuesta
 * @param {string} [zonaHoraria] por defecto, la del navegador
 */
export function datosJustificante(propuesta, zonaHoraria) {
  return {
    titulo: "Justificante de participación",
    propuesta: propuesta.titulo,
    periodo: `Del ${fechaLarga(propuesta.fechaApertura, zonaHoraria)} al ${fechaLarga(propuesta.fechaCierre, zonaHoraria)}`,
    secreto: TEXTO_SECRETO,
    garantia: TEXTO_GARANTIA,
    nadie: TEXTO_NADIE,
    aviso: TEXTO_POC,
  };
}

/* ---------- PDF mínimo (PDF 1.4, Helvetica, WinAnsiEncoding) ---------- */

// Caracteres de Windows-1252 fuera de Latin-1 que pueden aparecer en un título.
const WIN_ANSI_EXTRA = new Map([
  ["€", 0x80], ["‚", 0x82], ["„", 0x84], ["…", 0x85], ["‘", 0x91], ["’", 0x92],
  ["“", 0x93], ["”", 0x94], ["•", 0x95], ["–", 0x96], ["—", 0x97], ["™", 0x99],
]);

/**
 * Cadena literal de PDF en WinAnsi: escapa \ ( ) y codifica en octal lo que
 * no es ASCII imprimible. Lo que no existe en WinAnsi se sustituye por «?».
 *
 * @param {string} texto
 */
export function cadenaPdf(texto) {
  let salida = "";
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0) ?? 63;
    let byte;
    if (codigo >= 0x20 && codigo < 0x7f) byte = codigo;
    else if (codigo >= 0xa0 && codigo <= 0xff) byte = codigo;
    else byte = WIN_ANSI_EXTRA.get(caracter) ?? 0x3f;
    if (byte === 0x5c || byte === 0x28 || byte === 0x29) salida += `\\${String.fromCharCode(byte)}`;
    else if (byte >= 0x20 && byte < 0x7f) salida += String.fromCharCode(byte);
    else salida += `\\${byte.toString(8).padStart(3, "0")}`;
  }
  return `(${salida})`;
}

/** Texto en UTF-16BE hexadecimal, para metadatos con tildes (Title). */
function cadenaUtf16(texto) {
  let hex = "FEFF";
  for (let i = 0; i < texto.length; i++) hex += texto.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  return `<${hex}>`;
}

/**
 * Corta un texto en líneas de como mucho `maximo` caracteres, por palabras.
 *
 * @param {string} texto
 * @param {number} maximo
 */
export function partirLineas(texto, maximo) {
  const lineas = [];
  let actual = "";
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    if (!actual) actual = palabra;
    else if (actual.length + 1 + palabra.length <= maximo) actual += ` ${palabra}`;
    else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

const ANCHO_PAGINA = 595; // A4 en puntos
const ALTO_PAGINA = 842;
const MARGEN = 64;

/**
 * PDF del justificante: texto real (seleccionable y legible por lectores de
 * pantalla), letra grande, negro sobre blanco, idioma y título declarados.
 *
 * @param {ReturnType<typeof datosJustificante>} datos
 * @returns {Uint8Array}
 */
export function generarPdfJustificante(datos) {
  const util = ANCHO_PAGINA - 2 * MARGEN;
  /** @type {{ texto: string; negrita?: boolean; tamano: number; espacioAntes?: number }[]} */
  const bloques = [
    { texto: datos.titulo, negrita: true, tamano: 26 },
    { texto: datos.aviso, tamano: 13, espacioAntes: 10 },
    { texto: "Propuesta", negrita: true, tamano: 16, espacioAntes: 30 },
    { texto: datos.propuesta, tamano: 18, espacioAntes: 4 },
    { texto: "Periodo de votación", negrita: true, tamano: 16, espacioAntes: 22 },
    { texto: datos.periodo, tamano: 18, espacioAntes: 4 },
    { texto: datos.secreto, negrita: true, tamano: 20, espacioAntes: 34 },
    { texto: datos.garantia, tamano: 15, espacioAntes: 16 },
    { texto: datos.nadie, tamano: 15, espacioAntes: 12 },
  ];

  let y = ALTO_PAGINA - MARGEN;
  let contenido = "0 g\n";
  for (const bloque of bloques) {
    // Anchura media aproximada de Helvetica: 0,52 em (0,56 en negrita).
    const maximo = Math.floor(util / (bloque.tamano * (bloque.negrita ? 0.56 : 0.52)));
    y -= bloque.espacioAntes ?? 0;
    for (const linea of partirLineas(bloque.texto, maximo)) {
      y -= bloque.tamano * 1.3;
      contenido += `BT /${bloque.negrita ? "F2" : "F1"} ${bloque.tamano} Tf ${MARGEN} ${y.toFixed(1)} Td ${cadenaPdf(linea)} Tj ET\n`;
    }
  }

  const objetos = [
    `<< /Type /Catalog /Pages 2 0 R /Lang (es-ES) /ViewerPreferences << /DisplayDocTitle true >> >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO_PAGINA} ${ALTO_PAGINA}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${contenido.length} >>\nstream\n${contenido}endstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`,
    // Sin /CreationDate ni /ModDate: la fecha de creación delataría el momento del voto.
    `<< /Title ${cadenaUtf16(datos.titulo)} /Producer (Civora) >>`,
  ];

  let pdf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const desplazamientos = [];
  objetos.forEach((objeto, i) => {
    desplazamientos.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
  });
  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const d of desplazamientos) pdf += `${String(d).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;

  // Todos los caracteres son de un byte (< 256): la posición es el desplazamiento.
  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i);
  return bytes;
}
