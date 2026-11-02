// Single source of truth for sidebar + dashboard. Modules are grouped by the job they do.
export interface ModuleDef {
  path: string
  label: string
  note: string
  group: string
  built: boolean
}

export const MODULES: ModuleDef[] = [
  { path: 'students', label: 'Student Registration', note: 'Register and update students', group: 'Admissions', built: true },
  { path: 'centers', label: 'Center Details', note: 'Study centers and their contacts', group: 'Admissions', built: true },
  { path: 'employees', label: 'Employee Details', note: 'Staff records', group: 'Admissions', built: true },
  { path: 'exam-form', label: 'Fill Exam Form', note: 'Enter students for an exam', group: 'Examinations', built: true },
  { path: 'marks', label: 'Mark Information', note: 'Record theory and practical marks', group: 'Examinations', built: true },
  { path: 'admit-cards', label: 'Admit Card details', note: 'Admit cards for an exam', group: 'Examinations', built: false },
  { path: 'results', label: 'Publish Result', note: 'Release results', group: 'Examinations', built: true },
  { path: 'certificates', label: 'Certificate Printing', note: 'Print certificates', group: 'Documents', built: false },
  { path: 'id-cards', label: 'ID Card Printing', note: 'Print student ID cards', group: 'Documents', built: false },
  { path: 'books', label: 'Book Allocated', note: 'Course books allocated', group: 'Resources', built: false },
  { path: 'stock', label: 'Stock Details', note: 'Stock records', group: 'Resources', built: false },
  { path: 'change-password', label: 'Change Password', note: 'Update your login password', group: 'Account', built: false },
]

export const GROUPS = ['Admissions', 'Examinations', 'Documents', 'Resources', 'Account']

// Master-data screens under "Miscellaneous"
export const MISC = ['Course Type', 'Course Details', 'Subject Details', 'User Role', 'Financial year', 'State', 'City', 'Menu', 'Sub Menu']
