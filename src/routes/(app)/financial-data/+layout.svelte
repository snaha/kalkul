<script lang="ts">
  import { page } from '$app/state'

  import FinancialDataHeader from '$lib/components/financial-data-header.svelte'
  import FinancialDataSidebar from '$lib/components/financial-data-sidebar.svelte'
  import { resolveFinancialDataRoute } from '$lib/financial-data-nav'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  let { children } = $props()

  const overviewPath = $derived(resolveFinancialDataRoute(routes.FINANCIAL_DATA).replace(/\/$/, ''))
  const isOverview = $derived(page.url.pathname.replace(/\/$/, '') === overviewPath)

  const date = $derived.by(() => {
    const ms = appStore.lastUpdated > 0 ? appStore.lastUpdated : Date.now()
    const d = new Date(ms)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  })

  const backTarget = $derived<'home' | 'overview'>(isOverview ? 'home' : 'overview')
</script>

<div class="flex flex-1 flex-col">
  <FinancialDataHeader {backTarget} {date} />

  <div class="flex flex-col items-stretch gap-8 px-8 pb-8 md:flex-row md:items-start">
    <!-- Desktop sidebar (md+) -->
    <aside class="hidden self-stretch md:block">
      <FinancialDataSidebar variant="sidebar" />
    </aside>

    <!-- Right content column: centered, max-w-672 inner wrapper -->
    <div class="flex flex-1 flex-col items-center self-stretch overflow-clip">
      <div class="flex w-full max-w-[672px] flex-col items-start gap-8">
        {@render children()}
      </div>
    </div>

    <!-- Mobile sidebar (only on Overview, below content) -->
    {#if isOverview}
      <div class="md:hidden">
        <FinancialDataSidebar variant="list" />
      </div>
    {/if}
  </div>
</div>
