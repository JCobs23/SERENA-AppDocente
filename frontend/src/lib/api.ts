export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super('La solicitud a Serena no pudo completarse.')
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers,
  })

  if (!response.ok) throw new ApiError(response.status)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
