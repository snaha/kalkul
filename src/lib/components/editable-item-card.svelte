<script lang="ts">
  import type { Snippet } from 'svelte'
  import { _ } from 'svelte-i18n'

  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import Copy from '@lucide/svelte/icons/copy'
  import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical'
  import Trash2 from '@lucide/svelte/icons/trash-2'

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
    dotColor?: string
    onToggleEditing: () => void
    onDuplicate: () => void
    onDelete: () => void
    expandedContent: Snippet
  }

  let {
    item,
    collapsedValue,
    collapsedValueClass,
    dotColor,
    onToggleEditing,
    onDuplicate,
    onDelete,
    expandedContent,
  }: Props = $props()

  // Snapshot for Escape-to-revert; edits commit live via oninput.
  let nameBeforeEdit = ''
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
          {#if dotColor}
            <div class="size-4 shrink-0 rounded-xs" style:background-color={dotColor}></div>
          {/if}
          <Input
            value={item.name}
            oninput={(e) => {
              item.name = (e.target as HTMLInputElement).value
            }}
            onfocus={() => {
              nameBeforeEdit = item.name
            }}
            onkeydown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              if (e.key === 'Escape') {
                item.name = nameBeforeEdit
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            class="flex-1"
          />
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
        {#if dotColor}
          <div class="size-4 shrink-0 rounded-xs" style:background-color={dotColor}></div>
        {/if}
        <span class="flex-1 truncate text-base font-medium">
          {item.name}
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
