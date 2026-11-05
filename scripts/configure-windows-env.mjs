import { existsSync, writeFileSync } from 'node:fs'

const target = 'apps/desktop/.env.windows'
if (!existsSync('apps/desktop/package.json')) throw new Error('Run from the source root')
if (existsSync(target)) throw new Error(`${target} already exists; refusing to overwrite`)

const lines = [
  'DSH_DESKTOP_APP_ID=com.zerix.internal-preview',
  'DSH_DESKTOP_AUTO_UPDATE_ENV=test',
  'DSH_DESKTOP_MANDATORY_UPDATE_TEST_ORIGIN=https://preview.invalid',
  `DSH_DESKTOP_MANDATORY_UPDATE_CONFIG='${JSON.stringify({ allowedAuthOrigins: ['https://login.invalid'] })}'`,
]
writeFileSync(target, `${lines.join('\n')}\n`, { mode: 0o600 })
console.log(`Wrote ${target}`)
