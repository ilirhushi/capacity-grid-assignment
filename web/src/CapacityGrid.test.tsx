import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { CapacityGrid } from './CapacityGrid'

const first = { weeks: ['2025-12-29'], people: [{ id: 1, name: 'Ana Ferreira', weeklyHours: 40, allocated: [320] }], totalPeople: 1, page: 1, pageSize: 50 }
const response = (body: unknown, ok = true) => ({ ok, json: async () => body, text: async () => 'Save failed' }) as Response

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('shows allocation and capacity with an explicit over-capacity warning', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(first)))
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  expect(screen.getByRole('status')).toHaveTextContent('Loading')
  const row = await screen.findByRole('row', { name: /Ana Ferreira/ })
  expect(within(row).getByText('320h')).toBeInTheDocument()
  expect(within(row).getByText(/Over by 280h/)).toBeInTheDocument()
})

test('keeps original capacity and editor after a failed save, then refreshes after retry', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response(first))
    .mockResolvedValueOnce(response({}, false))
    .mockResolvedValueOnce(response({ id: 1, name: 'Ana Ferreira', weeklyHours: 32 }))
    .mockResolvedValueOnce(response({ ...first, people: [{ ...first.people[0], weeklyHours: 32 }] }))
  vi.stubGlobal('fetch', fetchMock)
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  const row = await screen.findByRole('row', { name: /Ana Ferreira/ })
  fireEvent.click(within(row).getByRole('button', { name: /Edit/ }))
  fireEvent.change(within(row).getByRole('spinbutton'), { target: { value: '32' } })
  fireEvent.click(within(row).getByRole('button', { name: 'Save' }))
  expect(await within(row).findByRole('alert')).toHaveTextContent('Save failed')
  expect(within(row).getByRole('spinbutton')).toHaveValue(32)
  fireEvent.click(within(row).getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
  expect(await within(row).findByText('32h')).toBeInTheDocument()
})

test('ignores a late response for a previous range', async () => {
  let resolveOld!: (value: Response) => void
  const old = new Promise<Response>(resolve => { resolveOld = resolve })
  const fetchMock = vi.fn().mockReturnValueOnce(old).mockResolvedValueOnce(response({ weeks: ['2026-01-05'], people: [{ ...first.people[0], allocated: [0] }] }))
  vi.stubGlobal('fetch', fetchMock)
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
  expect(await screen.findByRole('columnheader', { name: /Jan 5/ })).toBeInTheDocument()
  await act(async () => resolveOld(response(first)))
  expect(screen.getByRole('columnheader', { name: /Jan 5/ })).toBeInTheDocument()
  expect(screen.queryByRole('columnheader', { name: /Dec 29/ })).not.toBeInTheDocument()
})

test('clears the previous range while a new range is loading', async () => {
  let resolveNext!: (value: Response) => void
  const next = new Promise<Response>(resolve => { resolveNext = resolve })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(first)).mockReturnValueOnce(next))
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  expect(await screen.findByRole('row', { name: /Ana Ferreira/ })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
  expect(screen.queryByRole('row', { name: /Ana Ferreira/ })).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Loading')
  await act(async () => resolveNext(response({ weeks: ['2026-01-05'], people: [] })))
})

test('offers retry after a failed initial load', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(response({}, false)).mockResolvedValueOnce(response(first))
  vi.stubGlobal('fetch', fetchMock)
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('row', { name: /Ana Ferreira/ })).toBeInTheDocument()
})

test('keeps search unavailable until a save finishes so its error stays visible', async () => {
  let finishSave!: (value: Response) => void
  const pendingSave = new Promise<Response>(resolve => { finishSave = resolve })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(first)).mockReturnValueOnce(pendingSave))
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  const row = await screen.findByRole('row', { name: /Ana Ferreira/ })
  fireEvent.click(within(row).getByRole('button', { name: /Edit/ }))
  fireEvent.click(within(row).getByRole('button', { name: 'Save' }))
  expect(screen.getByRole('searchbox', { name: 'Find a person' })).toBeDisabled()
  await act(async () => finishSave(response({}, false)))
  expect(within(row).getByRole('alert')).toHaveTextContent('Save failed')
  expect(screen.getByRole('searchbox', { name: 'Find a person' })).toBeEnabled()
})

test('shows a small fractional overage accurately', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ weeks: first.weeks, people: [{ ...first.people[0], weeklyHours: 39.99, allocated: [40] }] })))
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  const row = await screen.findByRole('row', { name: /Ana Ferreira/ })
  expect(within(row).getByText('39.99h')).toBeInTheDocument()
  expect(within(row).getByText('Over by 0.01h')).toBeInTheDocument()
})

