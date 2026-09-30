import type { Component } from 'svelte'
import type { addMessages } from 'svelte-i18n'

/** One locale's translations, as svelte-i18n takes them. */
type Dictionary = Parameters<typeof addMessages>[1]

/**
 * The plugin contract. A plugin is a self-contained folder under
 * `src/lib/plugins/<id>/` whose `index.ts` builds one of these from the
 * `PluginHost` it is given; the app lists it in `registry.ts`.
 *
 * Besides its identity and translations, a plugin provides only what it
 * needs: background work, and components the app renders at fixed places
 * while the plugin is on. Each component decides for itself whether to show
 * anything.
 */
export interface KalkulPlugin {
  /** Stable id, also the key it is turned on under. kebab-case. */
  id: string
  /** For the dev page, which is not localised. */
  name: string
  description: string
  /** Why it cannot run in this build or browser; undefined when it can. */
  unavailableReason?: string
  /** Translations merged into the app's, by locale code. Keys go under `plugins.<id>`. */
  messages: Record<string, Dictionary>
  /** Background work while on. Returns the cleanup. */
  start?: () => () => void
  /** Rendered once in the root layout (its own dialogs). */
  root?: Component
  /** Rendered in the navbar. */
  navbar?: Component<{ class?: string }>
  /** A settings section, after Backup: its sidebar label and its body (with heading). */
  settings?: { label: Component; section: Component }
  /** Rendered under the landing page's call to action. */
  landingHint?: Component
  /** Folders dropped onto the page. `hint` is rendered in the drop overlay. */
  folderDrop?: { hint: Component; drop: (directory: FileSystemDirectoryHandle) => Promise<void> }
}

/** The app's data, as a plugin sees it. */
export interface PluginHost {
  /** Moves with every persisted change, in this tab or another; 0 until anything was saved. Reactive. */
  readonly lastUpdated: number
  /** The data as a backup file's JSON. */
  exportData: () => string
  /** Throws when `json` is not data `replaceData` can load. */
  validateData: (json: string) => void
  /** Replaces all data with `json`, exactly as given. */
  replaceData: (json: string) => void
  /** Date and time in the user's formatting locale. */
  formatDateTime: (ms: number) => string
}
