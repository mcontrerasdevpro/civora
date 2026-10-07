export function adminSecretMatches(provided: string | null, expected: string | undefined): boolean;
export function checkAdminRateLimit(
  key: string,
  now?: number
): { allowed: boolean; retryAfterSeconds: number };