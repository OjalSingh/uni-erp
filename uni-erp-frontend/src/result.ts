// Mirrors the server's result rules (60% / 45% / 33%) for live totals while marks are typed. The server's figures are the ones that are saved and printed.
export const divisionFor = (percent: number) => (percent >= 60 ? 'I' : percent >= 45 ? 'II' : percent >= 33 ? 'III' : 'Fail')

export interface Block {
  max: number
  obtained: number
  percent: number | null
  division: string | null
}
export interface ResultSummary {
  theory: Block
  practical: Block
  total: Block
  qualified: boolean
  incomplete?: boolean
  missingPapers?: number
}
export interface PartOne {
  total: number
  obtained: number
}
export interface Final {
  max: number
  obtained: number
  percent: number | null
  division: string | null
}

export const divisionText = (d: string | null | undefined) => (!d ? '-' : d === 'Fail' ? 'Not qualified' : `${d} Division`)
export const pct = (p: number | null | undefined) => (p == null ? '-' : `${p.toFixed(2)}%`)

export function block(rows: { maxMarks: number; marks: number }[]): Block {
  const max = rows.reduce((s, r) => s + r.maxMarks, 0)
  const obtained = rows.reduce((s, r) => s + r.marks, 0)
  const percent = max > 0 ? (obtained / max) * 100 : null
  return { max, obtained, percent, division: percent === null ? null : divisionFor(percent) }
}

export const durationWords = (years?: number) => {
  if (!years) return ''
  if (years < 1) return `${Math.round(years * 12)} month`
  const words: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four' }
  return `${words[years] ?? years} year`
}
