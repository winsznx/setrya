'use client';

import { useState } from 'react';

import { api, type ApiResult } from '@/lib/client/api';

/** One mutation's lifecycle: busy flag, top-level message and per-field errors from the server. */
export function useSubmit<T>() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  async function submit(path: string, init: { method?: string; body?: unknown; form?: FormData }): Promise<ApiResult<T>> {
    setBusy(true);
    setMessage(null);
    setFieldErrors({});
    const result = await api<T>(path, { method: init.method ?? 'POST', body: init.body, form: init.form });
    setBusy(false);
    if (!result.ok) {
      setMessage(result.error.message);
      setFieldErrors(result.error.fieldErrors ?? {});
    }
    return result;
  }
  return { busy, message, fieldErrors, submit, setMessage };
}
