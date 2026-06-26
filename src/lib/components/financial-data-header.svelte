<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowLeft, Calendar, SquarePen } from '@lucide/svelte'

  import { resolve } from '$app/paths'
  import { page } from '$app/state'

  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'

  interface Props {
    date: string
  }

  let { date }: Props = $props()

  // Resume the onboarding edit flow at the category currently being viewed.
  const editHref = $derived.by(() => {
    const seg = page.url.pathname.replace(/\/$/, '').split('/').pop()
    switch (seg) {
      case 'investments':
        return resolve(routes.FINANCES_EDIT_INVESTMENTS)
      case 'tangible-assets':
        return resolve(routes.FINANCES_EDIT_TANGIBLE_ASSETS)
      case 'liabilities':
        return resolve(routes.FINANCES_EDIT_LIABILITIES)
      case 'incomes':
        return resolve(routes.FINANCES_EDIT_INCOME)
      case 'expenses':
        return resolve(routes.FINANCES_EDIT_EXPENSES)
      default:
        return resolve(routes.FINANCES_EDIT)
    }
  })
</script>

<div class="flex items-start gap-4 p-8">
  <div class="flex min-w-0 flex-1 items-center gap-2">
    <Button variant="ghost" size="icon" href={resolve(routes.HOME)}>
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
  <Button size="sm" href={editHref}>
    <SquarePen class="size-4" />
    {$_('page.financialData.update')}
  </Button>
</div>
