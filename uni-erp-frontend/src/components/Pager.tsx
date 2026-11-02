export default function Pager({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  return (
    <div className="pager">
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span>
        Page {page} of {pages || 1} ({total} records)
      </span>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  )
}
