// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  interface ImportMetaEnv {
    /** Umami website id; set at build time to turn analytics on (see README). */
    readonly VITE_UMAMI_WEBSITE_ID?: string
    /** 'hash' on PR previews, which share kalkul.app's origin (see README). */
    readonly VITE_ROUTER?: string
  }

  interface DataTransferItem {
    /** A dropped file's or folder's handle (Chromium); undefined elsewhere. */
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>
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
