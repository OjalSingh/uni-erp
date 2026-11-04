import Watermark from '../components/Watermark.tsx'
import { Fragment, useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { pickTemplate, useTemplates } from '../templates.ts'
import type { PrintTemplate } from '../templates.ts'
import { api } from '../api.ts'
import PrintPage, { Selectable } from '../components/PrintPage.tsx'
import ScheduleSelect from '../components/ScheduleSelect.tsx'
import { errMsg } from '../format.ts'
import type { Schedule } from '../format.ts'

interface Card {
  _id: string
  rollNo: string
  part: number
  medium: string
  student: { enrollNo: string; name: string; fatherName: string; dob: string; image?: string }
  center: { code: string; name: string }
  course: { _id: string; name: string; code?: string }
  schedule: { examTerm: string; year: number; session?: string }
}

const W = 1600
const H = 1115
// Positions are taken from the printed admit card (1600 x 1115 px) and stored as percentages of the page
const box = (x0: number, y0: number, x1: number, y1: number): CSSProperties => ({
  left: `${(x0 / W) * 100}%`, top: `${(y0 / H) * 100}%`, width: `${((x1 - x0) / W) * 100}%`, height: `${((y1 - y0) / H) * 100}%`,
})
const FIELDS = [
  { label: 'Roll No.', fs: 5.2, lab: [14, 415, 193, 485], val: [193, 415, 455, 485] },
  { label: 'Enrollment No.', fs: 4.4, lab: [745, 412, 1046, 482], val: [1046, 412, 1325, 482] },
  { label: 'Centre Code', fs: 3.7, lab: [14, 508, 193, 577], val: [193, 508, 358, 577] },
  { label: 'Course Code', fs: 4.8, lab: [743, 506, 1016, 576], val: [1016, 506, 1144, 576] },
  { label: 'Course Name', fs: 5.2, lab: [14, 600, 317, 670], val: [317, 600, 1354, 670] },
] as const
const LINES = [
  { n: '1. Name of Candidate', y: 700, from: 390, to: 1492 },
  { n: "2. Father's Name", y: 800, from: 312, to: 1497 },
  { n: '3. Name of Examination Centre', y: 900, from: 545, to: 1504 },
] as const

function BrandLogo({ src }: { src: string }) {
  const [ok, setOk] = useState(true)
  return ok ? <img src={src} alt="" onError={() => setOk(false)} /> : <span />
}

// Everything in "pre" is printed on the blank admit card already (or in an uploaded template) and is left out in that case.
export function AdmitSheet({ c, template }: { c: Card; template?: PrintTemplate }) {
  const session = c.schedule.session || String(c.schedule.year)
  const values = [c.rollNo, c.student.enrollNo, c.center.code, c.course.code || '', c.course.name + (c.part > 1 ? `, Part ${c.part}` : '')]
  return (
    <article className={`admit2 ${template ? 'template' : ''}`} style={template ? { backgroundImage: `url(${template.image})` } : undefined}>
      <Watermark className="pre" />
      <div className="pre a2-art">
        <div className="a2-logo a2-seal" style={box(15, 25, 270, 270)}><BrandLogo src="/branding/seal.png" /></div>
        <div className="a2-word" style={box(360, 30, 1260, 320)}>
          <b>A.I.E.C.C.E.</b>
          <span>Advance Information in Early Childhood Care &amp; Education N.Delhi</span>
          <small>(ISO 9001 : 2015 Certified)</small>
          <i>Regd. by Govt. of NCT, New Delhi Regn. No. : S-60742</i>
        </div>
        <div className="a2-iso" style={box(1327, 60, 1600, 90)}>ISO 9001 : 2015 CERTIFIED</div>
        <div className="a2-logo a2-uaf" style={box(1327, 87, 1600, 245)}><BrandLogo src="/branding/uaf.png" /></div>
        <div className="a2-sno" style={box(1290, 0, 1420, 30)}>S.No.</div>
        <div className="a2-banner" style={box(505, 335, 1117, 393)}>Admit Card ({session})</div>
        {FIELDS.map((f) => (
          <Fragment key={f.label}>
            <div className="a2-label" style={{ ...box(...f.lab), fontSize: `${f.fs}mm` }}>{f.label}</div>
            <div className="a2-valbox" style={box(...f.val)} />
          </Fragment>
        ))}
        <div className="a2-photobox" style={box(1366, 318, 1582, 552)}>Affix Your Passport Size Photograph</div>
        {LINES.map((l) => (
          <Fragment key={l.n}>
            <div className="a2-q" style={box(10, l.y, l.from, l.y + 50)}>{l.n}</div>
            <div className="a2-dots" style={box(l.from, l.y, l.to, l.y + 38)} />
          </Fragment>
        ))}
        <div className="a2-sign" style={box(25, 1038, 420, 1068)}>Fill Signature of the Candidate</div>
        <div className="a2-sign" style={box(605, 1038, 1010, 1068)}>Signature of the Centre Incharge</div>
        <div className="a2-sign a2-ctrl" style={box(1230, 1038, 1580, 1100)}>Controller of Examination<small>(for Office Use Only)</small></div>
        <div className="a2-note" style={box(22, 1076, 628, 1110)}><b>Note.:</b> TO BE FILLED THE CANDIDATE EXCEPT ROLL NO.</div>
      </div>
      {FIELDS.map((f, i) => (
        <div key={f.label} className={`a2-val ${f.label === 'Course Name' ? 'a2-small' : ''}`} style={box(...f.val)}>{values[i]}</div>
      ))}
      <div className="a2-photo" style={box(1366, 318, 1582, 552)}>{c.student.image && <img src={c.student.image} alt="" />}</div>
      <div className="a2-fill" style={box(395, 690, 1492, 742)}>{c.student.name}</div>
      <div className="a2-fill" style={box(318, 790, 1497, 842)}>{c.student.fatherName}</div>
      <div className="a2-fill" style={box(550, 890, 1504, 942)}>{c.center.code} - {c.center.name}</div>
    </article>
  )
}

export default function AdmitCards() {
  const templates = useTemplates()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedule, setSchedule] = useState('')
  const [search, setSearch] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [skip, setSkip] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<Schedule[]>('/exams/schedules').then(setSchedules).catch((e) => setError(errMsg(e)))
  }, [])

  const load = useCallback(() => {
    if (!schedule) return
    setError('')
    api<Card[]>(`/exams/admit-cards?${new URLSearchParams({ schedule, search })}`)
      .then((c) => { setCards(c); setSkip([]) })
      .catch((e) => setError(errMsg(e)))
  }, [schedule, search])
  useEffect(load, [load])

  const toggle = (id: string) => setSkip((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <PrintPage
      title="Admit Card"
      controls={
        <>
          <ScheduleSelect schedules={schedules} value={schedule} onChange={setSchedule} />
          <input placeholder="Search by name, enrollment or roll no." aria-label="Search admit cards" value={search} onChange={(e) => setSearch(e.target.value)} />
        </>
      }
      included={cards.length - skip.length}
      total={cards.length}
      error={error}
      empty="No accepted exam forms for this schedule. Accept forms under Fill Exam Form first."
    >
      {cards.map((c) => (
        <Selectable key={c._id} on={!skip.includes(c._id)} onToggle={() => toggle(c._id)} label={`${c.student.name} (${c.rollNo})`}>
          <AdmitSheet c={c} template={pickTemplate(templates, 'admit-card', c.schedule.session, c.course._id)} />
        </Selectable>
      ))}
    </PrintPage>
  )
}
