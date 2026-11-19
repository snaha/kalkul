// Fails when a dependency or override names a range instead of an exact version
// (AGENTS.md, "Dependency versions are exact"): `pnpm check-versions`.
import fs from 'fs'

import { type Manifest, isExactOverride, lockfileOverrides, manifestRanges } from './exact-versions'

const MANIFEST = 'package.json'
const LOCKFILE = 'pnpm-lock.yaml'

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Manifest
const violations = manifestRanges(manifest).map(([where, spec]) => `${MANIFEST} ${where} "${spec}"`)
for (const [selector, spec] of Object.entries(
  lockfileOverrides(fs.readFileSync(LOCKFILE, 'utf8'), LOCKFILE),
)) {
  if (!isExactOverride(spec)) violations.push(`${LOCKFILE} overrides ${selector} "${spec}"`)
}

if (violations.length > 0) {
  console.error(`Not an exact version (${violations.length}):`)
  for (const violation of violations) console.error(`  ${violation}`)
  console.error(
    '\nPin each to the exact version the lockfile resolves, e.g. "^4.3.6" -> "4.3.6". An override may also reference a direct dependency, "$name". Fix an override in pnpm-workspace.yaml, then run pnpm install.',
  )
  process.exit(1)
}

console.log('All dependency versions are exact.')
