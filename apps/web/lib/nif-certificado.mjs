export function nifDeCertificado(cert) {
  const field = cert.subject.getField({ shortName: "serialNumber" }) ?? cert.subject.getField({ type: "2.5.4.5" });
  return field?.value ? String(field.value) : null;
}