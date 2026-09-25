/// <reference lib="dom.asynciterable" />

// File System Access API parts TypeScript's DOM lib does not ship yet
// (Chromium only).
declare global {
  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite'
  }
  interface FileSystemHandle {
    queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
    requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  }
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string
      mode?: 'read' | 'readwrite'
      startIn?: 'documents' | 'desktop' | 'downloads'
    }) => Promise<FileSystemDirectoryHandle>
  }
}

export {}
