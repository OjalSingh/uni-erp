// Single source of truth for sidebar + dashboard tiles. Mirrors the AIECCE admin panel.
export interface ModuleDef {
  path: string
  label: string
  color: string
  built: boolean
}

export const MODULES: ModuleDef[] = [
  { path: 'students', label: 'Student Registration', color: '#26a8e4', built: true },
  { path: 'employees', label: 'Employee Details', color: '#2cb673', built: false },
  { path: 'exam-form', label: 'Fill Exam Form', color: '#d9532f', built: false },
  { path: 'centers', label: 'Center Details', color: '#ffb546', built: true },
  { path: 'marks', label: 'Mark Information', color: '#22499e', built: false },
  { path: 'certificates', label: 'Certificate Printing', color: '#26a8e4', built: false },
  { path: 'id-cards', label: 'ID Card Printing', color: '#2cb673', built: false },
  { path: 'admit-cards', label: 'Admit Card details', color: '#d9532f', built: false },
  { path: 'results', label: 'Publish Result', color: '#ffb546', built: false },
  { path: 'books', label: 'Book Allocated', color: '#22499e', built: false },
  { path: 'stock', label: 'Stock Details', color: '#26a8e4', built: false },
  { path: 'change-password', label: 'Change Password', color: '#2cb673', built: false },
]

// Master-data screens under "Miscellaneous"
export const MISC = ['Course Type', 'Course Details', 'Subject Details', 'User Role', 'Financial year', 'State', 'City', 'Menu', 'Sub Menu']
