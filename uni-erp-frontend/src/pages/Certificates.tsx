import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'
import PrintPage, { Selectable } from '../components/PrintPage.tsx'
import ScheduleSelect from '../components/ScheduleSelect.tsx'
import { INSTITUTE_NAME } from '../constants.ts'
import { errMsg } from '../format.ts'
import type { Schedule } from '../format.ts'

interface Cert {
  _id: string
  rollNo: string
  part: number
  theoryMarks: number
  practicalMarks: number
  totalMarks: number
  student: { enrollNo: string; name: string; fatherName: string; image?: string }
  course: { name: string }
  schedule: { examTerm: string; year: number }
}

export default function Certificates() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [schedule, setSchedule] = useState('')
  const [search, setSearch] = useState('')
  const [certs, setCerts] = useState<Cert[]>([])
  const [skip, setSkip] = useState<string[]>([])
  const [error, setError] = useState('')

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
        </>
      }
      included={certs.length - skip.length}
      total={certs.length}
      error={error}
      empty={schedules.length === 0 ? 'No results have been published yet. Publish a result first.' : 'No marks entered for this schedule.'}
    >
      {certs.map((c) => (
        <Selectable key={c._id} on={!skip.includes(c._id)} onToggle={() => toggle(c._id)} label={`${c.student.name} (${c.rollNo})`}>
          <article className="card certificate">
            <header>
              <b>{INSTITUTE_NAME}</b>
              <span>Certificate of examination</span>
            </header>
            <p>
              This is to certify that <b>{c.student.name}</b>, child of {c.student.fatherName}, enrollment number {c.student.enrollNo}, appeared in the{' '}
              {c.schedule.examTerm} {c.schedule.year} examination for <b>{c.course.name}</b> (Part {c.part}) under roll number {c.rollNo}.
            </p>
            <table className="marks-table">
              <tbody>
                <tr>
                  <th>Theory marks</th>
                  <td>{c.theoryMarks}</td>
                </tr>
                <tr>
                  <th>Practical marks</th>
                  <td>{c.practicalMarks}</td>
                </tr>
                <tr>
                  <th>Total marks</th>
                  <td>{c.totalMarks}</td>
                </tr>
              </tbody>
            </table>
            <footer>
              <span>Date of issue</span>
              <span>Controller of Examinations</span>
            </footer>
          </article>
        </Selectable>
      ))}
    </PrintPage>
  )
}
