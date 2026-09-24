import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from './api'

const NOTE = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Groceries',
  body: 'Milk, eggs',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('listNotes fetches GET /notes and returns the list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([NOTE]))
    vi.stubGlobal('fetch', fetchMock)

    const notes = await listNotes()

    expect(notes).toEqual([NOTE])
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('getNote fetches GET /notes/{id}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(NOTE))
    vi.stubGlobal('fetch', fetchMock)

    const note = await getNote(NOTE.id)

    expect(note).toEqual(NOTE)
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/notes/${NOTE.id}`,
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('createNote posts a title and body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(NOTE, 201))
    vi.stubGlobal('fetch', fetchMock)

    const note = await createNote({ title: 'Groceries', body: 'Milk, eggs' })

    expect(note).toEqual(NOTE)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: 'Groceries', body: 'Milk, eggs' }),
      }),
    )
  })

  it('createNote defaults body to an empty string', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(NOTE, 201))
    vi.stubGlobal('fetch', fetchMock)

    await createNote({ title: 'Groceries' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notes',
      expect.objectContaining({
        body: JSON.stringify({ title: 'Groceries', body: '' }),
      }),
    )
  })

  it('updateNote puts a title and body to /notes/{id}', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(NOTE))
    vi.stubGlobal('fetch', fetchMock)

    const note = await updateNote(NOTE.id, {
      title: 'Groceries',
      body: 'Milk',
    })

    expect(note).toEqual(NOTE)
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/notes/${NOTE.id}`,
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ title: 'Groceries', body: 'Milk' }),
      }),
    )
  })

  it('deleteNote sends DELETE and returns nothing on 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteNote(NOTE.id)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/notes/${NOTE.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('throws an ApiError carrying the status and detail on a 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ detail: 'Note not found' }, 404))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getNote(NOTE.id)).rejects.toMatchObject({
      status: 404,
      detail: 'Note not found',
    })
  })

  it('throws an ApiError on a 422 with the validation detail', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        { detail: [{ loc: ['body', 'title'], msg: 'field required' }] },
        422,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const error = await createNote({ title: '' }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(422)
    expect((error as ApiError).detail).toEqual([
      { loc: ['body', 'title'], msg: 'field required' },
    ])
  })

  it('falls back to a generic message when the error body has no detail', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('not json', { status: 500 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listNotes()).rejects.toMatchObject({
      status: 500,
    })
  })
})
