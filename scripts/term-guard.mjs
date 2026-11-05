import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BLOCKED = [{ length: 8, sha256: '6f7ac1823da81d2e52d1a1549ee69c85bbf8bb56d06682849e7c09da2785ce3b' }]
const README = 'Ini adalah repository untuk distribusi aplikasi kita, diakses bagi customer kita untuk di-download.'

const sha = (s) => createHash('sha256').update(s).digest('hex')
const hasBlocked = (value) => {
  const text = value.toLowerCase()
  return BLOCKED.some(({ length, sha256 }) => {
    for (let i = 0; i + length <= text.length; i += 1) if (sha(text.slice(i, i + length)) === sha256) return true
    return false
  })
}

const args = process.argv.slice(2)
const findings = []
let checked = 0
const check = (label, value) => {
  checked += 1
  if (hasBlocked(value)) findings.push(label)
}
const split = (raw) => {
  const at = raw.indexOf('=')
  if (at <= 0) throw new Error(`Expected <label>=<value>, got '${raw}'`)
  return [raw.slice(0, at), raw.slice(at + 1)]
}

for (let i = 0; i < args.length; i += 2) {
  const [flag, raw] = [args[i], args[i + 1]]
  if (raw === undefined) throw new Error(`Missing value for ${flag}`)
  if (flag === '--file') {
    const [label, path] = split(raw)
    check(`${label} (name)`, path.split(/[\\/]/u).pop())
    check(`${label} (content)`, readFileSync(path, 'utf8'))
  } else if (flag === '--text') {
    const [label, value] = split(raw)
    check(label, value)
  } else if (flag === '--repo') {
    const files = execFileSync('git', ['-C', raw, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
    for (const file of files) {
      const content = readFileSync(join(raw, file), 'utf8')
      if (file === 'README.md') {
        if (content.trim() !== README) findings.push('README.md content not allowed')
      } else if (/(^|\/)readme[^/]*$|\.(md|markdown|rst|adoc|txt)$/iu.test(file)) {
        findings.push(`doc file not allowed: ${file}`)
      }
      check(`repo path ${file}`, file)
      check(`repo file ${file}`, content)
    }
  } else {
    throw new Error(`Unknown flag ${flag}`)
  }
}

if (checked === 0) throw new Error('Nothing was checked')
if (findings.length > 0) {
  for (const f of findings) console.log(`::error::Term guard failed: ${f}`)
  process.exit(1)
}
console.log(`Term guard OK (${checked} items)`)
