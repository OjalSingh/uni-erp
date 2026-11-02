import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { INDIAN_STATES, SESSIONS } from './constants.ts'

interface FinancialYear { label: string; current: boolean }
interface Named { name: string }

// Sessions come from Miscellaneous > Financial year; the built-in list is only a fallback if the request fails
export function useSessions() {
  const [state, setState] = useState({ sessions: SESSIONS, current: SESSIONS[0], loaded: false })
  useEffect(() => {
    api<FinancialYear[]>('/config/financial-years')
      .then((rows) => {
        if (rows.length === 0) return setState((s) => ({ ...s, loaded: true }))
        setState({ sessions: rows.map((r) => r.label), current: rows.find((r) => r.current)?.label ?? rows[0].label, loaded: true })
      })
      .catch(() => setState((s) => ({ ...s, loaded: true })))
  }, [])
  return state
}

export function useStates(): string[] {
  const [names, setNames] = useState<string[]>(INDIAN_STATES)
  useEffect(() => {
    api<Named[]>('/config/states')
      .then((rows) => { if (rows.length) setNames(rows.map((r) => r.name)) })
      .catch(() => undefined)
  }, [])
  return names
}

// City suggestions for the chosen state; the field stays free text, so a missing city never blocks a form
export function useCities(state: string): string[] {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    if (!state) return setNames([])
    api<Named[]>(`/config/cities?stateName=${encodeURIComponent(state)}`).then((rows) => setNames(rows.map((r) => r.name))).catch(() => setNames([]))
  }, [state])
  return names
}
