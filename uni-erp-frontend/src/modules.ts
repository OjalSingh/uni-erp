// Single source of truth for sidebar + dashboard. Modules are grouped by the job they do.
export interface ModuleDef {
  path: string
  label: string
  note: string
  group: string
  built: boolean
  perm?: string // the permission that opens this screen (none = everyone)
}

export const MODULES: ModuleDef[] = [
  { path: 'students', label: 'Student Registration', note: 'Register and update students', group: 'Admissions', built: true, perm: 'students:view' },
  { path: 'centers', label: 'Center Details', note: 'Study centers and their contacts', group: 'Admissions', built: true, perm: 'centers:view' },
  { path: 'employees', label: 'Employee Details', note: 'Staff records', group: 'Admissions', built: true, perm: 'employees:manage' },
  { path: 'exam-form', label: 'Fill Exam Form', note: 'Enter students for an exam', group: 'Examinations', built: true, perm: 'exams:view' },
  { path: 'marks', label: 'Mark Information', note: 'Record theory and practical marks', group: 'Examinations', built: true, perm: 'marks:view' },
  { path: 'admit-cards', label: 'Admit Card details', note: 'Admit cards for an exam', group: 'Examinations', built: true, perm: 'admitcards:print' },
  { path: 'results', label: 'Publish Result', note: 'Release results', group: 'Examinations', built: true, perm: 'results:view' },
  { path: 'certificates', label: 'Certificate Printing', note: 'Print certificates', group: 'Documents', built: true, perm: 'certificates:print' },
  { path: 'id-cards', label: 'ID Card Printing', note: 'Print student ID cards', group: 'Documents', built: true, perm: 'idcards:print' },
  { path: 'books', label: 'Book Allocated', note: 'Course books allocated', group: 'Resources', built: true, perm: 'invoices:view' },
  { path: 'stock', label: 'Stock Details', note: 'Stock records', group: 'Resources', built: true, perm: 'stock:view' },
  { path: 'change-password', label: 'Change Password', note: 'Update your login password', group: 'Account', built: true },
]

export const GROUPS = ['Admissions', 'Examinations', 'Documents', 'Resources', 'Account']

// Master-data screens under "Miscellaneous"
export const MISC = ['Course Type', 'Course Details', 'Subject Details', 'Print Templates', 'User Role', 'Financial year', 'State', 'City', 'Menu', 'Sub Menu']
