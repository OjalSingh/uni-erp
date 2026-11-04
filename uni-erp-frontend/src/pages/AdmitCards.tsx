import Watermark from '../components/Watermark.tsx'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'
import PrintPage, { Selectable } from '../components/PrintPage.tsx'
import ScheduleSelect from '../components/ScheduleSelect.tsx'
import { INSTITUTE_NAME } from '../constants.ts'
import { errMsg, fmtDate } from '../format.ts'
import type { Schedule } from '../format.ts'

interface Card {
  _id: string
  rollNo: string
  part: number
  medium: string
  student: { enrollNo: string; name: string; fatherName: string; dob: string; image?: string }
  center: { code: string; name: string }
  course: { name: string }
  schedule: { examTerm: string; year: number }
}

export default function AdmitCards() {
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
          <article className="card admit wm-host">
            <Watermark />
            <header>
              <b>{INSTITUTE_NAME}</b>
              <span>
                Admit Card: {c.schedule.examTerm} {c.schedule.year} examination
              </span>
            </header>
            <div className="card-body">
              <dl>
                <dt>Roll No</dt>
                <dd>{c.rollNo}</dd>
                <dt>Name</dt>
                <dd>{c.student.name}</dd>
                <dt>Father's name</dt>
                <dd>{c.student.fatherName}</dd>
                <dt>Enrollment No</dt>
                <dd>{c.student.enrollNo}</dd>
                <dt>Date of birth</dt>
                <dd>{fmtDate(c.student.dob)}</dd>
                <dt>Course</dt>
                <dd>
                  {c.course.name}, Part {c.part}
                </dd>
                <dt>Medium</dt>
                <dd>{c.medium}</dd>
                <dt>Center</dt>
                <dd>
                  {c.center.code} - {c.center.name}
                </dd>
              </dl>
              {c.student.image ? <img className="card-photo" src={c.student.image} alt="" /> : <div className="card-photo blank">Photo</div>}
            </div>
            <footer>
              <span>Candidate's signature</span>
              <span>Controller of Examinations</span>
            </footer>
          </article>
        </Selectable>
      ))}
    </PrintPage>
  )
}
