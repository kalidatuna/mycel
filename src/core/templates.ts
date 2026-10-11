const pad = (n: number) => String(n).padStart(2, '0')

export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const isoTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Fill `{{date}}`, `{{time}}` and `{{title}}` placeholders. Unknown placeholders are left as-is. */
export function applyTemplate(template: string, vars: { title: string; date?: Date }): string {
  const d = vars.date ?? new Date()
  return template.replace(/\{\{\s*(date|time|title)\s*\}\}/gi, (_, k: string) => {
    const key = k.toLowerCase()
    return key === 'date' ? isoDate(d) : key === 'time' ? isoTime(d) : vars.title
  })
}

export const DAILY_FOLDER = 'Daily'
export const TEMPLATE_FOLDER = 'Templates'
export const dailyNotePath = (d: Date) => `${DAILY_FOLDER}/${isoDate(d)}.md`
