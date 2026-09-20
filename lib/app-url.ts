const FALLBACK_ORIGIN = "http://localhost:3100";

/**
 * Канонический адрес приложения.
 *
 * Абсолютные ссылки и редиректы нельзя строить от `req.url`: за Caddy Next
 * видит собственный адрес процесса и отдаёт клиенту `https://localhost:3100/...`
 * в заголовке Location — человек после письма попадает в никуда.
 */
export function appOrigin(): string {
  return (process.env.APP_URL ?? FALLBACK_ORIGIN).replace(/\/+$/, "");
}

/** Абсолютный URL внутреннего пути вида `/onboarding/worker`. */
export function appUrl(path: string): URL {
  return new URL(path, `${appOrigin()}/`);
}
