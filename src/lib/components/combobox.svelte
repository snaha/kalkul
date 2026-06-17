<script lang="ts" module>
  export interface ComboboxItem {
    value: string
    label: string
    disabled?: boolean
  }
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n'
  import type { HTMLInputAttributes } from 'svelte/elements'

  import CheckIcon from '@lucide/svelte/icons/check'
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down'
  import { Combobox } from 'bits-ui'

  import { cn } from '$lib/utils'

  interface Props {
    /** The selected value. Bindable. */
    value?: string
    /** Whether the dropdown is open. Bindable. */
    open?: boolean
    /** Options to choose from. */
    items: ComboboxItem[]
    /** Placeholder shown when nothing is selected (and while searching). */
    placeholder?: string
    disabled?: boolean
    /** Allow clearing the selection by selecting the active item again. */
    allowDeselect?: boolean
    id?: string
    name?: string
    /** Classes applied to the input (use for width/height overrides). */
    class?: string
    /** Classes applied to the dropdown content. */
    contentClass?: string
    'aria-invalid'?: HTMLInputAttributes['aria-invalid']
    onValueChange?: (value: string) => void
  }

  let {
    value = $bindable(''),
    open = $bindable(false),
    items,
    placeholder,
    disabled = false,
    allowDeselect = false,
    id,
    name,
    class: className,
    contentClass,
    'aria-invalid': ariaInvalid,
    onValueChange,
  }: Props = $props()

  // The text the user has typed while the dropdown is open. We control the
  // input's displayed value ourselves (via Root's `inputValue` prop) because
  // bits-ui only syncs its own label on user selection — not when `value` is
  // set programmatically or on initial mount.
  let query = $state('')

  // Reset the typed text whenever the dropdown opens or closes, so reopening
  // always starts from a clean, unfiltered list.
  $effect(() => {
    void open
    query = ''
  })

  let selectedLabel = $derived(items.find((item) => item.value === value)?.label ?? '')

  // While open the input shows the live query; while closed it shows the
  // selected option's label (kept correct even for externally-set values).
  let inputValue = $derived(open ? query : selectedLabel)

  let filteredItems = $derived.by(() => {
    const search = query.trim().toLowerCase()
    if (!open || !search) return items
    return items.filter((item) => item.label.toLowerCase().includes(search))
  })
</script>

<Combobox.Root
  type="single"
  bind:value
  bind:open
  {inputValue}
  {items}
  {name}
  {disabled}
  {allowDeselect}
  {onValueChange}
>
  <div class="relative">
    <Combobox.Input
      {id}
      {placeholder}
      aria-invalid={ariaInvalid}
      oninput={(e) => (query = e.currentTarget.value)}
      onpointerdown={() => {
        if (!disabled) open = true
      }}
      class={cn(
        'border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 placeholder:text-muted-foreground h-8 w-full rounded-lg border bg-transparent py-2 pr-8 pl-2.5 text-sm transition-colors outline-none focus-visible:ring-3 aria-invalid:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
    <Combobox.Trigger
      class="text-muted-foreground absolute end-2 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center"
    >
      <ChevronDownIcon class="size-4" />
    </Combobox.Trigger>
  </div>
  <Combobox.Portal>
    <Combobox.Content
      sideOffset={4}
      class={cn(
        'bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 relative isolate z-50 max-h-72 min-w-36 overflow-x-hidden overflow-y-auto rounded-lg p-1 shadow-md ring-1 duration-100',
        contentClass,
      )}
    >
      <Combobox.Viewport class="w-full min-w-(--bits-combobox-anchor-width) scroll-my-1">
        {#each filteredItems as item (item.value)}
          <Combobox.Item
            value={item.value}
            label={item.label}
            disabled={item.disabled}
            class="focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
          >
            {#snippet children({ selected })}
              <span class="absolute end-2 flex size-3.5 items-center justify-center">
                {#if selected}
                  <CheckIcon class="size-4" />
                {/if}
              </span>
              {item.label}
            {/snippet}
          </Combobox.Item>
        {:else}
          <div class="text-muted-foreground py-1.5 pr-8 pl-1.5 text-sm">
            {$_('common.noResults')}
          </div>
        {/each}
      </Combobox.Viewport>
    </Combobox.Content>
  </Combobox.Portal>
</Combobox.Root>
