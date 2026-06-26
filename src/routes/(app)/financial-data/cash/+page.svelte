<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Label } from '$lib/components/ui/label'
  import { getCashTotal } from '$lib/financial-totals'
  import { appStore } from '$lib/stores/app.svelte'
  import { formatLastUpdated } from '$lib/utils'

  const cash = $derived(getCashTotal(appStore.profile))

  const lastUpdatedDate = $derived(formatLastUpdated(appStore.lastUpdated, $locale))

  function handleCashChange(value: number | undefined) {
    appStore.updateProfile({ cash_amount: value })
  }
</script>

<div class="flex w-full flex-col items-start gap-2">
  <p class="text-lg leading-7 font-medium">{$_('page.financialData.cash.title')}</p>
  <p class="text-3xl leading-9 font-bold">{appStore.formatCurrencyCode(cash)}</p>
  <span class="text-xs leading-4 text-muted-foreground">
    {$_('page.financialData.overview.lastUpdated', { values: { date: lastUpdatedDate } })}
  </span>
</div>

<div class="flex w-full flex-col items-start gap-2">
  <Label for="cash-amount">{$_('page.setup.finances.cashLabel')}</Label>
  <SuffixedInput
    id="cash-amount"
    value={appStore.profile.cash_amount}
    suffix={appStore.profile.currencyOrDefault}
    formatNumber={appStore.formatNumber}
    onValueChange={handleCashChange}
    class="w-full"
  />
  <p class="text-sm leading-5 text-muted-foreground">
    {$_('page.setup.finances.cashDescription')}
  </p>
</div>
