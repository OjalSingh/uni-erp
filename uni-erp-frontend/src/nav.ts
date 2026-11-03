import { useEffect, useState } from 'react'
import { api } from './api.ts'
import { useAuth } from './auth.tsx'
import { MISC, MODULES } from './modules.ts'

export interface NavMenu {
  key: string
  label: string
  group: string
  order: number
  submenus: { label: string }[]
}

// Used until (or unless) the server's menu list arrives
const fallback = (can: (...p: string[]) => boolean): NavMenu[] => {
  const menus: NavMenu[] = MODULES.filter((m) => !m.perm || can(m.perm)).map((m, i) => ({ key: m.path, label: m.label, group: m.group, order: i, submenus: [] }))
  if (can('settings:manage')) menus.push({ key: 'misc', label: 'Miscellaneous', group: 'Resources', order: 99, submenus: MISC.map((label) => ({ label })) })
  return menus
}

export function useNavigation(): NavMenu[] {
  const { user, can } = useAuth()
  const [menus, setMenus] = useState<NavMenu[]>(() => fallback(can))

  useEffect(() => {
    if (!user) return
    api<NavMenu[]>('/config/navigation')
      .then((rows) => { if (rows.length) setMenus(rows) })
      .catch(() => setMenus(fallback(can)))
  }, [user])

  return menus
}
