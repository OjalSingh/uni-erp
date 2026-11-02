import { useEffect } from 'react'
import { scheduleLabel } from '../format.ts'
import type { Schedule } from '../format.ts'

// Controlled select; the parent owns the list so it can refresh after creating a schedule
export default function ScheduleSelect({ schedules, value, onChange }: { schedules: Schedule[]; value: string; onChange: (id: string) => void }) {
  useEffect(() => {
    if (!value && schedules[0]) onChange(schedules[0]._id)
  }, [schedules, value, onChange])

  return (
    <label>
      Exam schedule{' '}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {schedules.length === 0 && <option value="">No schedules yet</option>}
        {schedules.map((s) => (
          <option key={s._id} value={s._id}>
            {scheduleLabel(s)}
          </option>
        ))}
      </select>
    </label>
  )
}
