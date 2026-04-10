<script lang="ts">
  import { locale } from 'svelte-i18n'

  import { Input } from '$lib/components/ui/input'
  import { cn } from '$lib/utils'

  interface Props {
    value: number | undefined
    suffix: string
    placeholder?: string
    id?: string
    class?: string
    onValueChange: (value: number | undefined) => void
  }

  let { value, suffix, placeholder = '0', id, class: className, onValueChange }: Props = $props()

  let focused = $state(false)
  let draft = $state('')

  // Characters the user may type while editing.
  // Digits, minus, and both decimal separators.
  const TYPING_RE = /[^0-9.,-]/g

  function parseDraft(raw: string): number | undefined {
    if (!raw) return undefined
    // Normalize separators: strip thousand separators, allow either . or , as decimal.
    // Heuristic: the last '.' or ',' is the decimal separator; earlier ones are group separators.
    const trimmed = raw.trim().replace(/\s/g, '')
    const lastDot = trimmed.lastIndexOf('.')
    const lastComma = trimmed.lastIndexOf(',')
    const lastSep = Math.max(lastDot, lastComma)
    let normalized: string
    if (lastSep === -1) {
      normalized = trimmed
    } else {
      const intPart = trimmed.slice(0, lastSep).replace(/[.,\s]/g, '')
      const fracPart = trimmed.slice(lastSep + 1)
      normalized = `${intPart}.${fracPart}`
    }
    const n = Number(normalized)
    return Number.isFinite(n) ? n : undefined
  }

  function formatDisplay(n: number | undefined): string {
    if (n === undefined || !Number.isFinite(n)) return ''
    return n.toLocaleString($locale ?? undefined, { maximumFractionDigits: 4 })
  }

  // What the input should show given focus state.
  let displayValue = $derived(focused ? draft : formatDisplay(value))

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
