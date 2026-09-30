// The app has a single Import dialog, mounted in the root layout. Settings,
// onboarding and a dropped backup file all open that one instance, so two
// dialogs can never stack.
function withImportDialogStore() {
  let open = $state(false)
  let droppedFile: File | undefined = $state()

  return {
    get open() {
      return open
    },
    set open(value: boolean) {
      open = value
      if (!value) droppedFile = undefined
    },
    /**
     * A backup file dropped onto the app. When set, the dialog imports this
     * file instead of opening the file picker.
     */
    get droppedFile() {
      return droppedFile
    },
    /** Opens the dialog to pick a backup file. */
    openPicker() {
      droppedFile = undefined
      open = true
    },
    /** Opens the dialog to confirm importing a dropped backup file. */
    openWithFile(file: File) {
      droppedFile = file
      open = true
    },
    /** Falls back to picking a file, e.g. after the dropped one failed to import. */
    forgetDroppedFile() {
      droppedFile = undefined
    },
  }
}

export const importDialogStore = withImportDialogStore()