test('does not display a nonzero allocation as zero', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ weeks: first.weeks, people: [{ ...first.people[0], weeklyHours: 0, allocated: [0.003] }] })))
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  const row = await screen.findByRole('row', { name: /Ana Ferreira/ })
  expect(within(row).getByText('0.003h')).toBeInTheDocument()
  expect(within(row).getByText('Over by 0.003h')).toBeInTheDocument()
})

test('requests the next people page and resets to page one for search', async () => {
  const firstPage = { ...first, totalPeople: 120 }
  const secondPage = { ...first, people: [{ id: 51, name: 'Bo Lindqvist', weeklyHours: 40, allocated: [16] }], totalPeople: 120, page: 2 }
  const searched = { ...first, totalPeople: 1 }
  const fetchMock = vi.fn().mockResolvedValueOnce(response(firstPage)).mockResolvedValueOnce(response(secondPage)).mockResolvedValueOnce(response(searched))
  vi.stubGlobal('fetch', fetchMock)
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  expect(await screen.findByText(/Showing 1 to 50 of 120/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(await screen.findByRole('row', { name: /Bo Lindqvist/ })).toBeInTheDocument()
  expect(fetchMock.mock.calls[1][0]).toContain('page=2')
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), { target: { value: 'Ana' } })
  expect(await screen.findByRole('row', { name: /Ana Ferreira/ })).toBeInTheDocument()
  expect(fetchMock.mock.calls[2][0]).toContain('search=Ana')
  expect(fetchMock.mock.calls[2][0]).toContain('page=1')
})

test('ignores a late response from a page left by search', async () => {
  let resolvePage!: (value: Response) => void
  const delayedPage = new Promise<Response>(resolve => { resolvePage = resolve })
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(response({ ...first, totalPeople: 100 }))
    .mockReturnValueOnce(delayedPage)
    .mockResolvedValueOnce(response(first))
  vi.stubGlobal('fetch', fetchMock)
  render(<CapacityGrid from="2025-12-29" to="2026-01-02" />)
  expect(await screen.findByRole('button', { name: 'Next page' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  fireEvent.change(screen.getByRole('searchbox', { name: 'Find a person' }), { target: { value: 'Ana' } })
  expect(await screen.findByText('Showing 1 to 1 of 1')).toBeInTheDocument()
  await act(async () => resolvePage(response({ ...first, people: [{ id: 51, name: 'Bo Lindqvist', weeklyHours: 40, allocated: [0] }], totalPeople: 100, page: 2 })))
  expect(screen.getByText('Showing 1 to 1 of 1')).toBeInTheDocument()
  expect(screen.queryByRole('row', { name: /Bo Lindqvist/ })).not.toBeInTheDocument()
})

test('renders only nearby columns in a two-year range', async () => {
  const weeks = Array.from({ length: 105 }, (_, index) => {
    const date = new Date('2025-01-06T00:00:00Z')
    date.setUTCDate(date.getUTCDate() + index * 7)
    return date.toISOString().slice(0, 10)
  })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ...first, weeks, people: [{ ...first.people[0], allocated: Array(105).fill(0) }] })))
  render(<CapacityGrid from="2025-01-06" to="2027-01-08" />)
  expect(await screen.findByRole('row', { name: /Ana Ferreira/ })).toBeInTheDocument()
  expect(screen.getAllByRole('columnheader').length).toBeLessThan(20)
  expect(screen.getByRole('columnheader', { name: /Jan 6/ })).toBeInTheDocument()
})

test('resets the week window when moving to another people page', async () => {
  const weeks = Array.from({ length: 105 }, (_, index) => {
    const date = new Date('2025-01-06T00:00:00Z')
    date.setUTCDate(date.getUTCDate() + index * 7)
    return date.toISOString().slice(0, 10)
  })
  const pageOne = { ...first, weeks, totalPeople: 100, people: [{ ...first.people[0], allocated: Array(105).fill(0) }] }
  const pageTwo = { ...pageOne, page: 2, people: [{ id: 51, name: 'Bo Lindqvist', weeklyHours: 40, allocated: Array(105).fill(0) }] }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response(pageOne)).mockResolvedValueOnce(response(pageTwo)))
  render(<CapacityGrid from="2025-01-06" to="2027-01-08" />)
  expect(await screen.findByRole('row', { name: /Ana Ferreira/ })).toBeInTheDocument()
  const scroller = screen.getByRole('table').parentElement!
  scroller.scrollLeft = 1560
  fireEvent.scroll(scroller)
  expect(screen.queryByRole('columnheader', { name: /Jan 6/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  expect(await screen.findByRole('row', { name: /Bo Lindqvist/ })).toBeInTheDocument()
  expect(screen.getByRole('columnheader', { name: /Jan 6/ })).toBeInTheDocument()
})
