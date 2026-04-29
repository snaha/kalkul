<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowLeft, Calendar, SquarePen } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { resolveFinancialDataRoute } from '$lib/financial-data-nav'
  import routes from '$lib/routes'

  interface Props {
    backTarget: 'home' | 'overview'
    date: string
  }

  let { backTarget, date }: Props = $props()

  const backHref = $derived(
    backTarget === 'overview'
      ? resolveFinancialDataRoute(routes.FINANCIAL_DATA)
      : resolve(routes.HOME),
  )
</script>

<div class="flex items-start gap-4 p-8">
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <Button variant="ghost" size="icon" href={backHref}>
      <ArrowLeft class="size-4" />
    </Button>
    <h1 class="text-2xl leading-8 font-bold whitespace-nowrap">
      {$_('page.financialData.title')}
    </h1>
    <Badge variant="outline">
      <Calendar class="size-3" />
      {date}
    </Badge>
  </div>
  <Button size="sm" href={resolve(routes.FINANCES_EDIT)}>
    <SquarePen class="size-4" />
    {$_('page.financialData.update')}
  </Button>
</div>
