export default function Placeholder({ title }: { title: string }) {
  return (
    <section className="panel">
      <div className="panel-head">{title}</div>
      <p style={{ padding: 16 }}>This module has not been built yet.</p>
    </section>
  )
}
