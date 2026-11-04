import { useEffect, useState } from 'react'
import { api } from './api.ts'

export type TemplateKind = 'certificate' | 'statement' | 'admit-card' | 'id-card'
export const KIND_LABEL: Record<TemplateKind, string> = {
  certificate: 'Certificate',
  statement: "Mark's statement",
  'admit-card': 'Admit card',
  'id-card': 'ID card',
}

export interface PrintTemplate {
  _id: string
  kind: TemplateKind
  name: string
  session: string
  course: { _id: string; name: string } | null
  duration: number | null
  image: string
  dx: number
  dy: number
  active: boolean
}

export function useTemplates(): PrintTemplate[] {
  const [list, setList] = useState<PrintTemplate[]>([])
  useEffect(() => {
    api<PrintTemplate[]>('/templates').then((r) => setList(r.filter((t) => t.active))).catch(() => undefined)
  }, [])
  return list
}

// Most specific template wins: a named course, then a course length (1 or 2 years), then the session, then one for everything.
export function pickTemplate(list: PrintTemplate[], kind: TemplateKind, session?: string, courseId?: string, duration?: number): PrintTemplate | undefined {
  let best: PrintTemplate | undefined
  let bestScore = -1
  for (const t of list) {
    if (t.kind !== kind) continue
    if (t.session && t.session !== session) continue
    if (t.course && t.course._id !== courseId) continue
    if (t.duration && t.duration !== duration) continue
    const score = (t.course ? 4 : 0) + (t.duration ? 2 : 0) + (t.session ? 1 : 0)
    if (score > bestScore) { best = t; bestScore = score }
  }
  return best
}
