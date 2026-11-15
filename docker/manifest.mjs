#!/usr/bin/env node
// Write a package.json that installs the Zerix CLI from local npm tarballs.
//
// Usage: node manifest.mjs <out-dir> <tarball-dir>...
//
// The root is the packed package that ships the `zerix` bin. Every packed
// package it reaches through dependencies, peerDependencies or
// optionalDependencies is pinned to its local tarball, so npm never fetches
// those from the registry; everything else comes from the npm registry.
// Packages outside that closure are left out to keep the image small.
import { execFileSync } from 'node:child_process'
import { readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const [outDir, ...inputs] = process.argv.slice(2)
if (!outDir || inputs.length === 0) {
  console.error('usage: manifest.mjs <out-dir> <tarball-dir>...')
  process.exit(2)
}

const packed = new Map()
for (const dir of inputs) {
  for (const file of readdirSync(dir).filter(name => name.endsWith('.tgz')).sort()) {
    const tarball = resolve(dir, file)
    const manifest = JSON.parse(execFileSync('tar', ['-xOzf', tarball, 'package/package.json'], { encoding: 'utf8' }))
    if (packed.has(manifest.name)) throw new Error(`duplicate tarball for ${manifest.name}`)
    packed.set(manifest.name, { tarball, manifest })
  }
}

const roots = [...packed.values()].filter(({ manifest }) => manifest.bin && typeof manifest.bin === 'object' && 'zerix' in manifest.bin)
if (roots.length !== 1) throw new Error(`expected exactly one tarball with a zerix bin, found ${roots.length}`)
const root = roots[0].manifest

const selected = new Set()
const visit = (name) => {
  if (selected.has(name) || !packed.has(name)) return
  selected.add(name)
  const { manifest } = packed.get(name)
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const dependency of Object.keys(manifest[section] ?? {})) visit(dependency)
  }
}
visit(root.name)

// The subprocess-local package ships native addons (node-pty, koffi), so its
// name is derived from the packed set instead of being hardcoded.
const subprocessLocal = [...selected].filter(name => name.endsWith('/dsh-subprocess-local'))
if (subprocessLocal.length !== 1) throw new Error(`expected exactly one selected */dsh-subprocess-local package, found ${subprocessLocal.length}`)

const dependencies = Object.fromEntries([...selected].sort().map(name => [name, `file:${packed.get(name).tarball}`]))
writeFileSync(join(outDir, 'package.json'), `${JSON.stringify({
  name: 'zerix-image',
  version: root.version,
  private: true,
  type: 'module',
  dependencies,
  allowScripts: {
    koffi: true,
    'node-pty': true,
    [subprocessLocal[0]]: true,
    protobufjs: false,
    '@google/genai': false,
  },
}, null, 2)}\n`)
console.log(`zerix ${root.version}: ${selected.size} of ${packed.size} packed packages selected`)
