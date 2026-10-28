export interface ApiFailure {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  canRetry: boolean;
  recoveryAction?: string;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

/** Same-origin JSON call with the CSRF header the server requires on every mutation. */
export async function api<T>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'x-setrya-request': '1' };
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.body);
  } else if (init.method && init.method !== 'GET') {
    headers['content-type'] = 'application/json';
    body = '{}';
  }
  let response: Response;
  try {
    response = await fetch(path, { method: init.method ?? (body ? 'POST' : 'GET'), headers, body, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    return { ok: false, error: { code: 'OFFLINE', message: 'Setrya could not reach the server. Check your connection; nothing was changed.', canRetry: true } };
  }
  try {
    const json = (await response.json()) as { ok: boolean; data?: T; error?: ApiFailure };
    if (json.ok) return { ok: true, data: json.data as T };
    const error = json.error ?? { code: 'UNKNOWN', message: 'The request failed.', canRetry: true };
    if (error.code === 'VAULT_LOCKED' || error.code === 'UNAUTHENTICATED') {
      window.location.assign(`${error.code === 'VAULT_LOCKED' ? '/unlock' : '/sign-in'}?next=${encodeURIComponent(window.location.pathname)}`);
    }
    return { ok: false, error };
  } catch {
    return { ok: false, error: { code: 'BAD_RESPONSE', message: `The server answered with HTTP ${response.status}.`, canRetry: true } };
  }
}
