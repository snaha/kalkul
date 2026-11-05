export interface VersionRecord {
  version: number
  shape: string
}

/** Why `current` cannot replace `base`, or undefined when it can. */
export function versionBumpProblem(
  base: VersionRecord,
  current: VersionRecord,
): string | undefined {
  if (current.version < base.version) {
    return `version went down from ${base.version} to ${current.version}`
  }
  if (current.shape !== base.shape && current.version === base.version) {
    return `the stored data shape changed but version is still ${current.version}`
  }
  return undefined
}
