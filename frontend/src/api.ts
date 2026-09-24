export interface Note {
  id: string
  title: string
  body: string
  created_at: string
  updated_at: string
}

export interface NoteInput {
  title: string
  body?: string
}

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export class ApiError extends Error {
  status: number
  detail: unknown

  constructor(status: number, detail: unknown) {
    super(typeof detail === 'string' ? detail : `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

async function parseErrorDetail(response: Response): Promise<unknown> {
  try {
    const data = (await response.json()) as { detail?: unknown }
    return data.detail
  } catch {
    return undefined
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!response.ok) {
    const detail = await parseErrorDetail(response)
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export function listNotes(): Promise<Note[]> {
  return request<Note[]>('/notes', { method: 'GET' })
}

export function getNote(id: string): Promise<Note> {
  return request<Note>(`/notes/${id}`, { method: 'GET' })
}

export function createNote(input: NoteInput): Promise<Note> {
  return request<Note>('/notes', {
    method: 'POST',
    body: JSON.stringify({ title: input.title, body: input.body ?? '' }),
  })
}

export function updateNote(id: string, input: NoteInput): Promise<Note> {
  return request<Note>(`/notes/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: input.title, body: input.body ?? '' }),
  })
}

export function deleteNote(id: string): Promise<void> {
  return request<void>(`/notes/${id}`, { method: 'DELETE' })
}
