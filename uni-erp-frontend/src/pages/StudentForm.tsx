import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, getToken } from '../api.ts'
import { useAuth } from '../auth.tsx'
import { INDIAN_STATES, SESSIONS } from '../constants.ts'

interface Option {
  _id: string
  name: string
  code?: string
}
interface Qualification {
  examination: string
  board: string
  year: string
  division: string
}

const blankQual = (): Qualification => ({ examination: '', board: '', year: '', division: '' })

interface FormState {
  center: string
  session: string
  examTerm: string
  name: string
  fatherName: string
  mobile: string
  email: string
  courseType: string
  course: string
  gender: string
  dob: string
  nationality: string
  address: string
  state: string
  city: string
  pinCode: string
  image: string
  status: string
  qualifications: Qualification[]
}

const initial: FormState = {
  center: '',
  session: SESSIONS[0],
  examTerm: '',
  name: '',
  fatherName: '',
  mobile: '',
  email: '',
  courseType: '',
  course: '',
  gender: '',
  dob: '',
  nationality: 'Indian',
  address: '',
  state: '',
  city: '',
  pinCode: '',
  image: '',
  status: 'Active',
  qualifications: Array.from({ length: 6 }, blankQual),
}

// API returns populated refs on GET; the form works with plain ids
const idOf = (v: unknown): string => (v && typeof v === 'object' ? (v as { _id: string })._id : ((v as string) ?? ''))

