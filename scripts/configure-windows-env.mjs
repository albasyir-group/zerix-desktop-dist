import { existsSync, writeFileSync } from 'node:fs'

const target = 'apps/desktop/.env.windows'
if (!existsSync('apps/desktop/package.json')) throw new Error('Run from the source root')
if (existsSync(target)) throw new Error(`${target} already exists; refusing to overwrite`)

// The packaged app polls `<PROD_ORIGIN>/api/v0/check_client_update` anonymously and shows a full-screen
// "update required" block; the download link must be on an allowedPageOrigins origin or the button is hidden. The
// backend's NUXT_DESKTOP_MIN_VERSION decides who is blocked. AUTO_UPDATE_ENV=production only selects that policy.
const lines = [
  'DSH_DESKTOP_APP_ID=com.zerix.internal-preview',
  'DSH_DESKTOP_AUTO_UPDATE_ENV=production',
  'DSH_DESKTOP_MANDATORY_UPDATE_PROD_ORIGIN=https://api.foreasy.life',
  `DSH_DESKTOP_MANDATORY_UPDATE_CONFIG='${JSON.stringify({ allowedPageOrigins: ['https://foreasy.life', 'https://github.com'] })}'`,
]
writeFileSync(target, `${lines.join('\n')}\n`, { mode: 0o600 })
console.log(`Wrote ${target}`)
