import claire from '$examples/claire-moreau-fr-41yo.kalkul.json'
import jan from '$examples/jan-dvorak-cz-56yo.kalkul.json'
import peter from '$examples/peter-kovac-sk-29yo.kalkul.json'
import tereza from '$examples/tereza-svobodova-cz-20yo.kalkul.json'

import { buildPlanInclusions, getDefaultPlanDates } from '$lib/plan-defaults'
import { type Portfolio, type Profile, storedDataSchema } from '$lib/schemas'
import storageKeys from '$lib/storage-keys'
import { appStore } from '$lib/stores/app.svelte'
import { calculateAge, parseDateOnly } from '$lib/utils'

export type DemoPersonaId = 'tereza' | 'peter' | 'claire' | 'jan'

export interface DemoPersona {
  id: DemoPersonaId
  data: { profile: Profile; portfolios: Portfolio[] }
}

/**
 * Parsed rather than cast, like the dev presets: TypeScript widens JSON
 * literals to `string`, and a schema change a sample missed should fail here.
 */
function sample(json: unknown): DemoPersona['data'] {
  return storedDataSchema.pick({ profile: true, portfolios: true }).parse(json)
}

/**
 * The personas the landing page offers. Each is a whole profile — a plan
 * shares its profile's birth date, cash and currency, so four people of
 * different ages and countries cannot be four plans of one profile. A future
 * compare feature that wants to set personas side by side reads them from
 * here.
 */
export const DEMO_PERSONAS: DemoPersona[] = [
  { id: 'tereza', data: sample(tereza) },
  { id: 'peter', data: sample(peter) },
  { id: 'claire', data: sample(claire) },
  { id: 'jan', data: sample(jan) },
]

/**
 * Id of the plan the demo opens on: the persona's whole situation as an
 * editable projection, so the visitor can play with it. Fixed, like the
 * Current projection's id, so the plan page can tell it apart.
 */
export const DEMO_PLAN_ID = 'demo-persona'

/** "Claire, 41" — first name and age on `today`. */
export function personaLabel(persona: DemoPersona, today: Date): string {
  const { name, birth_date } = persona.data.profile
  const firstName = name.split(' ')[0]
  const age = calculateAge(
    birth_date ? parseDateOnly(birth_date) : undefined,
    today.getFullYear(),
    today.getMonth(),
  )
  return age === undefined ? firstName : `${firstName}, ${age}`
}

/**
 * The persona's data with its demo plan in front: everything the profile
 * holds, on the same timeline a plan created from the Add projection dialog
 * would get.
 */
export function buildDemoData(persona: DemoPersona, today: Date): DemoPersona['data'] {
  const { profile, portfolios } = persona.data
  const plan: Portfolio = {
    id: DEMO_PLAN_ID,
    name: personaLabel(persona, today),
    ...getDefaultPlanDates(profile, today),
    ...buildPlanInclusions(profile, true),
  }
  return { profile, portfolios: [plan, ...portfolios] }
}

export function startDemo(persona: DemoPersona, today: Date): void {
  appStore.loadDemo(buildDemoData(persona, today))
  localStorage.setItem(storageKeys.DEMO, persona.id)
}

export function exitDemo(): void {
  localStorage.removeItem(storageKeys.DEMO)
  appStore.exitDemo()
}

/**
 * Picks the demo back up after a reload. Real data always wins: someone who
 * set up their own profile in another tab is no longer a demo visitor.
 */
export function restoreDemo(today: Date): void {
  const persona = DEMO_PERSONAS.find((p) => p.id === localStorage.getItem(storageKeys.DEMO))
  if (!persona) return
  if (appStore.profile.name) {
    localStorage.removeItem(storageKeys.DEMO)
    return
  }
  startDemo(persona, today)
}
