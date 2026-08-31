<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { page } from '$app/state'

  import { Card } from '$lib/components/ui/card'
  import { type FinancialDataRoute, resolveFinancialDataRoute } from '$lib/financial-data-nav'
  import routes, { routeFromId } from '$lib/routes'
  import { cn } from '$lib/utils'

  interface Props {
    variant?: 'sidebar' | 'list'
    class?: string
  }

  let { variant = 'sidebar', class: className }: Props = $props()

  const items: { route: FinancialDataRoute; label: string }[] = $derived([
    { route: routes.FINANCIAL_DATA, label: $_('page.financialData.nav.overview') },
    { route: routes.FINANCIAL_DATA_CASH, label: $_('page.financialData.nav.cash') },
    { route: routes.FINANCIAL_DATA_INVESTMENTS, label: $_('page.financialData.nav.investments') },
    {
      route: routes.FINANCIAL_DATA_TANGIBLE_ASSETS,
      label: $_('page.financialData.nav.tangibleAssets'),
    },
    { route: routes.FINANCIAL_DATA_LIABILITIES, label: $_('page.financialData.nav.liabilities') },
    { route: routes.FINANCIAL_DATA_INCOMES, label: $_('page.financialData.nav.incomes') },
    { route: routes.FINANCIAL_DATA_EXPENSES, label: $_('page.financialData.nav.expenses') },
    { route: routes.FINANCIAL_DATA_TRANSFERS, label: $_('page.financialData.nav.transfers') },
  ])

  // Compare route ids, not pathnames: the pathname carries the base path and
  // stays constant under the hash router, so it never matches the constants.
  const activeRoute = $derived(routeFromId(page.route.id))
  const cardWidth = $derived(variant === 'sidebar' ? 'w-72' : '')
  const itemHeight = $derived(variant === 'sidebar' ? 'h-8' : 'h-10')
</script>

<Card class={cn('gap-0 p-2', cardWidth, className)}>
  <nav class="flex flex-col">
    {#each items as item (item.route)}
      <a
        href={/* eslint-disable-line svelte/no-navigation-without-resolve */ resolveFinancialDataRoute(
          item.route,
        )}
        class={cn(
          'flex items-center gap-2 rounded-md p-2 text-sm leading-none transition-colors hover:bg-accent',
          itemHeight,
          activeRoute === item.route &&
            'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
        )}
      >
        {item.label}
      </a>
    {/each}
  </nav>
</Card>
