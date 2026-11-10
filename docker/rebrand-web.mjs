#!/usr/bin/env node
// Replace the upstream browser branding in the installed web frontend.
//
// Usage: node rebrand-web.mjs <install-dir> <brand-png>
//
// Locates <install-dir>/node_modules/*/*-web-frontend/dist and rewrites the
// page title, the web manifest names and the favicon. Fails loudly when an
// expected file or pattern is missing so upstream changes are noticed.
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [installDir, brandPng] = process.argv.slice(2)
if (!installDir || !brandPng) {
  console.error('usage: rebrand-web.mjs <install-dir> <brand-png>')
  process.exit(2)
}
const fail = (message) => {
  console.error(`rebrand-web: ${message}`)
  process.exit(1)
}

const modules = join(installDir, 'node_modules')
const dists = []
for (const scope of readdirSync(modules, { withFileTypes: true })) {
  if (!scope.isDirectory()) continue
  for (const pkg of readdirSync(join(modules, scope.name), { withFileTypes: true })) {
    if (pkg.isDirectory() && pkg.name.endsWith('-web-frontend')) {
      const dist = join(modules, scope.name, pkg.name, 'dist')
      if (existsSync(dist)) dists.push(dist)
    }
  }
}
if (dists.length !== 1) fail(`expected exactly one */*-web-frontend/dist, found ${dists.length}`)
const dist = dists[0]
if (!existsSync(brandPng)) fail(`brand image not found: ${brandPng}`)

// index.html: title and favicon links
const indexPath = join(dist, 'index.html')
if (!existsSync(indexPath)) fail('index.html not found')
let html = readFileSync(indexPath, 'utf8')

if (!/<title>[^<]*<\/title>/.test(html)) fail('<title> not found in index.html')
html = html.replace(/<title>[^<]*<\/title>/, '<title>Zerix</title>')

const iconLink = /[ \t]*<link\s+rel="icon"[^>]*>[ \t]*\r?\n?/g
const iconCount = (html.match(iconLink) ?? []).length
if (iconCount === 0) fail('no <link rel="icon"> found in index.html')
let first = true
html = html.replace(iconLink, (match) => {
  if (!first) return ''
  first = false
  const indent = match.match(/^[ \t]*/)[0]
  return `${indent}<link rel="icon" type="image/png" href="./favicon.png" />\n`
})
writeFileSync(indexPath, html)

copyFileSync(brandPng, join(dist, 'favicon.png'))

// manifest.webmanifest: names and icons
const manifestPath = join(dist, 'manifest.webmanifest')
if (!existsSync(manifestPath)) fail('manifest.webmanifest not found')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (!('name' in manifest) || !('short_name' in manifest) || !Array.isArray(manifest.icons)) {
  fail('manifest.webmanifest lacks name, short_name or icons')
}
manifest.name = 'Zerix'
manifest.short_name = 'Zerix'
manifest.icons = [{ src: 'favicon.png', sizes: 'any', type: 'image/png', purpose: 'any' }]
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`rebranded ${dist} (${iconCount} icon link(s) collapsed)`)
