import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { CapacityGrid } from './CapacityGrid'

const first = { weeks: ['2025-12-29'], people: [{ id: 1, name: 'Ana Ferreira', weeklyHours: 40, allocated: [320] }] }
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
