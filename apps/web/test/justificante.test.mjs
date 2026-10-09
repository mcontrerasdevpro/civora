import test from "node:test";
import assert from "node:assert/strict";
import {
  TEXTO_SECRETO,
  cadenaPdf,
  datosJustificante,
  generarPdfJustificante,
  partirLineas,
} from "../lib/justificante.mjs";

const NULLIFIER = "0x5f3c1a2b4d6e8f0a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f2a4b6c8d0e2f4a";
const PROPUESTA = {
  titulo: "Carril bici en la avenida principal",
  fechaApertura: "2026-10-01T08:00:00.000Z",
  fechaCierre: "2026-10-31T22:00:00.000Z",
};

/** El PDF como texto latin1 (cada byte, un carácter). */
function comoTexto(bytes) {
  return String.fromCharCode(...bytes);
}

test("el justificante solo lleva título, periodo y textos fijos", () => {
  const datos = datosJustificante(
    // Aunque se le pasen, la opción, el recibo y la transacción se ignoran.
    { ...PROPUESTA, opcion: "a_favor", nullifier: NULLIFIER, txHash: "0xabc", hora: "17:38" },
    "Europe/Madrid"
  );
  assert.deepEqual(Object.keys(datos).sort(), ["aviso", "garantia", "nadie", "periodo", "propuesta", "secreto", "titulo"]);
  assert.equal(datos.propuesta, PROPUESTA.titulo);
  assert.equal(datos.periodo, "Del 1 de octubre de 2026 al 31 de octubre de 2026");
  assert.equal(datos.secreto, TEXTO_SECRETO);
  const todo = JSON.stringify(datos);
  for (const prohibido of ["a_favor", "A favor", "En contra", "Abstención", NULLIFIER, "0xabc", "17:38"]) {
    assert.ok(!todo.includes(prohibido), `no debe contener ${prohibido}`);
  }
});

test("el periodo no incluye horas, solo días", () => {
  const datos = datosJustificante(PROPUESTA, "Europe/Madrid");
  assert.doesNotMatch(datos.periodo, /\d{1,2}:\d{2}/);
});

test("cadenas PDF: escapa paréntesis y barras, y codifica las tildes en WinAnsi", () => {
  assert.equal(cadenaPdf("a (b) c\\d"), "(a \\(b\\) c\\\\d)");
  assert.equal(cadenaPdf("Participación"), "(Participaci\\363n)");
  assert.equal(cadenaPdf("¿Sí?"), "(\\277S\\355?)");
  assert.equal(cadenaPdf("guion — largo"), "(guion \\227 largo)");
  assert.equal(cadenaPdf("emoji 🚲"), "(emoji ?)");
});

test("partir líneas por palabras", () => {
  assert.deepEqual(partirLineas("uno dos tres cuatro", 8), ["uno dos", "tres", "cuatro"]);
  assert.deepEqual(partirLineas("  ", 10), []);
});

test("PDF bien formado: cabecera, tabla xref coherente y fin de archivo", () => {
  const pdf = comoTexto(generarPdfJustificante(datosJustificante(PROPUESTA, "Europe/Madrid")));
  assert.ok(pdf.startsWith("%PDF-1.4\n"));
  assert.ok(pdf.endsWith("%%EOF\n"));

  const inicioXref = Number(pdf.match(/startxref\n(\d+)\n%%EOF\n$/)[1]);
  assert.ok(pdf.slice(inicioXref).startsWith("xref\n0 8\n"));
  const entradas = pdf.slice(inicioXref).split("\n").slice(3, 10);
  entradas.forEach((entrada, i) => {
    const desplazamiento = Number(entrada.slice(0, 10));
    assert.ok(pdf.slice(desplazamiento).startsWith(`${i + 1} 0 obj\n`), `objeto ${i + 1} en su desplazamiento`);
  });

  const longitud = Number(pdf.match(/<< \/Length (\d+) >>\nstream\n/)[1]);
  const inicioFlujo = pdf.indexOf("stream\n") + "stream\n".length;
  assert.equal(pdf.slice(inicioFlujo + longitud, inicioFlujo + longitud + "endstream".length), "endstream");
});

test("PDF accesible y sin datos que enlacen con el voto", () => {
  const pdf = comoTexto(generarPdfJustificante(datosJustificante(PROPUESTA, "Europe/Madrid")));
  assert.match(pdf, /\/Lang \(es-ES\)/);
  assert.match(pdf, /\/DisplayDocTitle true/);
  assert.match(pdf, /\/Title <FEFF/);
  // Texto visible: las cadenas de los operadores Tj, unidas por espacios.
  const texto = [...pdf.matchAll(/\((.*?)\) Tj/g)].map((m) => m[1]).join(" ");
  assert.ok(texto.includes("Su voto ha quedado registrado de forma secreta."));
  assert.ok(texto.includes("Carril bici en la avenida principal"));
  // Ni fecha de creación ni de modificación en los metadatos.
  assert.doesNotMatch(pdf, /CreationDate|ModDate/);
  for (const prohibido of ["a_favor", "A favor", "En contra", "Abstenci", NULLIFIER.slice(2, 20)]) {
    assert.ok(!pdf.includes(prohibido), `no debe contener ${prohibido}`);
  }
});

test("letra grande: ningún texto del PDF por debajo de 13 puntos", () => {
  const pdf = comoTexto(generarPdfJustificante(datosJustificante(PROPUESTA, "Europe/Madrid")));
  const tamanos = [...pdf.matchAll(/\/F[12] (\d+) Tf/g)].map((m) => Number(m[1]));
  assert.ok(tamanos.length > 0);
  assert.ok(Math.min(...tamanos) >= 13);
});
