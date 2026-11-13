<script lang="ts">
  import type { Component, Snippet } from 'svelte'

  import ChevronsDownUp from '@lucide/svelte/icons/chevrons-down-up'
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down'

  import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from '$lib/components/ui/collapsible'
  import { Separator } from '$lib/components/ui/separator'

  interface Props {
    icon: Component<{ class?: string }>
    title: string
    children: Snippet
  }

  let { icon: Icon, title, children }: Props = $props()
</script>

<!-- Figma "Subsection title" (1247:41685): a separator, then the icon and
     title with the expand/collapse chevrons. Closed until the user opens it. -->
<Collapsible class="flex flex-col gap-4">
  <Separator />
  <CollapsibleTrigger class="group flex w-full items-center justify-between">
    <span class="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase">
      <Icon class="size-4" />
      {title}
    </span>
    <span class="inline-flex size-8 items-center justify-center rounded-md group-hover:bg-accent">
      <ChevronsUpDown class="size-4 group-data-[state=open]:hidden" />
      <ChevronsDownUp class="hidden size-4 group-data-[state=open]:block" />
    </span>
  </CollapsibleTrigger>
  <CollapsibleContent class="flex flex-col gap-4">
    {@render children()}
  </CollapsibleContent>
</Collapsible>
