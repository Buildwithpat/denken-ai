import { getToken } from './auth';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api';

export type ErrorBody = Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  auth?:   boolean;
  body?:   unknown;
  signal?: AbortSignal;
};

// Default timeout: 45s (AI generation can take up to 30s on the backend)
const DEFAULT_TIMEOUT_MS = 45_000;

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = false, body, headers: extraHeaders, signal: callerSignal, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extraHeaders as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  // Abort on timeout OR on caller's signal (whichever fires first)
  const controller  = new AbortController();
  const timeoutId   = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  if (callerSignal) {
    callerSignal.addEventListener('abort', () => controller.abort());
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      signal:  controller.signal,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(
        'Request timed out. The server took too long to respond. Please try again.',
        408,
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  let data: T & { error?: string };
  try {
    data = (await res.json()) as T & { error?: string };
  } catch {
    throw new ApiError(`Server returned a non-JSON response (HTTP ${res.status})`, res.status);
  }

  if (!res.ok) {
    const errData = data as { error?: string } & ErrorBody;
    throw new ApiError(errData.error ?? 'Request failed.', res.status, errData);
  }

  return data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: 'GET', ...options }),

  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { method: 'POST', body, ...options }),
};
