<script lang="ts" module>
  export interface SelectFieldItem {
    value: string
    label: string
    disabled?: boolean
  }
</script>

<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements'

  import * as Select from '$lib/components/ui/select'
  import { cn } from '$lib/utils'

  interface Props {
    /** The selected value. Bindable. */
    value?: string
    /** Whether the dropdown is open. Bindable. */
    open?: boolean
    /** Options to choose from. Accepts readonly arrays (e.g. `as const`). */
    items: readonly SelectFieldItem[]
    /** Placeholder shown on the trigger when nothing is selected. */
    placeholder?: string
    disabled?: boolean
    /** Allow clearing the selection by selecting the active item again. */
    allowDeselect?: boolean
    id?: string
    name?: string
    'aria-label'?: string
    /** Classes applied to the trigger (use for width/height overrides). */
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
    'aria-label': ariaLabel,
    class: className,
    contentClass,
    'aria-invalid': ariaInvalid,
    onValueChange,
  }: Props = $props()

  let selectedLabel = $derived(items.find((item) => item.value === value)?.label ?? '')
</script>

<!--
  Thin convenience wrapper around the stock shadcn `Select` for the common
  single-choice, items-array case. It is a native-select-style control: the full
  list is always shown and typing jumps the highlight to the matching item
  (passing `items` to the root enables type-to-select while focused, like a
  native `<select>`). Prefer this over composing `Select.*` by hand.

  `items` is accepted as `readonly` (so `as const` option arrays work without a
  copy); bits-ui types the root's `items` as mutable but only reads it for
  typeahead, so we cast away `readonly` at that single boundary.
-->
<Select.Root
  type="single"
  bind:value
  bind:open
  items={items as SelectFieldItem[]}
  {name}
  {disabled}
  {allowDeselect}
  {onValueChange}
>
  <Select.Trigger
    {id}
    aria-label={ariaLabel}
    aria-invalid={ariaInvalid}
    class={cn('w-full', className)}
  >
    <span data-slot="select-value" class={cn(!selectedLabel && 'text-muted-foreground')}>
      {selectedLabel || placeholder}
    </span>
  </Select.Trigger>
  <Select.Content class={contentClass}>
    {#each items as item (item.value)}
      <Select.Item value={item.value} label={item.label} disabled={item.disabled} />
    {/each}
  </Select.Content>
</Select.Root>
