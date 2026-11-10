import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [partsDir, outDir] = process.argv.slice(2)
const { TAG: tag, SOURCE_SHA: sourceSha, GITHUB_REPOSITORY: repo, GITHUB_SERVER_URL: server, GITHUB_RUN_ID: runId } = process.env
if (!partsDir || !outDir || !tag || !/^[0-9a-f]{40}$/u.test(sourceSha ?? '')) throw new Error('usage/env invalid')

const targets = ['win-x64', 'mac-arm64']
const entries = targets.map(target => {
  const provenance = JSON.parse(readFileSync(join(partsDir, `provenance-${target}.json`), 'utf8'))
  const line = readFileSync(join(partsDir, `sha256-${target}.txt`), 'utf8').trim()
  const [sha256, file] = line.split(/\s+/u)
  if (provenance.source.tag !== tag || provenance.source.commit !== sourceSha) throw new Error(`${target}: provenance source mismatch`)
  if (provenance.sha256 !== sha256 || provenance.file !== file) throw new Error(`${target}: checksum/provenance mismatch`)
  return provenance
})
const [first] = entries
if (entries.some(e => JSON.stringify(e.origins) !== JSON.stringify(first.origins))) throw new Error('origins differ between targets')

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'SHA256SUMS'), entries.map(e => `${e.sha256}  ${e.file}\n`).join(''))
writeFileSync(join(outDir, 'provenance.json'), JSON.stringify({
  source: first.source,
  origins: first.origins,
  signing: 'unsigned',
  autoUpdate: false,
  buildRun: `${server}/${repo}/actions/runs/${runId}`,
  artifacts: entries,
}, null, 2) + '\n')

const label = { 'win-x64': 'Windows x64 installer', 'mac-arm64': 'macOS Apple Silicon (arm64) disk image' }
writeFileSync(join(outDir, 'NOTES.md'), [
  `**Zerix ${tag} — UNSIGNED build**`,
  '',
  `Source: \`${tag}\` @ \`${sourceSha}\``,
  `Platform: ${first.origins.platform} · Inference: ${first.origins.inference}`,
  `Build run: ${server}/${repo}/actions/runs/${runId}`,
  '',
  '**Download:** Windows → `Zerix-Setup-x64.exe` · macOS (Apple Silicon) → `Zerix-arm64.dmg`',
  '',
  '| File | Platform | SHA-256 |',
  '|---|---|---|',
  ...entries.map(e => `| \`${e.file}\` | ${label[e.target]} | \`${e.sha256}\` |`),
  '',
  '> These installers are **not code-signed or notarized** and have **no auto-update**.',
  '> Windows: SmartScreen → **More info → Run anyway**. macOS: **System Settings → Privacy & Security → Open Anyway**.',
  '> Verify before installing: `shasum -a 256 -c SHA256SUMS --ignore-missing` (macOS/Linux) or `Get-FileHash <file> -Algorithm SHA256` (Windows).',
  '',
].join('\n'))
console.log(readFileSync(join(outDir, 'SHA256SUMS'), 'utf8'))