export default function StudentForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [form, setForm] = useState<FormState>(initial)
  const [enrollNo, setEnrollNo] = useState('')
  const [centers, setCenters] = useState<Option[]>([])
  const [courseTypes, setCourseTypes] = useState<Option[]>([])
  const [courses, setCourses] = useState<Option[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  // Lookups
  useEffect(() => {
    api<Option[]>('/centers').then((c) => {
      setCenters(c)
      // A center login can only register into its own center
      if (user?.role === 'center' && c[0]) set('center', c[0]._id)
    })
    api<Option[]>('/masters/course-types').then(setCourseTypes)
  }, [user])

  // Dependent course dropdown
  useEffect(() => {
    if (!form.courseType) {
      setCourses([])
      return
    }
    api<Option[]>(`/masters/courses?courseType=${form.courseType}`).then(setCourses)
  }, [form.courseType])

  // Preview the enrollment number on a new registration
  useEffect(() => {
    if (editing) return
    api<{ enrollNo: string }>(`/students/next-enroll-no?session=${form.session}`).then((r) => setEnrollNo(r.enrollNo))
  }, [editing, form.session])

  // Load existing record for Modify
  useEffect(() => {
    if (!id) return
    api<Record<string, unknown>>(`/students/${id}`)
      .then((s) => {
        setEnrollNo(String(s.enrollNo))
        const quals = ((s.qualifications as Qualification[]) ?? []).slice(0, 6)
        while (quals.length < 6) quals.push(blankQual())
        setForm({
          center: idOf(s.center),
          session: String(s.session),
          examTerm: String(s.examTerm ?? ''),
          name: String(s.name ?? ''),
          fatherName: String(s.fatherName ?? ''),
          mobile: String(s.mobile ?? ''),
          email: String(s.email ?? ''),
          courseType: idOf(s.courseType),
          course: idOf(s.course),
          gender: String(s.gender ?? ''),
          dob: s.dob ? String(s.dob).slice(0, 10) : '',
          nationality: String(s.nationality ?? ''),
          address: String(s.address ?? ''),
          state: String(s.state ?? ''),
          city: String(s.city ?? ''),
          pinCode: String(s.pinCode ?? ''),
          image: String(s.image ?? ''),
          status: String(s.status ?? 'Active'),
          qualifications: quals,
        })
      })
      .catch((e: Error) => setError(e.message))
  }, [id])

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return
    setError('')
    const fd = new FormData()
    fd.append('photo', file)
    const res = await fetch('/api/uploads/photo', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return setError(data.message ?? 'Upload failed')
    set('image', data.path)
  }

  const setQual = (i: number, key: keyof Qualification, value: string) =>
    setForm((f) => ({ ...f, qualifications: f.qualifications.map((q, idx) => (idx === i ? { ...q, [key]: value } : q)) }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^\d{10}$/.test(form.mobile)) return setError('Mobile number must be 10 digits')
    setBusy(true)
    try {
      // Drop empty qualification rows
      const qualifications = form.qualifications.filter((q) => q.examination || q.board || q.year || q.division)
      const body = { ...form, qualifications }
      if (editing) await api(`/students/${id}`, { method: 'PUT', body })
      else await api('/students', { method: 'POST', body })
      navigate('/students')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    <div className="page-head">
      <h1 className="page-title">{editing ? 'Modify registration' : 'New registration'}</h1>
      <Link to="/students" className="btn-back">
        Back to students
      </Link>
    </div>
    <section className="panel">
      <form className="reg-form" onSubmit={submit}>
        <p className="hint">Labels in red are required.</p>

        <div className="row">
          <label>Enrollment No</label>
          <input value={enrollNo} readOnly />
          <label className="req">Exam Term</label>
          <span className="inline">
            {['May-June', 'Nov-Dec'].map((t) => (
              <label key={t}>
                <input type="radio" required name="term" checked={form.examTerm === t} onChange={() => set('examTerm', t)} /> {t}
              </label>
            ))}
          </span>
          <label className="req">Session</label>
          <select value={form.session} disabled={editing} onChange={(e) => set('session', e.target.value)}>
            {SESSIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="row">
          <label className="req">Center Name</label>
          <select required value={form.center} disabled={user?.role === 'center'} onChange={(e) => set('center', e.target.value)}>
            <option value="">Select center name</option>
            {centers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <label className="req">Student Name</label>
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} />
          <label className="req">Father Name</label>
          <input required value={form.fatherName} onChange={(e) => set('fatherName', e.target.value)} />
        </div>

        <div className="row">
          <label className="req">Student Mobile No</label>
          <input required inputMode="numeric" maxLength={10} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
          <label>Student Email ID</label>
          <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        </div>

        <div className="row">
          <label className="req">Course Type</label>
          <select
            required
            value={form.courseType}
            onChange={(e) => {
              set('courseType', e.target.value)
              set('course', '')
            }}
          >
            <option value="">Select Course Type</option>
            {courseTypes.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="req">Course Name</label>
          <select required value={form.course} onChange={(e) => set('course', e.target.value)}>
            <option value="">--Select Course--</option>
            {courses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <label className="req">Gender</label>
          <span className="inline">
            {['Male', 'Female', 'Transgender'].map((g) => (
              <label key={g}>
                <input type="radio" required name="gender" checked={form.gender === g} onChange={() => set('gender', g)} /> {g}
              </label>
            ))}
          </span>
          <label className="req">Date of Birth</label>
          <input required type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} />
          <label className="req">Nationality</label>
          <input required value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
        </div>

        <h2>Address and photo</h2>
        <div className="row">
          <label>Address</label>
          <textarea rows={2} value={form.address} onChange={(e) => set('address', e.target.value)} />
        </div>
        <div className="row">
          <label>State</label>
          <select value={form.state} onChange={(e) => set('state', e.target.value)}>
            <option value="">Select State</option>
            {INDIAN_STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label>City</label>
          <input value={form.city} onChange={(e) => set('city', e.target.value)} />
          <label>Pin Code</label>
          <input inputMode="numeric" maxLength={6} value={form.pinCode} onChange={(e) => set('pinCode', e.target.value)} />
        </div>
        <div className="row">
          <label>Upload Image</label>
          <input type="file" accept="image/png,image/jpeg,image/gif" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
          {form.image && <img className="thumb" src={form.image} alt="Student" />}
          <span className="hint red">Passport-size photo. gif, jpeg or png, up to 500 KB.</span>
        </div>

        <h2>Academic qualifications</h2>
        <table className="grid">
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Name of Examination</th>
              <th>Board/University</th>
              <th>Year</th>
              <th>Division</th>
            </tr>
          </thead>
          <tbody>
            {form.qualifications.map((q, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>
                  <input value={q.examination} onChange={(e) => setQual(i, 'examination', e.target.value)} />
                </td>
                <td>
                  <input value={q.board} onChange={(e) => setQual(i, 'board', e.target.value)} />
                </td>
                <td>
                  <input maxLength={4} value={q.year} onChange={(e) => setQual(i, 'year', e.target.value)} />
                </td>
                <td>
                  <input value={q.division} onChange={(e) => setQual(i, 'division', e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row">
          <label className="req">Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option>Active</option>
            <option>Inactive</option>
          </select>
        </div>

        {error && <p className="err pad">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn-save" disabled={busy}>
            {busy ? 'Saving...' : 'Save registration'}
          </button>
        </div>
      </form>
    </section>
    </>
  )
}
