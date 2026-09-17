export type MetodoIdentificacion = "dnie" | "certificado" | "manual";

export function MetodoSelector({
  onElegir,
}: {
  onElegir: (metodo: MetodoIdentificacion) => void;
}) {
  return (
    <div className="panel metodo-selector">
      <p className="form-hint" style={{ marginTop: 0, marginBottom: 20 }}>
        Elige cómo quieres acreditar que cumples los requisitos para votar.
      </p>

      <button type="button" className="metodo-card" onClick={() => onElegir("dnie")}>
        <span className="metodo-card-title">DNIe o pasaporte (NFC)</span>
        <span className="metodo-card-desc">
          Recomendado. Verificación real con ZKPassport: escaneas el chip de
          tu documento con el móvil y se genera una prueba criptográfica, sin
          enviar tus datos a este servidor.
        </span>
      </button>

      <button type="button" className="metodo-card" onClick={() => onElegir("certificado")}>
        <span className="metodo-card-title">Certificado digital</span>
        <span className="metodo-card-desc">
          Firma un código con tu certificado digital (FNMT, DNIe...) usando
          Autofirma. Prueba tu identidad de verdad, pero no tu edad (el
          certificado no la contiene), así que se acepta autodeclarada.
        </span>
      </button>

      <button type="button" className="metodo-card" onClick={() => onElegir("manual")}>
        <span className="metodo-card-title">Introducir mis datos</span>
        <span className="metodo-card-desc">
          Solo si no dispones de DNIe con NFC. Se valida el formato del DNI y
          tu edad declarada, pero no se contrasta con ningún registro
          oficial.
        </span>
      </button>
    </div>
  );
}
