import { Fragment, useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { INSTITUTE_NAME } from '../constants.ts'
import { fmtDate } from '../format.ts'
import { divisionText, pct } from '../result.ts'
import type { Final, PartOne, ResultSummary } from '../result.ts'

interface Status {
  requireDob: boolean
  open: { publishId: number; label: string }[]
  upcoming: { publishDate: string; label: string } | null
}
interface Statement {
  exam: string
  rollNo: string
  part: number
  student: { name: string; fatherName?: string; enrollNo: string }
  course: { name: string; type?: string; parts: number }
  subjects: { code?: string; name: string; type: 'Theory' | 'Practical'; maxMarks: number; marks: number }[]
  result: ResultSummary & { incomplete?: boolean }
  partOne: PartOne | null
  final: Final | null
}
interface Captcha {
  token: string
  svg: string
}

// This page is for students and has no login, so it talks to the public API directly
async function pub<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/public${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message ?? 'Something went wrong. Please try again.')
  return data as T
}

export function StatementCard({ s }: { s: Statement }) {
  const rows = (t: 'Theory' | 'Practical') => s.subjects.filter((x) => x.type === t)
  if (s.result.incomplete) {
    return (
      <article className="pub-card">
        <h2>{s.exam}</h2>
        <p>
          <b>{s.student.name}</b>, roll number {s.rollNo}
        </p>
        <p className="pub-warn">Your result is not complete yet. Please contact your center.</p>
      </article>
    )
  }
  return (
    <article className="pub-card">
      <h2>{s.exam}</h2>
      <dl className="pub-who">
        <dt>Name</dt><dd>{s.student.name}</dd>
        <dt>Father's name</dt><dd>{s.student.fatherName}</dd>
        <dt>Enrollment No</dt><dd>{s.student.enrollNo}</dd>
        <dt>Roll No</dt><dd>{s.rollNo}</dd>
        <dt>Course</dt><dd>{s.course.name}{s.course.parts > 1 ? ` (Part ${s.part} of ${s.course.parts})` : ''}</dd>
      </dl>
      <table className="grid">
        <thead>
          <tr><th>Paper</th><th>Subject</th><th>Max. marks</th><th>Marks obtained</th></tr>
        </thead>
        <tbody>
          {(['Theory', 'Practical'] as const).map((t) => rows(t).length > 0 && (
            <Fragment key={t}>
              <tr className="grid-section"><td colSpan={4}>{t}</td></tr>
              {rows(t).map((x, i) => <tr key={t + i}><td>{x.code}</td><td>{x.name}</td><td>{x.maxMarks}</td><td>{x.marks}</td></tr>)}
            </Fragment>
          ))}
          <tr className="stmt-total"><td colSpan={2}><b>Total</b></td><td><b>{s.result.total.max}</b></td><td><b>{s.result.total.obtained}</b></td></tr>
        </tbody>
      </table>
      <dl className="pub-summary">
        <dt>Percentage</dt><dd>{pct(s.result.total.percent)}</dd>
        <dt>Theory</dt><dd>{pct(s.result.theory.percent)}, {divisionText(s.result.theory.division)}</dd>
        <dt>Practical</dt><dd>{pct(s.result.practical.percent)}, {divisionText(s.result.practical.division)}</dd>
        <dt>Result</dt><dd><b>{s.result.qualified ? divisionText(s.result.total.division) : 'Not qualified'}</b></dd>
        {s.partOne && (<><dt>Part 1</dt><dd>{s.partOne.obtained} of {s.partOne.total}</dd></>)}
        {s.final && (<><dt>All parts together</dt><dd>{s.final.obtained} of {s.final.max} ({pct(s.final.percent)}), {divisionText(s.final.division)}</dd></>)}
      </dl>
      <p className="hint no-print">This is not a certificate. Your original mark statement and certificate come from your center.</p>
    </article>
  )
}

export default function Result() {
  const [status, setStatus] = useState<Status | null>(null)
  const [captcha, setCaptcha] = useState<Captcha | null>(null)
  const [rollNo, setRollNo] = useState('')
  const [dob, setDob] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [statements, setStatements] = useState<Statement[] | null>(null)

  const newCaptcha = useCallback(() => {
    setAnswer('')
    pub<Captcha>('/captcha').then(setCaptcha).catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    pub<Status>('/result-status').then(setStatus).catch((e: Error) => setError(e.message))
    newCaptcha()
  }, [newCaptcha])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!captcha) return
    setError('')
    setBusy(true)
    setStatements(null)
    try {
      const r = await pub<{ statements: Statement[] }>('/result', { rollNo, dob, captchaToken: captcha.token, captchaAnswer: answer })
      setStatements(r.statements)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
      newCaptcha() // each picture works once
    }
  }

  const isOpen = (status?.open.length ?? 0) > 0

  return (
    <div className="pub">
      <header className="pub-head no-print">
        <h1>{INSTITUTE_NAME}</h1>
        <p>Check your examination result</p>
      </header>

      <main className="pub-main">
        {status && !isOpen && (
          <p className="pub-banner no-print" role="status">
            {status.upcoming ? `Results will be declared on ${fmtDate(status.upcoming.publishDate)}.` : 'No result is available right now.'}
          </p>
        )}
        {isOpen && status && (
          <p className="pub-banner ok-banner no-print" role="status">
            Results available: {status.open.map((o) => o.label).join(', ')}
          </p>
        )}

        <form className="pub-form no-print" onSubmit={submit}>
          <label htmlFor="roll">Roll number</label>
          <input id="roll" inputMode="numeric" autoComplete="off" maxLength={10} value={rollNo} onChange={(e) => setRollNo(e.target.value.replace(/\D/g, ''))} required />
          {status?.requireDob && (
            <>
              <label htmlFor="dob">Date of birth (dd/mm/yyyy)</label>
              <input id="dob" placeholder="dd/mm/yyyy" autoComplete="off" value={dob} onChange={(e) => setDob(e.target.value)} required />
            </>
          )}
          <label htmlFor="cap">Type the number shown</label>
          <div className="pub-captcha">
            {captcha ? <img src={`data:image/svg+xml;utf8,${encodeURIComponent(captcha.svg)}`} alt="Number to type" width={180} height={56} /> : <span className="hint">Loading picture...</span>}
            <button type="button" className="btn-quiet" onClick={newCaptcha}>Show another</button>
          </div>
          <input id="cap" inputMode="numeric" autoComplete="off" maxLength={6} value={answer} onChange={(e) => setAnswer(e.target.value.replace(/\D/g, ''))} required />
          {error && <p className="err" role="alert">{error}</p>}
          <button type="submit" className="btn-primary" disabled={busy || !isOpen || !rollNo || answer.length !== 6}>{busy ? 'Checking...' : 'Get result'}</button>
        </form>

        {statements?.map((s) => <StatementCard key={s.exam + s.part} s={s} />)}
        {statements && <p className="no-print"><button className="btn-quiet" onClick={() => window.print()}>Print this result</button></p>}
      </main>
    </div>
  )
}
