// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  interface ImportMetaEnv {
    /** Umami website id; set at build time to turn analytics on (see README). */
    readonly VITE_UMAMI_WEBSITE_ID?: string
  }

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {}
