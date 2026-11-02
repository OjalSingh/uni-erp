export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '')
export const toInputDate = (iso?: string) => (iso ? iso.slice(0, 10) : '')
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong')

export interface Schedule {
  _id: string
  examId: number
  examTerm: string
  year: number
  formStart: string
  formEnd: string
}
export const scheduleLabel = (s: Schedule) => `Exam ${s.examId}: ${s.examTerm} ${s.year}`

export interface Paged<T> {
  items: T[]
  total: number
  page: number
  pages: number
}

export const fmtMoney = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
