import { pickTemplate, useTemplates } from '../templates.ts'
import type { PrintTemplate } from '../templates.ts'
import Watermark from '../components/Watermark.tsx'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'
import PrintPage, { Selectable } from '../components/PrintPage.tsx'
import ScheduleSelect from '../components/ScheduleSelect.tsx'
import { INSTITUTE_NAME } from '../constants.ts'
import { errMsg } from '../format.ts'
import type { Schedule } from '../format.ts'
import { divisionText, durationWords, pct } from '../result.ts'
import type { Final, PartOne, ResultSummary } from '../result.ts'

interface SubjectMark {
  subject: string
  code?: string
  type: 'Theory' | 'Practical'
  maxMarks: number
  marks: number
}
interface Cert {
  _id: string
  rollNo?: string
  part: number
  subjectMarks: SubjectMark[]
  student: { enrollNo: string; name: string; fatherName?: string }
  course: { _id: string; name: string; parts: number; durationYears?: number; courseType?: { name: string } }
  schedule: { examTerm: string; year: number; session?: string }
  result: ResultSummary
  final: Final | null
  partOne: PartOne | null
}

type Mode = 'stationery' | 'plain' | 'template'
const SETTINGS_KEY = 'uni-erp-certificate-print'
const today = () => new Date().toLocaleDateString('en-IN')
const titleCase = (s = '') => s.split(' ').map((w) => (w.includes('(') ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ')
const DIVISION_KEY = 'I Div.-60% & Above * II Div.-45% & Above * III Div.-33% & Above'

function Logo({ src }: { src: string }) {
  const [ok, setOk] = useState(true)
  return ok ? <img className="sheet-logo" src={src} alt="" onError={() => setOk(false)} /> : <span className="sheet-logo" />
}

// Everything marked "pre" is printed on the stationery already; in stationery mode it keeps its place but is not printed.
function Header({ session }: { session?: string }) {
  return (
    <header className="sheet-band pre">
      <Logo src="/branding/seal.png" />
      <div className="sheet-wordmark">
        <b>A.I.E.C.C.E.</b>
        <span>Advance Information in Early Childhood Care &amp; Education N.Delhi</span>
        <small>An ISO 9001:2015 Certified. Regd. by Govt. of NCT of Delhi Regn. No.: S60742</small>
      </div>
      <Logo src="/branding/uaf.png" />
      {session && <span className="sheet-year">YEAR {session.replace('-', ' - 20')}</span>}
    </header>
  )
}

function IdLine({ c }: { c: Cert }) {
  return (
    <div className="sheet-idline">
      <span>
        <span className="pre">Enrollment No. </span>
        <b>{c.student.enrollNo}</b>
      </span>
      <span>
        <span className="pre">Roll No. </span>
        <b>{c.rollNo}</b>
      </span>
    </div>
  )
}

function Titles({ c, title }: { c: Cert; title: string }) {
  return (
    <div className="pre sheet-titles">
      <h1>{INSTITUTE_NAME}</h1>
      <h2>{titleCase(c.course.courseType?.name)}</h2>
      <div className="sheet-rule">
        <span>{title}</span>
      </div>
      <h3>{c.course.name}</h3>
    </div>
  )
}

export function CertificateSheet({ c, mode, dx, dy, template }: { c: Cert; mode: Mode; dx: number; dy: number; template?: PrintTemplate }) {
  const duration = durationWords(c.course.durationYears)
  const theory = c.subjectMarks.filter((s) => s.type === 'Theory')
  const practical = c.subjectMarks.filter((s) => s.type === 'Practical')
  const multi = c.course.parts > 1
  return (
    <section className={`sheet ${mode}`} style={template ? { backgroundImage: `url(${template.image})` } : undefined}>
      <Watermark className="pre" />
      <div className="sheet-inner" style={{ transform: `translate(${dx + (template?.dx ?? 0)}mm, ${dy + (template?.dy ?? 0)}mm)` }}>
        <Header session={c.schedule.session} />
        <IdLine c={c} />
        <Titles c={c} title="Certificate" />
        <p className="sheet-body">
          <span className="pre">This is to certify that </span>
          <u>{c.student.name}</u>
          <br />
          <span className="pre">D/o, S/o Shri </span>
          <u>{c.student.fatherName}</u>
          <span className="pre">
            {' '}
            has qualified the Final Examination as a regular/correspondence trainee of the {duration ? `${duration} ` : ''}diploma course in {c.course.name}
            {c.schedule.session ? ` in ${c.schedule.session} Session` : ''}.{' '}
          </span>
          <br />
          {multi ? (
            <>
              <span className="pre">She/He was placed in </span>
              <u>{c.final?.division}</u>
              <span className="pre"> Division in the Final Examination (all parts together).</span>
            </>
          ) : (
            <>
              <span className="pre">She/He was placed in </span>
              <u>{c.result.theory.division}</u>
              <span className="pre"> Division in Theory Paper and </span>
              <u>{c.result.practical.division}</u>
              <span className="pre"> Division in Practicals.</span>
            </>
          )}
        </p>
        <div className="pre sheet-subjects">
          <h4>Subjects of Training Course :</h4>
          {theory.length > 0 && (
            <p>
              <i>Theory :</i> {theory.map((s) => `* ${s.subject}`).join(' ')}
            </p>
          )}
          {practical.length > 0 && (
            <p>
              <i>Practical :</i> {practical.map((s) => `* ${s.subject}`).join(' ')}
            </p>
          )}
        </div>
        <footer className="sheet-foot">
          <span>
            <span className="pre">Date : </span>
            {today()}
          </span>
          <span className="pre">Chairman</span>
          <span className="pre">Secretary</span>
        </footer>
        <div className="sheet-key pre">{DIVISION_KEY}</div>
      </div>
    </section>
  )
}

export function StatementSheet({ c, mode, dx, dy, template }: { c: Cert; mode: Mode; dx: number; dy: number; template?: PrintTemplate }) {
  const rows = (type: SubjectMark['type']) => c.subjectMarks.filter((s) => s.type === type)
  const group = (type: SubjectMark['type'], b: ResultSummary['theory']) => (
    <>
      <tr className="stmt-section">
        <td colSpan={4}>{type}</td>
      </tr>
      {rows(type).map((s, i) => (
        <tr key={type + i}>
          <td>{s.code}</td>
          <td>{s.subject}</td>
          <td>{s.maxMarks}</td>
          <td>{s.marks}</td>
        </tr>
      ))}
      <tr className="stmt-sub">
        <td colSpan={2}>{type} total</td>
        <td>{b.max}</td>
        <td>{b.obtained}</td>
      </tr>
    </>
  )
  return (
    <section className={`sheet ${mode}`} style={template ? { backgroundImage: `url(${template.image})` } : undefined}>
      <Watermark className="pre" />
      <div className="sheet-inner" style={{ transform: `translate(${dx + (template?.dx ?? 0)}mm, ${dy + (template?.dy ?? 0)}mm)` }}>
        <Header session={c.schedule.session} />
        <IdLine c={c} />
        <Titles c={c} title="Mark's Statement" />
        <dl className="stmt-who">
          <dt>Name</dt>
          <dd>{c.student.name}</dd>
          <dt>Father's name</dt>
          <dd>{c.student.fatherName}</dd>
          {c.course.parts > 1 && (
            <>
              <dt>Part</dt>
              <dd>
                {c.part} of {c.course.parts}
              </dd>
            </>
          )}
        </dl>
        <table className="stmt-table">
          <thead>
            <tr>
              <th>Paper</th>
              <th>Subject</th>
              <th>Max. marks</th>
              <th>Marks obtained</th>
            </tr>
          </thead>
          <tbody>
            {rows('Theory').length > 0 && group('Theory', c.result.theory)}
            {rows('Practical').length > 0 && group('Practical', c.result.practical)}
            <tr className="stmt-total">
              <td colSpan={2}>Grand total</td>
              <td>{c.result.total.max}</td>
              <td>{c.result.total.obtained}</td>
            </tr>
          </tbody>
        </table>
        <dl className="stmt-result">
          <dt>Percentage</dt>
          <dd>{pct(c.result.total.percent)}</dd>
          <dt>Theory</dt>
          <dd>
            {pct(c.result.theory.percent)}, {divisionText(c.result.theory.division)}
          </dd>
          <dt>Practical</dt>
          <dd>
            {pct(c.result.practical.percent)}, {divisionText(c.result.practical.division)}
          </dd>
          <dt>Result</dt>
          <dd>
            <b>{c.result.qualified ? divisionText(c.result.total.division) : 'Not qualified'}</b>
          </dd>
          {c.partOne && (
            <>
              <dt>Part 1</dt>
              <dd>
                {c.partOne.obtained} of {c.partOne.total}
              </dd>
            </>
          )}
          {c.final && (
            <>
              <dt>All parts together</dt>
              <dd>
                {c.final.obtained} of {c.final.max} ({pct(c.final.percent)}), {divisionText(c.final.division)}
              </dd>
            </>
          )}
        </dl>
        <footer className="sheet-foot stmt-foot">
          <span>
            <span className="pre">Date : </span>
            {today()}
          </span>
          <span className="pre">Checked By :</span>
          <span className="pre">Sign &amp; Stamp Centre Incharge</span>
          <span className="pre">Controller (exam)</span>
        </footer>
        <div className="sheet-key pre">{DIVISION_KEY}</div>
      </div>
    </section>
  )
}

function Notice({ children }: { children: string }) {
  return <p className="cert-notice no-print">{children}</p>
}

export default function Certificates() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedule, setSchedule] = useState('')
  const [search, setSearch] = useState('')
  const [certs, setCerts] = useState<Cert[]>([])
  const [skip, setSkip] = useState<string[]>([])
  const [error, setError] = useState('')
  const templates = useTemplates()
  const [settings, setSettings] = useState<{ mode: Mode; dx: number; dy: number }>(() => {
    try {
      return { mode: 'template', dx: 0, dy: 0, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }
    } catch {
      return { mode: 'template', dx: 0, dy: 0 }
    }
  })

  const update = (patch: Partial<typeof settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) } catch { /* storage unavailable: settings last for this visit */ }
  }

  useEffect(() => {
    api<Schedule[]>('/certificates/schedules').then(setSchedules).catch((e) => setError(errMsg(e)))
  }, [])

  const load = useCallback(() => {
    if (!schedule) return
    setError('')
    api<Cert[]>(`/certificates?${new URLSearchParams({ schedule, search })}`)
      .then((c) => { setCerts(c); setSkip([]) })
      .catch((e) => setError(errMsg(e)))
  }, [schedule, search])
  useEffect(load, [load])

  const toggle = (id: string) => setSkip((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <PrintPage
      title="Certificate Printing"
      controls={
        <>
          <ScheduleSelect schedules={schedules} value={schedule} onChange={setSchedule} />
          <input placeholder="Search by name, enrollment or roll no." aria-label="Search certificates" value={search} onChange={(e) => setSearch(e.target.value)} />
          <fieldset className="print-mode">
            <legend>Print on</legend>
            <label>
              <input type="radio" name="mode" checked={settings.mode === 'template'} onChange={() => update({ mode: 'template' })} /> Uploaded template for the session and course (built-in design if none)
            </label>
            <label>
              <input type="radio" name="mode" checked={settings.mode === 'stationery'} onChange={() => update({ mode: 'stationery' })} /> Pre-printed stationery (fills in the blanks only)
            </label>
            <label>
              <input type="radio" name="mode" checked={settings.mode === 'plain'} onChange={() => update({ mode: 'plain' })} /> Plain A4 (full design)
            </label>
            <label>
              Move right (mm) <input type="number" step="0.5" style={{ width: 70 }} value={settings.dx} onChange={(e) => update({ dx: Number(e.target.value) || 0 })} />
            </label>
            <label>
              Move down (mm) <input type="number" step="0.5" style={{ width: 70 }} value={settings.dy} onChange={(e) => update({ dy: Number(e.target.value) || 0 })} />
            </label>
          </fieldset>
        </>
      }
      included={certs.length - skip.length}
      total={certs.length}
      error={error}
      empty={schedules.length === 0 ? 'No results have been published yet. Publish a result first.' : 'No marks entered for this schedule.'}
    >
      {certs.map((c) => {
        const label = `${c.student.name} (${c.rollNo})`
        const finalPart = c.part === c.course.parts
        const tplFor = (kind: 'certificate' | 'statement') => (settings.mode === 'template' ? pickTemplate(templates, kind, c.schedule.session, c.course._id) : undefined)
        const modeFor = (t?: PrintTemplate): Mode => (settings.mode === 'template' ? (t ? 'template' : 'plain') : settings.mode)
        const certTpl = tplFor('certificate')
        const stmtTpl = tplFor('statement')
        const canCertify = !c.result.incomplete && c.result.qualified && finalPart && (c.course.parts === 1 || c.final)
        return (
          <Selectable key={c._id} on={!skip.includes(c._id)} onToggle={() => toggle(c._id)} label={label}>
            {c.result.incomplete ? (
              <Notice>{`${label}: marks are missing for ${c.result.missingPapers} paper(s). Complete the marks before printing.`}</Notice>
            ) : (
              <>
                {canCertify ? <CertificateSheet c={c} mode={modeFor(certTpl)} template={certTpl} dx={settings.dx} dy={settings.dy} /> : (
                  <Notice>
                    {!c.result.qualified ? `${label}: did not qualify, so only the mark statement is printed.` : !finalPart ? `${label}: a certificate is issued after the final part, so only the mark statement is printed.` : `${label}: Part 1 marks are not on record, so only the mark statement is printed.`}
                  </Notice>
                )}
                <StatementSheet c={c} mode={modeFor(stmtTpl)} template={stmtTpl} dx={settings.dx} dy={settings.dy} />
              </>
            )}
          </Selectable>
        )
      })}
    </PrintPage>
  )
}
