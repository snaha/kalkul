import { execFileSync } from 'child_process'
import fs from 'fs'

import { type VersionRecord, versionBumpProblem } from './data-version-bump'

const RECORD_PATH = 'src/lib/stored-data-version.json'
const BASE_REF = 'origin/main'

function baseRecord(): VersionRecord | undefined {
  try {
    const json = execFileSync('git', ['show', `${BASE_REF}:${RECORD_PATH}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return JSON.parse(json)
  } catch {
    return undefined
  }
}

const base = baseRecord()
const current: VersionRecord = JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8'))
const problem = base && versionBumpProblem(base, current)

if (problem) {
  console.error(`${RECORD_PATH}: ${problem}, compared with ${BASE_REF}`)
  process.exit(1)
}
