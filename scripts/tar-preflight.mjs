import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const base = resolve(process.env.RUNNER_TEMP ?? '.')
const dir = mkdtempSync(join(base, 'tar-preflight-'))
mkdirSync(join(dir, 'package'))
writeFileSync(join(dir, 'package', 'package.json'), JSON.stringify({ name: 'tar-preflight', version: '0.0.0' }))

const run = (args, cwd) => {
  const result = spawnSync('tar', args, { cwd, encoding: 'utf8', env: process.env, windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`tar ${args.join(' ')} failed (${result.status}): ${result.stderr}`)
  return result.stdout
}

console.log(`tar: ${run(['--version'], dir).split('\n')[0]}; TAR_OPTIONS=${process.env.TAR_OPTIONS ?? '(unset)'}`)
run(['-czf', 'probe.tgz', 'package'], dir)
const absolute = join(dir, 'probe.tgz')
const manifest = JSON.parse(run(['-xOzf', absolute, 'package/package.json'], dir))
if (manifest.name !== 'tar-preflight') throw new Error('tar preflight: unexpected manifest content')
console.log('tar preflight OK')
