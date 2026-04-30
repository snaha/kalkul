<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { page } from '$app/state'

  import { Card } from '$lib/components/ui/card'
  import { resolveFinancialDataRoute } from '$lib/financial-data-nav'
  import routes from '$lib/routes'
  import { cn } from '$lib/utils'

  interface Props {
    variant?: 'sidebar' | 'list'
    class?: string
  }

  let { variant = 'sidebar', class: className }: Props = $props()

  const items: { href: string; label: string }[] = $derived([
    {
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA),
      label: $_('page.financialData.nav.overview'),
    },
    {
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_CASH),
      label: $_('page.financialData.nav.cash'),
    },
    {
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_INVESTMENTS),
      label: $_('page.financialData.nav.investments'),
    },
    {
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_TANGIBLE_ASSETS),
      label: $_('page.financialData.nav.tangibleAssets'),
    },
    {
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_LIABILITIES),
      label: $_('page.financialData.nav.liabilities'),
    },
    {
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_INCOMES),
      label: $_('page.financialData.nav.incomes'),
    },
    {
      href: resolveFinancialDataRoute(routes.FINANCIAL_DATA_EXPENSES),
      label: $_('page.financialData.nav.expenses'),
    },
  ])

  const activePath = $derived(page.url.pathname.replace(/\/$/, ''))
  const cardWidth = $derived(variant === 'sidebar' ? 'w-72' : '')
  const itemHeight = $derived(variant === 'sidebar' ? 'h-8' : 'h-10')

  function isActive(href: string): boolean {
    return activePath === href.replace(/\/$/, '')
  }
</script>

<Card class={cn('gap-0 p-2', cardWidth, className)}>
  <nav class="flex flex-col">
    {#each items as item (item.href)}
      <a
        href={/* eslint-disable-line svelte/no-navigation-without-resolve */ item.href}
        class={cn(
          'flex items-center gap-2 rounded-md p-2 text-sm leading-none transition-colors hover:bg-accent',
          itemHeight,
          isActive(item.href) && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
        )}
      >
        {item.label}
      </a>
    {/each}
  </nav>
</Card>
