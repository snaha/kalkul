<script lang="ts">
  import { Input } from '$lib/components/ui/input'
  import { decimalSeparatorOf, formatNumberInput, parseNumberInput } from '$lib/parse-number-input'
  import { cn } from '$lib/utils'

  interface Props {
    value: number | undefined
    suffix: string
    placeholder?: string
    id?: string
    class?: string
    // Required so no call site can accidentally fall back to the OS locale —
    // pass appStore.formatNumber (or a wrapper around it).
    formatNumber: (n: number) => string
    onValueChange: (value: number | undefined) => void
  }

  let {
    value,
    suffix,
    placeholder = '0',
    id,
    class: className,
    formatNumber,
    onValueChange,
  }: Props = $props()

  let focused = $state(false)
  let draft = $state('')

  // Characters the user may type while editing.
  // Digits, minus, and both decimal separators.
  const TYPING_RE = /[^0-9.,-]/g

  // Parsing derives its decimal separator from the same formatter the
  // unfocused field displays with, so whatever the field shows always parses
  // back to the same value.
  const decimalSep = $derived(decimalSeparatorOf(formatNumber))

  function parseDraft(raw: string): number | undefined {
    return parseNumberInput(raw, decimalSep)
  }

  // What the input should show given focus state.
  let displayValue = $derived(focused ? draft : formatNumberInput(value, formatNumber))

  function handleFocus() {
    focused = true
    // Start editing from the raw number so the user sees exactly what they can edit.
    draft = value === undefined ? '' : String(value)
  }

  function handleBlur() {
    focused = false
    const parsed = parseDraft(draft)
    if (parsed !== value) onValueChange(parsed)
  }

  function handleInput(e: Event & { currentTarget: HTMLInputElement }) {
    const raw = e.currentTarget.value
    const cleaned = raw.replace(TYPING_RE, '')
    if (cleaned !== raw) {
      // Reflect the stripped value back into the input
      e.currentTarget.value = cleaned
    }
    draft = cleaned
    const parsed = parseDraft(cleaned)
    onValueChange(parsed)
  }
</script>

<div class="relative">
  <Input
    {placeholder}
    {id}
    value={displayValue}
    inputmode="decimal"
    onfocus={handleFocus}
    onblur={handleBlur}
    oninput={handleInput}
    class={cn(suffix.length > 3 ? 'pr-20' : suffix.length > 1 ? 'pr-14' : 'pr-8', className)}
  />
  <span
    class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm font-medium text-muted-foreground"
  >
    {suffix}
  </span>
</div>
