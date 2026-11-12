import { useEffect, useMemo, useRef, useState } from 'react'

type Props = { from: string; to: string }
type Person = { id: number; name: string; weeklyHours: number; allocated: number[] }
type Capacity = { weeks: string[]; people: Person[] }

const PAGE_SIZE = 50
const dateLabel = (date: string) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
const hours = (value: number) => `${Number(value.toPrecision(12))}h`

function shiftDate(date: string, days: number) {
  const result = new Date(`${date}T00:00:00Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

export function CapacityGrid({ from, to }: Props) {
  const [range, setRange] = useState({ from, to })
  const [draftRange, setDraftRange] = useState({ from, to })
  const [data, setData] = useState<Capacity | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [draftHours, setDraftHours] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const requestSequence = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const sequence = ++requestSequence.current
    setLoading(true)
    setLoadError('')
    fetch(`/api/capacity?from=${range.from}&to=${range.to}`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(await response.text() || 'Could not load capacity')
        return response.json() as Promise<Capacity>
      })
      .then(next => {
        if (sequence === requestSequence.current) setData(next)
      })
      .catch(error => {
        if (sequence === requestSequence.current && !controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load capacity')
      })
      .finally(() => {
        if (sequence === requestSequence.current) setLoading(false)
      })
    return () => controller.abort()
  }, [range, refresh])

  const filtered = useMemo(() => data?.people.filter(person => person.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())) ?? [], [data, search])
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const overCount = data?.people.filter(person => person.allocated.some(value => value > person.weeklyHours)).length ?? 0
  const rangeValid = Boolean(draftRange.from && draftRange.to) && draftRange.from <= draftRange.to && (new Date(draftRange.to).getTime() - new Date(draftRange.from).getTime()) <= 732 * 86400000

  function changeRange(next: { from: string; to: string }) {
    setEditing(null)
    setSaveError('')
    setPage(0)
    setData(null)
    setRange(next)
    setDraftRange(next)
  }

  async function save(person: Person) {
    const value = Number(draftHours)
    if (draftHours.trim() === '' || !Number.isFinite(value) || value < 0 || value > 168 || Math.abs(Math.round(value * 100) - value * 100) > 1e-7) {
      setSaveError('Enter weekly hours from 0 to 168, with at most two decimal places.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const response = await fetch(`/api/people/${person.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeklyHours: value }),
      })
      if (!response.ok) throw new Error(await response.text() || 'Save failed')
      const updated = await response.json() as Pick<Person, 'id' | 'weeklyHours'>
      setData(previous => previous && ({ ...previous, people: previous.people.map(item => item.id === updated.id ? { ...item, weeklyHours: updated.weeklyHours } : item) }))
      setEditing(null)
      setRefresh(previous => previous + 1)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Save failed. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label="Team capacity">
      <div className="toolbar">
        <div className="week-nav" aria-label="Navigate weeks">
          <button type="button" onClick={() => changeRange({ from: shiftDate(range.from, -7), to: shiftDate(range.to, -7) })} disabled={saving}>← Previous</button>
          <strong>{dateLabel(range.from)} to {dateLabel(range.to)}, {range.to.slice(0, 4)}</strong>
          <button type="button" onClick={() => changeRange({ from: shiftDate(range.from, 7), to: shiftDate(range.to, 7) })} disabled={saving}>Next →</button>
        </div>
        <form className="range-form" onSubmit={event => { event.preventDefault(); if (rangeValid) changeRange(draftRange) }}>
          <label>From <input type="date" value={draftRange.from} onChange={event => setDraftRange({ ...draftRange, from: event.target.value })} disabled={saving} required /></label>
          <label>To <input type="date" value={draftRange.to} onChange={event => setDraftRange({ ...draftRange, to: event.target.value })} disabled={saving} required /></label>
          <button type="submit" disabled={saving || !rangeValid}>Apply range</button>
        </form>
      </div>
      {!rangeValid && <p className="field-error">Choose an end date after the start date, within two years.</p>}
      <div className="overview">
        <div><span className="metric">{data?.people.length ?? '–'}</span><span>People</span></div>
        <div><span className="metric alert-text">{data ? overCount : '–'}</span><span>Over capacity in this range</span></div>
        <div><span className="metric">{data?.weeks.length ?? '–'}</span><span>Weeks</span></div>
      </div>
      <div className="table-controls">
        <label>Find a person <input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(0) }} placeholder="Search by name" disabled={saving} /></label>
        <span className="legend"><i /> Over weekly capacity</span>
      </div>
      {loading && <p className="notice" role="status">{data ? 'Refreshing capacity…' : 'Loading capacity…'}</p>}
      {loadError && <div className="notice error" role="alert">Could not load this range. {loadError} <button type="button" onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
      {data && <>
        <div className="table-scroll" aria-busy={loading}>
          <table>
            <thead><tr><th scope="col" className="person-column">Person</th><th scope="col">Weekly capacity</th>{data.weeks.map(week => <th scope="col" key={week}>Week of {dateLabel(week)}</th>)}</tr></thead>
            <tbody>
              {visible.map(person => <tr key={person.id}>
                <th scope="row" className="person-column">{person.name}</th>
                <td className="capacity-cell">
                  {editing === person.id ? <div className="edit-controls">
                    <label className="sr-only" htmlFor={`hours-${person.id}`}>Weekly hours for {person.name}</label>
                    <input id={`hours-${person.id}`} type="number" min="0" max="168" step="0.01" value={draftHours} onChange={event => setDraftHours(event.target.value)} disabled={saving} />
                    <button type="button" onClick={() => save(person)} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                    <button type="button" className="quiet" onClick={() => { setEditing(null); setSaveError('') }} disabled={saving}>Cancel</button>
                    {saveError && <span className="field-error" role="alert">{saveError}</span>}
                  </div> : <div className="capacity-value"><span>{hours(person.weeklyHours)}</span><button type="button" className="quiet" onClick={() => { setEditing(person.id); setDraftHours(String(person.weeklyHours)); setSaveError('') }} disabled={saving}>Edit<span className="sr-only"> {person.name}</span></button></div>}
                </td>
                {person.allocated.map((allocated, index) => {
                  const over = allocated > person.weeklyHours
                  return <td key={data.weeks[index]} className={over ? 'over-cell' : 'allocation-cell'} aria-label={`${person.name}, week of ${data.weeks[index]}: ${hours(allocated)} allocated of ${hours(person.weeklyHours)} capacity${over ? ', over capacity' : ''}`}>
                    <strong>{hours(allocated)}</strong><span className="cell-detail"> / {hours(person.weeklyHours)}</span>{over && <span className="over-label">Over by {hours(allocated - person.weeklyHours)}</span>}
                  </td>
                })}
              </tr>)}
            </tbody>
          </table>
          {visible.length === 0 && <p className="notice">No people match this search.</p>}
        </div>
        <div className="pagination"><span>Showing {filtered.length ? page * PAGE_SIZE + 1 : 0} to {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span><div><button type="button" onClick={() => setPage(value => value - 1)} disabled={saving || page === 0}>Previous page</button><button type="button" onClick={() => setPage(value => value + 1)} disabled={saving || (page + 1) * PAGE_SIZE >= filtered.length}>Next page</button></div></div>
      </>}
    </section>
  )
}
