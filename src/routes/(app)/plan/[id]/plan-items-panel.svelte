<script lang="ts" module>
  export interface PlanItemRow {
    id: string
    name: string
    // The amount as entered. Assets show none: theirs is only where the plan
    // starts, and the right sidebar has the value of the selected year.
    value?: string
    // The amount follows inflation over the years.
    inflationAdjusted?: boolean
    hasInsufficientFunds?: boolean
    onClick?: () => void
    // Told when the pointer or the focus enters and leaves the row.
    onHover?: (hovering: boolean) => void
  }

  export interface PlanItemGroup {
    id: string
    label: string
    rows: PlanItemRow[]
    // Adds an item of this kind directly, without the type picker.
    addLabel?: string
    onAdd?: () => void
    // A group that is a single thing (Cash): the row itself opens it.
    onClick?: () => void
  }

  export interface PlanItemSection {
    id: string
    label: string
    addLabel: string
    onAdd: () => void
    groups: PlanItemGroup[]
  }
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ChevronRight from '@lucide/svelte/icons/chevron-right'
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'
  import Plus from '@lucide/svelte/icons/plus'
  import TrendingUp from '@lucide/svelte/icons/trending-up'

  import { Button } from '$lib/components/ui/button'
  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from '$lib/components/ui/collapsible'
  import { cn } from '$lib/utils'

  let { sections }: { sections: PlanItemSection[] } = $props()

  // Which sections and groups are open, by id. The sections start open and
  // their groups closed.
  let open = $state<Record<string, boolean>>({})
  const isOpen = (id: string, fallback: boolean) => open[id] ?? fallback

  const rowClass =
    'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm leading-none'
</script>

{#snippet rowCells(row: PlanItemRow)}
  <span class="min-w-0 flex-1 truncate">{row.name}</span>
  {#if row.value !== undefined}
    {#if row.inflationAdjusted}
      <span
        role="img"
        class="shrink-0"
        aria-label={$_('page.plan.items.inflationAdjusted')}
        title={$_('page.plan.items.inflationAdjusted')}
      >
        <TrendingUp class={cn('size-3.5', !row.hasInsufficientFunds && 'text-muted-foreground')} />
      </span>
    {/if}
    <span class={cn('shrink-0 tabular-nums', !row.hasInsufficientFunds && 'text-muted-foreground')}>
      {row.value}
    </span>
  {/if}
{/snippet}

{#snippet addButton(g: PlanItemGroup)}
  {#if g.onAdd}
    <!-- Shown on hover and focus; always where there is no hover to rely on. -->
    <button
      type="button"
      aria-label={g.addLabel}
      title={g.addLabel}
      onclick={g.onAdd}
      class="pointer-events-auto relative z-10 shrink-0 rounded-sm opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
    >
      <Plus class="size-4" />
    </button>
  {/if}
{/snippet}

{#snippet group(g: PlanItemGroup)}
  {@const rowBase =
    'group/row relative flex items-center gap-2 rounded-md p-2 text-sm leading-none font-medium hover:bg-sidebar-accent'}
  {#if g.onClick}
    <button type="button" onclick={g.onClick} class={cn(rowBase, 'w-full text-left')}>
      <span class="min-w-0 flex-1 truncate">{g.label}</span>
    </button>
  {:else if g.rows.length === 0}
    <!-- Nothing to open yet: no chevron, and the label keeps its column. -->
    <div class={cn(rowBase, 'pl-8')}>
      <span class="min-w-0 flex-1 truncate">{g.label}</span>
      {@render addButton(g)}
    </div>
  {:else}
    <Collapsible
      open={isOpen(g.id, false)}
      onOpenChange={(v) => (open[g.id] = v)}
      class={cn('w-full', isOpen(g.id, false) && 'pb-2')}
    >
      <!-- The whole row toggles the group. The trigger lies over it rather
           than around it, so the add button can be a button of its own. -->
      <div class={rowBase}>
        <CollapsibleTrigger class="peer absolute inset-0 rounded-md" aria-label={g.label} />
        <ChevronRight
          class="pointer-events-none size-4 shrink-0 transition-transform peer-data-[state=open]:rotate-90"
        />
        <span class="pointer-events-none min-w-0 flex-1 truncate">{g.label}</span>
        {@render addButton(g)}
      </div>
      <CollapsibleContent>
        <ul
          class="relative flex flex-col gap-1 px-6 py-0.5 before:absolute before:inset-y-0 before:left-4 before:border-l before:border-sidebar-border"
        >
          {#each g.rows as row (row.id)}
            {@const failing = row.hasInsufficientFunds
              ? 'bg-destructive/10 text-destructive'
              : undefined}
            <li
              title={row.hasInsufficientFunds
                ? $_('page.plan.insufficientFundsTooltip')
                : undefined}
              onmouseenter={() => row.onHover?.(true)}
              onmouseleave={() => row.onHover?.(false)}
              onfocusin={() => row.onHover?.(true)}
              onfocusout={() => row.onHover?.(false)}
            >
              <!-- A row with no handler is information, not a control: a div,
                   so it stays out of the tab order. -->
              {#if row.onClick}
                <button
                  type="button"
                  onclick={row.onClick}
                  class={cn(rowClass, 'hover:bg-sidebar-accent', failing)}
                >
                  {@render rowCells(row)}
                </button>
              {:else}
                <div class={cn(rowClass, failing)}>{@render rowCells(row)}</div>
              {/if}
            </li>
          {/each}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  {/if}
{/snippet}

<div class="flex w-[320px] shrink-0 flex-col gap-4 overflow-y-auto bg-sidebar p-2 pb-4">
  {#each sections as section (section.id)}
    <Collapsible
      open={isOpen(section.id, true)}
      onOpenChange={(v) => (open[section.id] = v)}
      class="w-full"
    >
      <div class="relative flex items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent">
        <CollapsibleTrigger class="absolute inset-0 rounded-md" aria-label={section.label} />
        <p class="pointer-events-none min-w-0 flex-1 truncate text-base font-bold">
          {section.label}
        </p>
        <Button
          variant="outline"
          size="sm"
          class="relative z-10 text-xs"
          aria-label={section.addLabel}
          onclick={section.onAdd}
        >
          <Plus />
          {$_('page.plan.items.add')}
        </Button>
        <ChevronsUpDown class="pointer-events-none size-4 shrink-0" />
      </div>
      <CollapsibleContent>
        {#each section.groups as g (g.id)}
          {@render group(g)}
        {/each}
      </CollapsibleContent>
    </Collapsible>
  {/each}
</div>
