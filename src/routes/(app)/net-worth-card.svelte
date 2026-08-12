<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Info from '@lucide/svelte/icons/info'

  import DonutChart from '$lib/components/donut-chart.svelte'
  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'
  import type { CategoryLabel } from '$lib/financial-totals'
  import { getNetWorth, getOverviewSegments, getTotalAssets } from '$lib/financial-totals'
  import type { Profile } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    /** Balances as they stand today — pass the projected profile. */
    profile: Profile
    /**
     * Date the balances were last confirmed, when that was before today. Drives
     * the "projected from" caption; omit it when the figures are current.
     */
    projectedFrom?: string
  }

  let { profile, projectedFrom }: Props = $props()

  const CATEGORY_LABELS: Record<CategoryLabel, string> = {
    cash: 'page.financialData.nav.cash',
    investments: 'page.financialData.nav.investments',
    'tangible-assets': 'page.financialData.nav.tangibleAssets',
    liabilities: 'page.financialData.nav.liabilities',
  }

  const segments = $derived(getOverviewSegments(profile))
  const assetSegments = $derived(segments.filter((s) => s.label !== 'liabilities'))
  const liabilitySegments = $derived(segments.filter((s) => s.label === 'liabilities'))
  const totalAssets = $derived(getTotalAssets(profile))
  const netWorth = $derived(getNetWorth(profile))
</script>

<Card.Root class="flex-1 gap-0 self-stretch py-0 shadow-xs">
  <Card.Content class="flex flex-1 flex-col justify-between p-4">
    <div class="flex items-center gap-4">
      <DonutChart
        segments={segments.map((s) => ({ ...s, label: $_(CATEGORY_LABELS[s.label]) }))}
        variant="pie"
        size={112}
      />
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex items-center gap-1">
          <p class="text-sm font-medium">{$_('page.dashboard.finances.netWorthCard.title')}</p>
          <HelpTooltip
            text={$_('page.dashboard.finances.netWorthCard.help')}
            icon={Info}
            iconClass="size-3"
          />
        </div>
        <p class="text-xl font-extrabold">{appStore.formatCompactCurrency(netWorth)}</p>
        <p class="text-xs text-muted-foreground">
          {#if projectedFrom}
            {$_('page.dashboard.finances.netWorthCard.projected', {
              values: { date: appStore.formatDateOnly(projectedFrom) },
            })}
          {:else}
            {$_('page.dashboard.finances.netWorthCard.actual')}
          {/if}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex flex-col gap-1">
        {#each assetSegments as segment (segment.label)}
          <div class="flex items-center gap-2 text-xs">
            <div
              class="size-4 shrink-0 rounded-xs"
              style:background-color={segment.color}
              aria-hidden="true"
            ></div>
            <span class="flex-1 truncate">{$_(CATEGORY_LABELS[segment.label])}</span>
            <span class="truncate font-medium">
              {appStore.formatCompactCurrency(segment.value)}
            </span>
          </div>
        {/each}
      </div>

      <Separator />

      <div class="flex items-center gap-2 text-xs">
        <span class="flex-1 truncate font-medium">
          {$_('page.dashboard.finances.netWorthCard.totalAssets')}
        </span>
        <span class="truncate font-bold">{appStore.formatCompactCurrency(totalAssets)}</span>
      </div>

      {#each liabilitySegments as segment (segment.label)}
        <Separator />
        <div class="flex items-center gap-2 text-xs">
          <div
            class="size-4 shrink-0 rounded-xs"
            style:background-color={segment.color}
            aria-hidden="true"
          ></div>
          <span class="flex-1 truncate">{$_(CATEGORY_LABELS[segment.label])}</span>
          <span class="truncate font-medium text-destructive">
            {appStore.formatCompactCurrency(-segment.value)}
          </span>
        </div>
      {/each}

      <Separator />

      <div class="flex items-center gap-2 text-xs">
        <span class="flex-1 truncate font-medium">
          {$_('page.dashboard.finances.netWorthCard.totalNetWorth')}
        </span>
        <span class="truncate font-bold">{appStore.formatCompactCurrency(netWorth)}</span>
      </div>
    </div>
  </Card.Content>
</Card.Root>
