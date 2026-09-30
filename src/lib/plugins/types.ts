import type { Component } from 'svelte'
import type { addMessages } from 'svelte-i18n'

/** One locale's translations, as svelte-i18n takes them. */
type Dictionary = Parameters<typeof addMessages>[1]

/**
 * The plugin contract. A plugin is a self-contained folder under
 * `src/lib/plugins/<id>/` whose `index.ts` builds one of these; the app lists
 * it in `registry.ts` and only ever talks to it through this shape. A plugin
 * reaches the app only through the `PluginHost` it is given, never by
 * importing app modules.
 *
 * Every part is optional except the identity and translations: the app
 * renders the parts a plugin provides, at fixed places, and only while the
 * plugin is active (enabled on the dev page and available here).
 */
export interface KalkulPlugin {
  /** Stable id, also the key it is enabled under. kebab-case. */
  id: string
  /** For the dev page, which is not localised. */
  name: string
  description: string
  /** Why it cannot run in this build or browser; undefined when it can. */
  unavailableReason?: string
  /** Translations merged into the app's, by locale code. Namespace keys under `plugins.<id>`. */
  messages: Record<string, Dictionary>
  /** Background work while active. Returns the cleanup. */
  start?: () => () => void
  /** Mounted once in the root layout while active (its own dialogs, overlays). */
  root?: Component
  /** A small item in the navbar (e.g. a status). */
  navbar?: Component<{ class?: string }>
  /** A section of the settings page, after Backup. */
  settings?: {
    /** The sidebar label. */
    label: Component
    /** The section body, including its heading. */
    section: Component
  }
  /** A line under the landing page's call to action. */
  landingHint?: Component
  /** Folders dropped onto the page. */
  folderDrop?: {
    /** Whether the drop overlay should mention folders now. */
    readonly accepting: boolean
    /** The overlay's line about folders, shown while `accepting`. */
    hint: Component
    /** Handles a dropped folder, including telling the user why not. */
    drop: (directory: FileSystemDirectoryHandle) => Promise<void>
  }
}

/** What the app lends a plugin. */
export interface PluginHost {
  data: {
    /** Moves with every persisted change, in this tab or another; 0 until anything was saved. */
    readonly stamp: number
    /** The data as a backup file's JSON. */
    export: () => string
    /** Throws when `json` is not data `replace` can load. */
    validate: (json: string) => void
    /** Replaces all data with `json`, exactly as given. */
    replace: (json: string) => void
  }
  /** True while a screen in this tab holds its own copy of the data (reactive). */
  readonly dataHeld: boolean
  /** Date and time in the user's formatting locale. */
  formatDateTime: (ms: number) => string
}
