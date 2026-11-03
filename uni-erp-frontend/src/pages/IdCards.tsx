import Watermark from '../components/Watermark.tsx'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'
import PrintPage, { Selectable } from '../components/PrintPage.tsx'
import { INSTITUTE_NAME } from '../constants.ts'
import { useSessions } from '../lookups.ts'
import { errMsg, fmtDate } from '../format.ts'

interface Card {
  _id: string
  enrollNo: string
  name: string
  fatherName: string
  dob: string
  mobile: string
  address?: string
  city?: string
  pinCode?: string
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
  const { sessions, current, loaded } = useSessions()
  const [session, setSession] = useState('')
  useEffect(() => { if (loaded && !session) setSession(current) }, [loaded, current, session])
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
    if (!session) return
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
              {sessions.map((s) => (
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
            <article className="idcard2 wm-host">
              <Watermark />
              <div className="id2-head">
                <b>{INSTITUTE_NAME}</b>
                <small>Regd. by Govt. of NCT, New Delhi</small>
              </div>
              <div className="id2-title">Identity Card {c.session}</div>
              <div className="id2-row">
                <span>Enrollment No <b>{c.enrollNo}</b></span>
                <span>Centre Code <b>{c.center?.code}</b></span>
              </div>
              <div className="id2-course">Course Name : {c.course?.name}</div>
              {c.image ? <img className="id2-photo" src={c.image} alt="" /> : <div className="id2-photo blank">Photo</div>}
              <div className="id2-name">{c.name}</div>
              <div className="id2-line"><em>Father's Name :</em> {c.fatherName}</div>
              <div className="id2-line"><em>Address :</em> {[c.address, c.city, c.pinCode].filter(Boolean).join(', ')}</div>
              <div className="id2-line"><em>Mob. :</em> {c.mobile}</div>
              <div className="id2-foot">{c.center?.name}</div>
            </article>
          </Selectable>
        ))}
      </div>
    </PrintPage>
  )
}
