<script lang="ts">
  import type { Snippet } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Copy from '@lucide/svelte/icons/copy'
  import Eye from '@lucide/svelte/icons/eye'
  import EyeOff from '@lucide/svelte/icons/eye-off'
  import SquarePen from '@lucide/svelte/icons/square-pen'
  import Trash2 from '@lucide/svelte/icons/trash-2'
  import X from '@lucide/svelte/icons/x'

  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Current item name, shown as the dialog title. */
    name: string
    onNameChange: (name: string) => void
    /** New items hide the toolbar and (when renamable) start in rename mode. */
    isNew: boolean
    /** Plan-membership state behind the eye toggle. */
    isIncluded: boolean
    /**
     * Whether the title carries the inline rename control. Dialogs that edit
     * the name through a body field (transfers) pass false.
     */
    renamable?: boolean
    /** Title shown while isNew when the name field lives in the body. */
    newTitle?: string
    saveDisabled?: boolean
    onSave: () => void
    onDuplicate: () => void
    onToggleInclude: () => void
    onDelete: () => void
    children: Snippet
  }

  let {
    open = $bindable(),
    onOpenChange,
    name,
    onNameChange,
    isNew,
    isIncluded,
    renamable = true,
    newTitle,
    saveDisabled = false,
    onSave,
    onDuplicate,
    onToggleInclude,
    onDelete,
    children,
  }: Props = $props()

  let editingName = $state(false)
  let nameInputRef: HTMLInputElement | undefined = $state()

  // New renamable items open straight into the name input.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      editingName = renamable && isNew
    }
    wasOpen = open
  })

  function close() {
    onOpenChange(false)
  }

  function startRenaming() {
    editingName = true
    queueMicrotask(() => {
      nameInputRef?.focus()
      nameInputRef?.select()
    })
  }

  function stopRenaming() {
    editingName = false
  }
</script>

<!-- Shared frame of the plan item edit dialogs: header with the editable name
     and the rename/duplicate/include/delete toolbar, scrollable body (the
     form comes in as a snippet), and the cancel/save footer. -->
<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-xl">
    <Dialog.Header class="flex flex-row items-center gap-1 border-b p-4 pe-3">
      <!-- Dialog.Title stays mounted at all times so the dialog always has an
      accessible name. While renaming it is visually hidden (but still exposed
      to assistive tech) and the Input becomes the visible control. -->
      <Dialog.Title class={editingName ? 'sr-only' : 'flex-1 truncate text-lg font-semibold'}>
        {isNew && newTitle ? newTitle : name}
      </Dialog.Title>
      {#if editingName}
        <Input
          bind:ref={nameInputRef}
          value={name}
          oninput={(e) => onNameChange((e.target as HTMLInputElement).value)}
          onblur={isNew ? undefined : stopRenaming}
          onkeydown={(e) => {
            if (!isNew && (e.key === 'Enter' || e.key === 'Escape')) stopRenaming()
          }}
          aria-label={$_('page.plan.itemNameLabel')}
          class="flex-1 text-lg font-semibold"
        />
      {/if}

      {#if !isNew}
        {#if renamable}
          <Button
            variant="ghost"
            size="icon"
            onclick={startRenaming}
            aria-label={$_('page.plan.renameItem')}
          >
            <SquarePen class="size-4" />
          </Button>
        {/if}
        <Button
          variant="ghost"
          size="icon"
          onclick={onDuplicate}
          aria-label={$_('page.plan.duplicateItem')}
        >
          <Copy class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={onToggleInclude}
          aria-label={isIncluded ? $_('page.plan.excludeFromPlan') : $_('page.plan.includeInPlan')}
        >
          {#if isIncluded}
            <Eye class="size-4" />
          {:else}
            <EyeOff class="size-4 text-destructive" />
          {/if}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={onDelete}
          aria-label={$_('page.plan.deleteItem')}
        >
          <Trash2 class="size-4" />
        </Button>
      {/if}

      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-4">
      {@render children()}
    </div>

    <Dialog.Footer class="flex flex-row justify-end gap-2 border-t p-4">
      <Button variant="secondary" onclick={close}>{$_('page.plan.cancel')}</Button>
      <Button disabled={saveDisabled} onclick={onSave}>{$_('page.plan.saveChanges')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
