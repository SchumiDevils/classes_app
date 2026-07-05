// Extrage un mesaj lizibil din orice eroare. Supabase (postgrest/auth) arunca
// obiecte simple { message, details, hint, code } care NU sunt instante Error,
// deci `e instanceof Error` esueaza si pierdeam mesajul real.
export function mesajEroare(e: unknown, fallback = 'A aparut o eroare.'): string {
  if (!e) return fallback;
  if (typeof e === 'string') return e;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>;
    const parti = [o.message, o.details, o.hint]
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (parti.length > 0) return parti.join(' · ');
    if (typeof o.error_description === 'string') return o.error_description;
  }
  return fallback;
}
