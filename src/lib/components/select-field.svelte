<script lang="ts" module>
  export interface SelectFieldItem<T extends string = string> {
    value: T
    label: string
    disabled?: boolean
  }
</script>

<script lang="ts" generics="T extends string">
  import type { HTMLInputAttributes } from 'svelte/elements'

  import * as Select from '$lib/components/ui/select'
  import { cn } from '$lib/utils'

  interface Props {
    /** The selected value. Bindable. */
    value?: T
    /** Whether the dropdown is open. Bindable. */
    open?: boolean
    /** Options to choose from. Accepts readonly arrays (e.g. `as const`). */
    items: readonly SelectFieldItem<T>[]
    /** Placeholder shown on the trigger when nothing is selected. */
    placeholder?: string
    disabled?: boolean
    /**
     * Allow clearing the selection by selecting the active item again.
     * Deselecting emits an empty string, so only enable this with handlers
     * that treat '' as "cleared".
     */
    allowDeselect?: boolean
    id?: string
    name?: string
    'aria-label'?: string
    /** Classes applied to the trigger (use for width/height overrides). */
    class?: string
    /** Classes applied to the dropdown content. */
    contentClass?: string
    'aria-invalid'?: HTMLInputAttributes['aria-invalid']
    /**
     * Fires with the picked item's value, typed by the `items` array — an
     * enum-backed dropdown gets the enum member without a cast at the call
     * site (a typo'd option value fails the typecheck instead of flowing
     * into schema-validated data).
     */
    onValueChange?: (value: T) => void
  }

  let {
    // '' is bits-ui's "nothing selected" sentinel; it never reaches
    // onValueChange (items can only carry T values), so the cast is confined
    // to this initialization.
    value = $bindable('' as T),
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
  items={items as SelectFieldItem<T>[]}
  {name}
  {disabled}
  {allowDeselect}
  onValueChange={onValueChange as ((value: string) => void) | undefined}
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
