import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'
import PrintPage, { Selectable } from '../components/PrintPage.tsx'
import { INSTITUTE_NAME, SESSIONS } from '../constants.ts'
import { errMsg, fmtDate } from '../format.ts'

interface Card {
  _id: string
  enrollNo: string
  name: string
  fatherName: string
  dob: string
  mobile: string
  image?: string
  session: string
  center: { code: string; name: string }
  course: { name: string }
}
interface CenterOpt {
  _id: string
  code: string
  name: string
}

export default function IdCards() {
  const { user } = useAuth()
  const [session, setSession] = useState(SESSIONS[1])
  const [center, setCenter] = useState('')
  const [centers, setCenters] = useState<CenterOpt[]>([])
  const [search, setSearch] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [skip, setSkip] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api<CenterOpt[]>('/centers').then(setCenters).catch(() => undefined)
  }, [])

  const load = useCallback(() => {
    setError('')
    api<Card[]>(`/students/id-cards?${new URLSearchParams({ session, center, search })}`)
      .then((c) => { setCards(c); setSkip([]) })
      .catch((e) => setError(errMsg(e)))
  }, [session, center, search])
  useEffect(load, [load])

  const toggle = (id: string) => setSkip((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <PrintPage
      title="ID Card Printing"
      controls={
        <>
          <label>
            Session{' '}
            <select value={session} onChange={(e) => setSession(e.target.value)}>
              {SESSIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {user?.role === 'admin' && (
            <label>
              Center{' '}
              <select value={center} onChange={(e) => setCenter(e.target.value)}>
                <option value="">All centers</option>
                {centers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <input placeholder="Search by name or enrollment no." aria-label="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
        </>
      }
      included={cards.length - skip.length}
      total={cards.length}
      error={error}
      empty="No active students found for these filters."
    >
      <div className="id-grid">
        {cards.map((c) => (
          <Selectable key={c._id} on={!skip.includes(c._id)} onToggle={() => toggle(c._id)} label={`${c.name} (${c.enrollNo})`}>
            <article className="card idcard">
              <header>
                <b>{INSTITUTE_NAME}</b>
                <span>Student identity card, {c.session}</span>
              </header>
              <div className="card-body">
                {c.image ? <img className="card-photo" src={c.image} alt="" /> : <div className="card-photo blank">Photo</div>}
                <dl>
                  <dt>Name</dt>
                  <dd>{c.name}</dd>
                  <dt>Enrollment No</dt>
                  <dd>{c.enrollNo}</dd>
                  <dt>Course</dt>
                  <dd>{c.course?.name}</dd>
                  <dt>Date of birth</dt>
                  <dd>{fmtDate(c.dob)}</dd>
                  <dt>Center</dt>
                  <dd>{c.center?.code}</dd>
                  <dt>Mobile</dt>
                  <dd>{c.mobile}</dd>
                </dl>
              </div>
              <footer>
                <span>Authorised signatory</span>
              </footer>
            </article>
          </Selectable>
        ))}
      </div>
    </PrintPage>
  )
}
