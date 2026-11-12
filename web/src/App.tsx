import { CapacityGrid } from './CapacityGrid'

const FROM = '2025-12-29'
const TO = '2026-01-16'

export function App() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">TEAM OVERVIEW</p>
        <h1>Capacity</h1>
        <p className="subtitle">Allocated hours against each person’s weekly availability.</p>
      </header>
      <CapacityGrid from={FROM} to={TO} />
    </main>
  )
}
