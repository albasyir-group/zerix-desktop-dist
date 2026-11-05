import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, createReadStream, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const env = process.env
const target = env.DESKTOP_TARGET
const extension = env.DESKTOP_EXTENSION
const expected = { 'win-x64': 'exe', 'mac-arm64': 'dmg' }
if (expected[target] === undefined || expected[target] !== extension) throw new Error(`Invalid target/extension ${target}/${extension}`)
if (!/^[0-9a-f]{40}$/u.test(env.SOURCE_SHA ?? '')) throw new Error('SOURCE_SHA missing/invalid')
if (!/^zerix-v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$/u.test(env.TAG ?? '')) throw new Error('TAG missing/invalid')
if (!env.RUNNER_TEMP || !/^[1-9][0-9]*$/u.test(env.GITHUB_RUN_ID ?? '')) throw new Error('Runner context missing')
const origin = /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/u
const origins = { platform: env.DEFAULT_PLATFORM_ORIGIN, inference: env.DEFAULT_INFERENCE_ORIGIN }
if (!origin.test(origins.platform ?? '') || !origin.test(origins.inference ?? '')) throw new Error('Origins missing/invalid')

const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (head !== env.SOURCE_SHA) throw new Error(`Checked-out source ${head} differs from tag commit ${env.SOURCE_SHA}`)

const source = resolve(`apps/desktop/.desktop-build/targets/${target}/unsigned-artifacts`)
const installers = readdirSync(source).filter(name => name.endsWith(`-unsigned.${extension}`))
if (installers.length !== 1) throw new Error(`Expected exactly one *-unsigned.${extension}; found ${installers.length}`)
const built = installers[0]
if (!statSync(join(source, built)).isFile()) throw new Error('Installer is not a regular file')

const file = { 'win-x64': 'Zerix-Setup-x64.exe', 'mac-arm64': 'Zerix-arm64.dmg' }[target]

const output = resolve(env.RUNNER_TEMP, 'zerix-stage')
mkdirSync(output, { recursive: true })
copyFileSync(join(source, built), join(output, file))
const size = statSync(join(output, file)).size
const sha256 = await new Promise((done, fail) => {
  const hash = createHash('sha256')
  createReadStream(join(output, file)).on('data', c => hash.update(c)).on('error', fail).on('end', () => done(hash.digest('hex')))
})

writeFileSync(join(output, `sha256-${target}.txt`), `${sha256}  ${file}\n`)
writeFileSync(join(output, `provenance-${target}.json`), JSON.stringify({
  target,
  file,
  size,
  sha256,
  signing: 'unsigned',
  autoUpdate: false,
  origins,
  source: { repository: env.SOURCE_REPOSITORY, tag: env.TAG, commit: env.SOURCE_SHA },
  build: {
    repository: env.GITHUB_REPOSITORY,
    workflowRef: env.GITHUB_WORKFLOW_REF,
    workflowSha: env.GITHUB_SHA,
    runId: env.GITHUB_RUN_ID,
    runAttempt: env.GITHUB_RUN_ATTEMPT,
    runUrl: `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`,
    runner: env.RUNNER_LABEL,
  },
}, null, 2) + '\n')
console.log(`Staged ${file} (${size} bytes) sha256=${sha256}`)
