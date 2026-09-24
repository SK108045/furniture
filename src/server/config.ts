// Only import this module from server code. Secrets are read at runtime in production.
export function env(name: string): string {
  return process.env[name] || (import.meta.env?.[name] as string) || '';
}
export function appOrigin() { return env('APP_ORIGIN') || 'http://localhost:4321'; }
