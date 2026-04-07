<script lang="ts">
  import { Input } from '$lib/components/ui/input'
  import { cn } from '$lib/utils'

  interface Props {
    value: string
    suffix: string
    placeholder?: string
    id?: string
    class?: string
    oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void
  }

  let { value, suffix, placeholder = '0', id, class: className, oninput }: Props = $props()
</script>

<div class="relative">
  <Input
    {placeholder}
    {value}
    {id}
    {oninput}
    class={cn(suffix.length > 3 ? 'pr-20' : suffix.length > 1 ? 'pr-14' : 'pr-8', className)}
  />
  <span
    class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm font-medium text-muted-foreground"
  >
    {suffix}
  </span>
</div>
