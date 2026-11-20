import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

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

// Note titles show in the list and in the editor, so look in the list.
function inList() {
  return within(screen.getByRole('region', { name: 'Notes' }))
}

type Handler = (body: unknown) => Response

// A fake server: one handler per "METHOD /path". Anything else fails the test.
function fakeApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url}`
    const handler = routes[key]
    if (!handler) return Promise.reject(new Error(`unexpected request ${key}`))
    return Promise.resolve(handler(init?.body ? JSON.parse(String(init.body)) : undefined))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// The bodies sent with one kind of request, e.g. calls(fetchMock, 'POST /api/notes').
function calls(fetchMock: ReturnType<typeof fakeApi>, key: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([url, init]) => `${init?.method ?? 'GET'} ${url}` === key)
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined))
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
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders the list of notes, newest updated first', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([NOTE_A, NOTE_B]))
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const items = await within(screen.getByRole('region', { name: 'Notes' })).findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Groceries')).toBeInTheDocument()
    expect(within(items[0]).getByText(/Milk, eggs, bread/)).toBeInTheDocument()
    expect(within(items[1]).getByText('Trip plan')).toBeInTheDocument()
  })

  it('shows a loading state while the notes are still being fetched', async () => {
    let resolveFetch: (response: Response) => void = () => {}
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(screen.getByText('Loading notes…')).toBeInTheDocument()
    expect(screen.queryByText('No notes yet')).not.toBeInTheDocument()

    resolveFetch(jsonResponse([]))
    await screen.findByText('No notes yet')
    expect(screen.queryByText('Loading notes…')).not.toBeInTheDocument()
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

  it('opens the newest note in the editor, and switches when another title is clicked', async () => {
    const user = userEvent.setup()
    fakeApi({ 'GET /api/notes': () => jsonResponse([NOTE_B, NOTE_A]) })

    render(<App />)
    expect(await screen.findByLabelText('Title')).toHaveValue('Groceries')
    expect(screen.getByLabelText('Body')).toHaveValue('Milk, eggs, bread')
    expect(inList().getByRole('button', { name: 'Groceries' })).toHaveAttribute('aria-current', 'true')

    await user.click(inList().getByRole('button', { name: 'Trip plan' }))
    expect(screen.getByLabelText('Title')).toHaveValue('Trip plan')
    expect(screen.getByLabelText('Body')).toHaveValue('Book flights')
    expect(inList().getByRole('button', { name: 'Trip plan' })).toHaveAttribute('aria-current', 'true')
    expect(inList().getByRole('button', { name: 'Groceries' })).not.toHaveAttribute('aria-current')
  })

  it('creates a new note once a title is typed, and lists it', async () => {
    const user = userEvent.setup()
    const fetchMock = fakeApi({
      'GET /api/notes': () => jsonResponse([]),
      'POST /api/notes': () => jsonResponse(NOTE_A, 201),
    })

    render(<App />)
    await screen.findByText('No notes yet')
    await user.click(screen.getByRole('button', { name: /new note/i }))

    const title = screen.getByLabelText('Title')
    expect(title).toHaveFocus()
    expect(screen.getByText('Add a title to save')).toBeInTheDocument()

    await user.type(title, 'Groceries')
    await waitFor(() => expect(calls(fetchMock, 'POST /api/notes')).toHaveLength(1))
    expect(calls(fetchMock, 'POST /api/notes')[0]).toEqual({ title: 'Groceries', body: '' })
    expect(await inList().findByRole('button', { name: 'Groceries' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('does not create a note that has no title', async () => {
    const user = userEvent.setup()
    const fetchMock = fakeApi({ 'GET /api/notes': () => jsonResponse([]) })

    render(<App />)
    await screen.findByText('No notes yet')
    await user.click(screen.getByRole('button', { name: /new note/i }))
    await user.type(screen.getByLabelText('Body'), 'Just a body')
    await new Promise((resolve) => setTimeout(resolve, 700))

    expect(calls(fetchMock, 'POST /api/notes')).toHaveLength(0)
    expect(screen.getByText('Add a title to save')).toBeInTheDocument()
  })

  it('saves an edit after a pause and updates the list', async () => {
    const user = userEvent.setup()
    const updated = { ...NOTE_A, body: 'Milk, eggs, bread and jam', updated_at: '2026-01-03T00:00:00Z' }
    const fetchMock = fakeApi({
      'GET /api/notes': () => jsonResponse([NOTE_A]),
      [`PUT /api/notes/${NOTE_A.id}`]: () => jsonResponse(updated),
    })

    render(<App />)
    await user.type(await screen.findByLabelText('Body'), ' and jam')
    expect(screen.getByText('Saving…')).toBeInTheDocument()

    await waitFor(() => expect(calls(fetchMock, `PUT /api/notes/${NOTE_A.id}`)).toHaveLength(1))
    expect(calls(fetchMock, `PUT /api/notes/${NOTE_A.id}`)[0]).toEqual({
      title: 'Groceries',
      body: 'Milk, eggs, bread and jam',
    })
    expect(await inList().findByText('Milk, eggs, bread and jam')).toBeInTheDocument()
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument()
  })

  it('moves between title and body with Enter and Backspace', async () => {
    const user = userEvent.setup()
    fakeApi({ 'GET /api/notes': () => jsonResponse([NOTE_A]) })

    render(<App />)
    const title = await screen.findByLabelText('Title')
    const body = screen.getByLabelText<HTMLTextAreaElement>('Body')

    await user.click(title)
    await user.keyboard('{Enter}')
    expect(body).toHaveFocus()
    expect(body.selectionStart).toBe(0)
    expect(title).toHaveValue('Groceries')

    await user.keyboard('{Backspace}')
    expect(title).toHaveFocus()
    expect(body).toHaveValue('Milk, eggs, bread')
  })

  it('shows a failed save with Try again, which sends it again', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const fetchMock = fakeApi({
      'GET /api/notes': () => jsonResponse([NOTE_A]),
      [`PUT /api/notes/${NOTE_A.id}`]: (body) => {
        attempts += 1
        return attempts === 1
          ? jsonResponse({ detail: 'boom' }, 500)
          : jsonResponse({ ...NOTE_A, ...(body as object) })
      },
    })

    render(<App />)
    await user.type(await screen.findByLabelText('Body'), '!')
    expect(await screen.findByRole('alert')).toHaveTextContent('Not saved: boom')

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(calls(fetchMock, `PUT /api/notes/${NOTE_A.id}`)).toHaveLength(2))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('keeps the text as a new note when a save gets a 404', async () => {
    const user = userEvent.setup()
    const recreated = { ...NOTE_A, id: '33333333-3333-3333-3333-333333333333', body: 'Milk, eggs, bread!' }
    const fetchMock = fakeApi({
      'GET /api/notes': () => jsonResponse([NOTE_A]),
      [`PUT /api/notes/${NOTE_A.id}`]: () => jsonResponse({ detail: 'Note not found' }, 404),
      'POST /api/notes': () => jsonResponse(recreated, 201),
    })

    render(<App />)
    await user.type(await screen.findByLabelText('Body'), '!')

    expect(await screen.findByRole('alert')).toHaveTextContent(/kept as a new note/i)
    await waitFor(() => expect(calls(fetchMock, 'POST /api/notes')).toHaveLength(1))
    expect(calls(fetchMock, 'POST /api/notes')[0]).toEqual({ title: 'Groceries', body: 'Milk, eggs, bread!' })
    expect(screen.getByLabelText('Body')).toHaveValue('Milk, eggs, bread!')
  })

  it('deletes a note after confirming', async () => {
    const user = userEvent.setup()
    const fetchMock = fakeApi({
      'GET /api/notes': () => jsonResponse([NOTE_A]),
      [`DELETE /api/notes/${NOTE_A.id}`]: () => new Response(null, { status: 204 }),
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await inList().findByText('Groceries')
    await user.click(screen.getByRole('button', { name: /delete note/i }))

    expect(window.confirm).toHaveBeenCalled()
    expect(calls(fetchMock, `DELETE /api/notes/${NOTE_A.id}`)).toHaveLength(1)
    expect(await screen.findByText('No notes yet')).toBeInTheDocument()
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new note/i })).toHaveFocus()
  })

  it('does not delete when the confirmation is declined', async () => {
    const user = userEvent.setup()
    const fetchMock = fakeApi({ 'GET /api/notes': () => jsonResponse([NOTE_A]) })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<App />)
    await inList().findByText('Groceries')
    await user.click(screen.getByRole('button', { name: /delete note/i }))

    expect(window.confirm).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(inList().getByText('Groceries')).toBeInTheDocument()
  })

  it('opens the next note down after deleting the open one', async () => {
    const user = userEvent.setup()
    fakeApi({
      'GET /api/notes': () => jsonResponse([NOTE_A, NOTE_B]),
      [`DELETE /api/notes/${NOTE_A.id}`]: () => new Response(null, { status: 204 }),
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await inList().findByText('Groceries')
    await user.click(screen.getByRole('button', { name: 'Delete note "Groceries"' }))

    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Trip plan'))
    expect(inList().getByRole('button', { name: 'Trip plan' })).toHaveFocus()
  })

  it('removes a note and says so when a delete gets a 404', async () => {
    const user = userEvent.setup()
    fakeApi({
      'GET /api/notes': () => jsonResponse([NOTE_A]),
      [`DELETE /api/notes/${NOTE_A.id}`]: () => jsonResponse({ detail: 'Note not found' }, 404),
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<App />)
    await inList().findByText('Groceries')
    await user.click(screen.getByRole('button', { name: /delete note/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer exists/i)
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()
  })

  it('closes the note pane completely and opens it again from the list', async () => {
    const user = userEvent.setup()
    fakeApi({ 'GET /api/notes': () => jsonResponse([NOTE_A, NOTE_B]) })

    const { container } = render(<App />)
    await screen.findByLabelText('Title')
    await user.click(screen.getByRole('button', { name: 'Close note' }))

    expect(container.firstChild).toHaveClass('wide-list')
    expect(inList().getByRole('button', { name: 'Groceries' })).toHaveFocus()
    expect(inList().getByRole('button', { name: 'Groceries' })).not.toHaveAttribute('aria-current')
    expect(localStorage.getItem('kwiktots.wide')).toBe('list')

    await user.click(inList().getByRole('button', { name: 'Trip plan' }))
    expect(container.firstChild).not.toHaveClass('wide-list')
    expect(screen.getByLabelText('Title')).toHaveValue('Trip plan')
  })

  it('folds and unfolds the Assistant, and closing the note leaves it folded', async () => {
    const user = userEvent.setup()
    fakeApi({ 'GET /api/notes': () => jsonResponse([NOTE_A]) })

    const { container } = render(<App />)
    await screen.findByLabelText('Title')
    const toggle = screen.getByRole('button', { name: 'Assistant panel' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
    expect(container.firstChild).toHaveClass('wide-note')

    // Closing the note leaves the Assistant as it was: both are closed together.
    await user.click(screen.getByRole('button', { name: 'Close note' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(container.firstChild).toHaveClass('wide-note', 'wide-list')
    expect(localStorage.getItem('kwiktots.wide')).toBe('both')

    // Unfolding the Assistant leaves the note closed.
    await user.click(toggle)
    expect(container.firstChild).toHaveClass('wide-list')
    expect(container.firstChild).not.toHaveClass('wide-note')
  })
})
