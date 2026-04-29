<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { page } from '$app/state'

  import { Card } from '$lib/components/ui/card'
  import { type FinancialDataRoute, resolveFinancialDataRoute } from '$lib/financial-data-nav'
  import routes from '$lib/routes'
  import { cn } from '$lib/utils'

  interface Props {
    variant?: 'sidebar' | 'list'
    class?: string
  }

  let { variant = 'sidebar', class: className }: Props = $props()

  const items: { route: FinancialDataRoute; href: string; label: string }[] = $derived([
    {
      route: routes.FINANCIAL_DATA,
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA),
      label: $_('page.financialData.nav.overview'),
    },
    {
      route: routes.FINANCIAL_DATA_CASH,
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_CASH),
      label: $_('page.financialData.nav.cash'),
    },
    {
      route: routes.FINANCIAL_DATA_INVESTMENTS,
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_INVESTMENTS),
      label: $_('page.financialData.nav.investments'),
    },
    {
      route: routes.FINANCIAL_DATA_TANGIBLE_ASSETS,
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_TANGIBLE_ASSETS),
      label: $_('page.financialData.nav.tangibleAssets'),
    },
    {
      route: routes.FINANCIAL_DATA_LIABILITIES,
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_LIABILITIES),
      label: $_('page.financialData.nav.liabilities'),
    },
    {
      route: routes.FINANCIAL_DATA_INCOMES,
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_INCOMES),
      label: $_('page.financialData.nav.incomes'),
    },
    {
      route: routes.FINANCIAL_DATA_EXPENSES,
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_EXPENSES),
      label: $_('page.financialData.nav.expenses'),
    },
  ])

  const activePath = $derived(page.url.pathname.replace(/\/$/, ''))

  function isActive(href: string): boolean {
    return activePath === href.replace(/\/$/, '')
  }
</script>

{#if variant === 'sidebar'}
  <Card class={cn('w-72 gap-0 p-2', className)}>
    <nav class="flex flex-col">
      {#each items as item (item.route)}
        <a
          href={/* eslint-disable-line svelte/no-navigation-without-resolve */ item.href}
          class={cn(
            'flex h-8 items-center gap-2 rounded-md p-2 text-sm leading-none transition-colors hover:bg-accent',
            isActive(item.href) && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
          )}
        >
          {item.label}
        </a>
      {/each}
    </nav>
  </Card>
{:else}
  <Card class={cn('gap-0 p-2', className)}>
    <nav class="flex flex-col">
      {#each items as item (item.route)}
        <a
          href={/* eslint-disable-line svelte/no-navigation-without-resolve */ item.href}
          class={cn(
            'flex h-10 items-center gap-2 rounded-md p-2 text-sm leading-none transition-colors hover:bg-accent',
            isActive(item.href) && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
          )}
        >
          {item.label}
        </a>
      {/each}
    </nav>
  </Card>
{/if}
