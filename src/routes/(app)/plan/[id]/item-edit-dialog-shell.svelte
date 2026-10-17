<script lang="ts">
  import type { Snippet } from 'svelte'
  import { _ } from 'svelte-i18n'

  import Trash2 from '@lucide/svelte/icons/trash-2'
  import X from '@lucide/svelte/icons/x'

  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { cn } from '$lib/utils'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Current item name, shown as the dialog title. */
    name: string
    /** New items get the Create footer, without the delete button. */
    isNew: boolean
    /** Title shown in place of the name while isNew. */
    newTitle?: string
    /** Replaces the default footer when given. */
    footer?: Snippet
    /** Extra footer classes, e.g. the muted background some Figma footers have. */
    footerClass?: string
    /** Optional label shown next to the title, e.g. "Financed". */
    badge?: string
    saveDisabled?: boolean
    onSave: () => void
    onDelete: () => void
    children: Snippet
  }

  let {
    open = $bindable(),
    onOpenChange,
    name,
    isNew,
    newTitle,
    footer,
    footerClass,
    badge,
    saveDisabled = false,
    onSave,
    onDelete,
    children,
  }: Props = $props()

  function close() {
    onOpenChange(false)
  }
</script>

<!-- Shared frame of the plan item edit dialogs: header with the title and the
     close X, scrollable body (the form comes in as a snippet), and the
     save/cancel/delete footer. -->
<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-xl">
    <Dialog.Header class="flex flex-row items-center gap-1 border-b p-4 pe-3">
      <Dialog.Title class="flex-1 truncate text-lg font-semibold">
        {isNew && newTitle ? newTitle : name}
      </Dialog.Title>
      {#if badge}
        <Badge variant="secondary" class="shrink-0">{badge}</Badge>
      {/if}
      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-4">
      {@render children()}
    </div>

    <Dialog.Footer class={cn('flex flex-row gap-2 border-t p-4', footerClass)}>
      {#if footer}
        {@render footer()}
      {:else}
        <!-- Figma "Add footer" / "Edit footer" (941-71859, 941-81371). -->
        <div class="flex flex-1 items-center gap-2">
          <Button disabled={saveDisabled} onclick={onSave}>
            {isNew ? $_('page.plan.createItem') : $_('page.plan.saveChanges')}
          </Button>
          <Button variant="outline" onclick={close}>{$_('page.plan.cancel')}</Button>
          {#if !isNew}
            <div class="flex flex-1 items-center justify-end gap-2">
              <Button
                variant="destructive"
                size="icon"
                onclick={onDelete}
                aria-label={$_('page.plan.deleteItem')}
              >
                <Trash2 class="size-4" />
              </Button>
            </div>
          {/if}
        </div>
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
