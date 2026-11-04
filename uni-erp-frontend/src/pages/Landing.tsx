import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.ts'

interface PublicCourse {
  name: string
  durationYears?: number
  type?: string
}

// Shown if the course list cannot be loaded
const FALLBACK: PublicCourse[] = [
  { name: "NTT Pre-Primary Teacher's Training" },
  { name: 'Computer Teacher Training' },
  { name: 'Diploma in School Administration' },
  { name: 'Diploma in Computer Application' },
  { name: 'Certificate in Information Technology' },
  { name: 'Certificate in Web Development' },
  { name: 'Diploma in Advance Financial Accounts' },
  { name: 'Diploma in Advance Fashion Designing' },
  { name: 'Diploma in Advance Beautician' },
  { name: 'Diploma in Cutting and Tailoring' },
]

const length = (y?: number) => (y ? (y < 1 ? `${Math.round(y * 12)} months` : `${y} year${y > 1 ? 's' : ''}`) : '')

export default function Landing() {
  const [courses, setCourses] = useState<PublicCourse[]>(FALLBACK)

  useEffect(() => {
    api<PublicCourse[]>('/public/courses')
      .then((rows) => rows.length && setCourses(rows))
      .catch(() => undefined)
  }, [])

  return (
    <div className="lp">
      <div className="lp-top">
        <div className="lp-wrap">
          <span>Regd. by Govt. of NCT of Delhi · Regn. No. S60742 · An ISO 9001:2015 Certified organisation</span>
          <span>
            <Link to="/result">View Result</Link> &nbsp;|&nbsp; <Link to="/login">Centers Login</Link>
          </span>
        </div>
      </div>

      <header className="lp-head">
        <div className="lp-wrap">
          <a className="lp-logo" href="#top">
            <img src="/branding/seal.png" alt="" />
            AIECCE
          </a>
          <nav className="lp-nav" aria-label="Site">
            <a href="#courses">Courses</a>
            <a href="#results">Results</a>
            <a href="#centers">Study Centers</a>
            <a href="#contact">Contact</a>
          </nav>
          <Link className="lp-cta" to="/login">
            Centers Login
          </Link>
        </div>
      </header>

      <section className="lp-hero" id="top">
        <div className="lp-wrap">
          <div>
            <span className="lp-eyebrow">Early childhood care &amp; education</span>
            <h1>
              Build a career in <em>early childhood</em> care &amp; education
            </h1>
            <p className="lead">
              Advance Information in Early Childhood Care &amp; Education offers teacher training, computer and vocational diplomas through
              study centers across India, with a registered, ISO 9001:2015 certified institute behind every certificate.
            </p>
            <div className="lp-actions">
              <a className="lp-cta" href="#courses">
                Explore courses
              </a>
              <Link className="lp-ghost" to="/result">
                Check your result
              </Link>
            </div>
          </div>
          <aside className="lp-card" aria-label="Accreditation">
            <img src="/branding/seal.png" alt="AIECCE seal" />
            <h3>Registered &amp; certified</h3>
            <p>Regd. by Govt. of NCT of Delhi, Regn. No. S60742</p>
            <div className="lp-badges">
              <span className="lp-badge">ISO 9001:2015</span>
              <span className="lp-badge">UAF accredited</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="lp-band" aria-label="Highlights">
        <div className="lp-wrap">
          <div className="lp-feat">
            <span className="lp-ico" aria-hidden="true">🎓</span>
            <div>
              <h3>Recognised certificates</h3>
              <p>Certificates and mark statements issued with an enrollment number you can verify.</p>
            </div>
          </div>
          <div className="lp-feat">
            <span className="lp-ico" aria-hidden="true">📍</span>
            <div>
              <h3>Study centers</h3>
              <p>Learn at an authorised AIECCE study center near you.</p>
            </div>
          </div>
          <div className="lp-feat">
            <span className="lp-ico" aria-hidden="true">✅</span>
            <div>
              <h3>Results online</h3>
              <p>Look up your result any time with your roll number. No login needed.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-sec" id="courses">
        <div className="lp-wrap">
          <h2>Our courses</h2>
          <p className="lp-sub">Teacher training, computer and vocational programmes. Ask your nearest study center for fees and eligibility.</p>
          <div className="lp-courses">
            {courses.map((c) => (
              <article key={c.name} className="lp-course">
                {(c.durationYears || c.type) && <span className="lp-tag">{[c.type, length(c.durationYears)].filter(Boolean).join(' · ')}</span>}
                <h3>{c.name}</h3>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-sec alt" id="results">
        <div className="lp-wrap">
          <h2>Check your result in three steps</h2>
          <p className="lp-sub">Results are published online as soon as they are declared.</p>
          <div className="lp-steps">
            <div className="lp-step"><h3>Open the result page</h3><p>Choose “View Result” from the top of this page.</p></div>
            <div className="lp-step"><h3>Enter your roll number</h3><p>Type the roll number printed on your admit card, then the characters shown.</p></div>
            <div className="lp-step"><h3>View and print</h3><p>See your marks and division. Your study center can issue the printed statement.</p></div>
          </div>
          <p style={{ textAlign: 'center', marginTop: 32 }}>
            <Link className="lp-cta" to="/result">
              View Result
            </Link>
          </p>
        </div>
      </section>

      <section className="lp-sec" id="centers">
        <div className="lp-wrap">
          <h2>For study centers</h2>
          <p className="lp-sub">
            Register students, fill exam forms, print admit cards, ID cards and certificates, and track books and stock from one place.
          </p>
          <p style={{ textAlign: 'center' }}>
            <Link className="lp-cta" to="/login">
              Centers Login
            </Link>
          </p>
        </div>
      </section>

      <section className="lp-sec alt" id="contact">
        <div className="lp-wrap">
          <h2>Contact us</h2>
          <p className="lp-sub">Head office</p>
          <div className="lp-contact">
            <div>
              <h3>Address</h3>
              <p>2137, 3rd Floor, Main Old Bus Stand Road, Tri Nagar, New Delhi</p>
            </div>
            <div>
              <h3>Email</h3>
              <p><a href="mailto:info@nurseryteachertraining.com">info@nurseryteachertraining.com</a></p>
            </div>
            <div>
              <h3>Fax</h3>
              <p>+91 11-27383846<br />+91 11-27383847</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-foot">
        <div className="lp-wrap">
          <span>© {new Date().getFullYear()} Advance Information in Early Childhood Care &amp; Education. All rights reserved.</span>
          <span>
            <Link to="/result">View Result</Link> · <Link to="/login">Centers Login</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
