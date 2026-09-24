import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { ApiError } from './api'

const NOTE_A = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Groceries',
  body: 'Milk, eggs, bread',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const NOTE_B = {
  id: '22222222-2222-2222-2222-222222222222',
  title: 'Trip plan',
  body: 'Book flights',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the list of notes, newest updated first', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([NOTE_A, NOTE_B]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Groceries')).toBeInTheDocument()
    expect(within(items[0]).getByText(/Milk, eggs, bread/)).toBeInTheDocument()
    expect(within(items[1]).getByText('Trip plan')).toBeInTheDocument()
  })

  it('shows an empty state when there are no notes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByText('No notes yet')).toBeInTheDocument()
  })

  it('shows an error state when the notes fail to load', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ detail: 'boom' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
  })

  it('creates a note', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await screen.findByText('No notes yet')

    fetchMock.mockResolvedValueOnce(jsonResponse(NOTE_A, 201))
    fetchMock.mockResolvedValueOnce(jsonResponse([NOTE_A]))

    await user.click(screen.getByRole('button', { name: /new note/i }))
    await user.type(screen.getByLabelText(/title/i), 'Groceries')
    await user.type(screen.getByLabelText(/body/i), 'Milk, eggs, bread')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/notes',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(await screen.findByText('Groceries')).toBeInTheDocument()
  })

  it('edits a note', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(jsonResponse([NOTE_A]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await user.click(await screen.findByText('Groceries'))

    const titleField = await screen.findByLabelText(/title/i)
    expect(titleField).toHaveValue('Groceries')

    const updated = { ...NOTE_A, title: 'Groceries v2' }
    fetchMock.mockResolvedValueOnce(jsonResponse(updated))

    await user.clear(titleField)
    await user.type(titleField, 'Groceries v2')
    await user.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/notes/${NOTE_A.id}`,
        expect.objectContaining({ method: 'PUT' }),
      )
    })
    expect(await screen.findByText('Groceries v2')).toBeInTheDocument()
  })

  it('deletes a note after confirming', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(jsonResponse([NOTE_A]))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await user.click(await screen.findByText('Groceries'))

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    fetchMock.mockResolvedValueOnce(jsonResponse([]))

    await user.click(screen.getByRole('button', { name: /delete/i }))

    expect(window.confirm).toHaveBeenCalled()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/notes/${NOTE_A.id}`,
        expect.objectContaining({ method: 'DELETE' }),
      )
    })
    expect(await screen.findByText('No notes yet')).toBeInTheDocument()
  })

  it('does not delete when the confirmation is declined', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(jsonResponse([NOTE_A]))
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<App />)
    await user.click(await screen.findByText('Groceries'))
    await user.click(screen.getByRole('button', { name: /delete/i }))

    expect(window.confirm).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a validation error from a 422 next to the title field', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    await screen.findByText('No notes yet')

    fetchMock.mockRejectedValueOnce(
      new ApiError(422, [
        { loc: ['body', 'title'], msg: 'field required' },
      ]),
    )

    await user.click(screen.getByRole('button', { name: /new note/i }))
    await user.click(screen.getByRole('button', { name: /save/i }))

    const titleField = await screen.findByLabelText(/title/i)
    expect(titleField).toHaveAccessibleDescription(/field required/i)
  })
})
