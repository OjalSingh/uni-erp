export default function Placeholder({ title }: { title: string }) {
  return (
    <>
      <h1 className="page-title">{title}</h1>
      <section className="panel empty">
        <p>This screen has not been built yet.</p>
      </section>
    </>
  )
}
