<script lang="ts">
  import type { Snippet } from 'svelte'
  import { _ } from 'svelte-i18n'

  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import Copy from '@lucide/svelte/icons/copy'
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import Trash2 from '@lucide/svelte/icons/trash-2'

  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent } from '$lib/components/ui/card'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'

  interface EditableItem {
    id: string
    editing: boolean
    name: string
  }

  interface Props {
    item: EditableItem
    collapsedValue?: string
    collapsedValueClass?: string
    /** Optional label (e.g. "Financed") shown next to the name. */
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
</script>

<!-- Figma 897:67838. The whole header opens and closes the card; the chevrons
     at its right are an icon, not a button of their own. An open card has the
     "..." menu beside them and the Label field first. -->
{#snippet title()}
  <span class="flex min-w-0 flex-1 items-center gap-2">
    <span class="truncate text-base font-medium">{item.name}</span>
    {#if badge}
      <Badge variant="secondary" class="shrink-0">{badge}</Badge>
    {/if}
  </span>
{/snippet}

<Card class="gap-0 py-0">
  <CardContent class="p-4">
    {#if item.editing}
      <div class="flex flex-col gap-4">
        <!-- Header row. The menu sits between the two halves of the header, so
             the chevrons are a second, mouse-only handle on the same action. -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="flex h-8 min-w-0 flex-1 cursor-pointer items-center text-left"
            aria-expanded="true"
            onclick={onToggleEditing}
          >
            {@render title()}
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={$_('page.setup.common.moreActions')}
                  {...props}
                >
                  <Ellipsis class="size-4" />
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
          <button
            type="button"
            tabindex="-1"
            aria-hidden="true"
            class="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center"
            onclick={onToggleEditing}
          >
            <ChevronsUpDown class="size-4" />
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="label-{item.id}">{$_('page.plan.investmentLabel')}</Label>
          <Input id="label-{item.id}" bind:value={item.name} />
        </div>

        {@render expandedContent()}
      </div>
    {:else}
      <!-- Collapsed card -->
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-2 text-left"
        aria-expanded="false"
        onclick={onToggleEditing}
      >
        {@render title()}
        {#if collapsedValue}
          <span class="shrink-0 text-sm {collapsedValueClass ?? 'text-foreground'}">
            {collapsedValue}
          </span>
        {/if}
        <span class="inline-flex size-8 shrink-0 items-center justify-center">
          <ChevronsUpDown class="size-4" />
        </span>
      </button>
    {/if}
  </CardContent>
</Card>
