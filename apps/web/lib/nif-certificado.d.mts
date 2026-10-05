export function nifDeCertificado(cert: {
  subject: { getField: (selector: { shortName?: string; type?: string }) => { value?: unknown } | null };
}): string | null;