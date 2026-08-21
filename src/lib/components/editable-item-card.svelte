<script lang="ts">
  import type { Snippet } from 'svelte'
  import { _ } from 'svelte-i18n'

  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import Copy from '@lucide/svelte/icons/copy'
  import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical'
  import SquarePen from '@lucide/svelte/icons/square-pen'
  import Trash2 from '@lucide/svelte/icons/trash-2'

  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent } from '$lib/components/ui/card'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import { Input } from '$lib/components/ui/input'

  interface EditableItem {
    editing: boolean
    name: string
  }

  interface Props {
    item: EditableItem
    collapsedValue?: string
    collapsedValueClass?: string
    /** Optional label (e.g. "Financed") shown next to the name when collapsed. */
    badge?: string
    onToggleEditing: () => void
    onDuplicate: () => void
    onDelete: () => void
    expandedContent: Snippet
  }

  let {
    item,
    collapsedValue,
    collapsedValueClass,
    badge,
    onToggleEditing,
    onDuplicate,
    onDelete,
    expandedContent,
  }: Props = $props()

  // Whether the name is shown as an editable input (toggled by the SquarePen
  // button). Separate from the card's collapsed/expanded state.
  let renaming = $state(false)

  // Snapshot for Escape-to-revert; edits commit live via oninput.
  let nameBeforeEdit = ''

  // Close the rename input whenever the card collapses.
  $effect(() => {
    if (!item.editing) renaming = false
  })

  function startRename() {
    nameBeforeEdit = item.name
    renaming = true
  }
</script>

<Card class="gap-0 py-0">
  <CardContent class="p-4">
    {#if item.editing}
      <div class="flex flex-col gap-4">
        <!-- Header row -->
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" class="shrink-0" onclick={onToggleEditing}>
            <ChevronsUpDown class="size-4" />
          </Button>
          {#if renaming}
            <Input
              value={item.name}
              oninput={(e) => {
                item.name = (e.target as HTMLInputElement).value
              }}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                  if (e.key === 'Escape') item.name = nameBeforeEdit
                  ;(e.target as HTMLInputElement).blur()
                  renaming = false
                }
              }}
              class="min-w-0 flex-1"
            />
          {:else}
            <span class="min-w-0 flex-1 truncate text-base font-medium">{item.name}</span>
          {/if}
          <Button
            variant="ghost"
            size="icon"
            class="shrink-0"
            aria-label={$_('page.setup.common.rename')}
            title={$_('page.setup.common.rename')}
            onclick={startRename}
          >
            <SquarePen class="size-4" />
          </Button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button variant="ghost" size="icon" {...props}>
                  <EllipsisVertical class="size-4" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onclick={onDuplicate}>
                <Copy class="size-4" />
                {$_('page.setup.common.duplicate')}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                class="text-destructive"
                onclick={() => {
                  if (
                    window.confirm(
                      $_('page.setup.common.deleteConfirm', { values: { name: item.name } }),
                    )
                  ) {
                    onDelete()
                  }
                }}
              >
                <Trash2 class="size-4" />
                {$_('page.setup.common.delete')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>

        {@render expandedContent()}
      </div>
    {:else}
      <!-- Collapsed card -->
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-2 text-left"
        onclick={onToggleEditing}
      >
        <span
          class="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground"
        >
          <ChevronsUpDown class="size-4" />
        </span>
        <span class="flex min-w-0 flex-1 items-center gap-2">
          <span class="truncate text-base font-medium">
            {item.name}
          </span>
          {#if badge}
            <Badge variant="secondary" class="shrink-0">{badge}</Badge>
          {/if}
        </span>
        {#if collapsedValue}
          <span class="shrink-0 text-sm {collapsedValueClass ?? 'text-foreground'}">
            {collapsedValue}
          </span>
        {/if}
      </button>
    {/if}
  </CardContent>
</Card>
