/// <reference lib="dom.asynciterable" />
// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
  interface ImportMetaEnv {
    /** Umami website id; set at build time to turn analytics on (see README). */
    readonly VITE_UMAMI_WEBSITE_ID?: string
    /** 'hash' on PR previews, which share kalkul.app's origin (see README). */
    readonly VITE_ROUTER?: string
  }

  // File System Access API parts TypeScript's DOM lib does not ship yet
  // (Chromium only; used by the backup folder, src/lib/cloud-backup/).
  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite'
  }
  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  }
  interface DataTransferItem {
    /** A dropped folder's handle (Chromium); undefined elsewhere. */
    getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>
  }
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string
      mode?: 'read' | 'readwrite'
      startIn?: 'documents' | 'desktop' | 'downloads'
    }) => Promise<FileSystemDirectoryHandle>
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
