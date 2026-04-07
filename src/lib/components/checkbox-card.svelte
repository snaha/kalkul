<script lang="ts">
  import { Checkbox } from '$lib/components/ui/checkbox'

  interface Props {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    title: string
    description: string
  }

  let { checked, onCheckedChange, title, description }: Props = $props()
</script>

<label
  class="flex w-full cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-left transition-colors has-[[data-state=checked]]:bg-[rgba(23,23,23,0.05)] dark:has-[[data-state=checked]]:bg-[rgba(255,255,255,0.1)]"
>
  <Checkbox {checked} {onCheckedChange} />
  <div class="flex flex-col gap-1.5 text-sm">
    <span class="font-medium leading-none text-foreground">
      {title}
    </span>
    <span class="leading-5 text-muted-foreground">
      {description}
    </span>
  </div>
</label>
