/** URL pública da aplicação, usada em links de email. */
export function appBaseUrl(): string {
  const raw = process.env.BETTER_AUTH_URL || process.env.APP_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}
