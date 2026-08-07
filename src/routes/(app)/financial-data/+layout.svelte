<script lang="ts">
  import FinancialDataHeader from '$lib/components/financial-data-header.svelte'
  import FinancialDataSidebar from '$lib/components/financial-data-sidebar.svelte'
  import { appStore } from '$lib/stores/app.svelte'

  let { children } = $props()

  const date = $derived(appStore.formatLastUpdated())
</script>

<div class="flex flex-1 flex-col">
  <FinancialDataHeader {date} />

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

    <!-- Mobile sidebar (always shown on small screens) -->
    <div class="md:hidden">
      <FinancialDataSidebar variant="list" />
    </div>
  </div>
</div>
