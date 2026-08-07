<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ArrowLeft from '@lucide/svelte/icons/arrow-left'
  import Calendar from '@lucide/svelte/icons/calendar'

  import { resolve } from '$app/paths'

  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'

  interface Props {
    date: string | undefined
  }

  let { date }: Props = $props()
</script>

<div class="flex items-start gap-4 p-8">
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <Button variant="ghost" size="icon" href={resolve(routes.HOME)}>
      <ArrowLeft class="size-4" />
    </Button>
    <h1 class="text-2xl leading-8 font-bold whitespace-nowrap">
      {$_('page.financialData.title')}
    </h1>
    {#if date}
      <Badge variant="outline">
        <Calendar class="size-3" />
        {date}
      </Badge>
    {/if}
  </div>
</div>
