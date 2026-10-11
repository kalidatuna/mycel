// Restores the demo vault's file modification times (git does not keep them).
import { existsSync, readFileSync, utimesSync } from 'node:fs'
import { join } from 'node:path'

const datesFile = new URL('./demo-dates.json', import.meta.url)
const root = new URL('../demo-vault/', import.meta.url).pathname
if (existsSync(datesFile)) {
  const dates = JSON.parse(readFileSync(datesFile, 'utf8'))
  let n = 0
  for (const [path, iso] of Object.entries(dates)) {
    const abs = join(root, path)
    if (!existsSync(abs)) continue
    const t = new Date(iso)
    utimesSync(abs, t, t)
    n++
  }
  console.log(`mycel: restored dates on ${n} demo notes`)
}
