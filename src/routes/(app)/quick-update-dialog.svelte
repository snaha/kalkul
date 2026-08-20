<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ArrowRight from '@lucide/svelte/icons/arrow-right'
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Separator } from '$lib/components/ui/separator'
  import { percentChange } from '$lib/current-values'
  import type { Profile } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import { cn } from '$lib/utils'

  interface Props {
    open: boolean
    /** Stored balances, as of the last snapshot — the "last updated" column. */
    storedProfile: Profile
    /** The same balances projected to today — what the inputs start from. */
    projectedProfile: Profile
    /** Date the stored balances were confirmed (date-only ISO string). */
    lastUpdated: string
  }

  let { open = $bindable(), storedProfile, projectedProfile, lastUpdated }: Props = $props()

  interface Row {
    id: string
    label: string
    previous: number
    /** Projected default, restored by "Reset values". */
    suggested: number
  }

  // Cash and investments only — the values that drift on their own between
  // updates. Everything else is edited explicitly in financial data.
  const rows = $derived<Row[]>([
    {
      id: 'cash',
      label: $_('page.financialData.nav.cash'),
      previous: storedProfile.cash_amount ?? 0,
      suggested: projectedProfile.cash_amount ?? 0,
    },
    ...(projectedProfile.investments ?? []).map((investment) => ({
      id: investment.id,
      label: investment.name,
      previous:
        storedProfile.investments?.find((i) => i.id === investment.id)?.balance ??
        investment.balance,
      suggested: investment.balance,
    })),
  ])

  // Edited values keyed by row id; a row with no entry uses its suggestion.
  let edits = $state<Record<string, number | undefined>>({})

  const valueOf = (row: Row) => edits[row.id] ?? row.suggested

  function reset(): void {
    edits = {}
  }

  // Re-seed whenever the dialog is opened so a cancelled edit never lingers.
  $effect(() => {
    if (open) reset()
  })

  function confirm(): void {
    const cashRow = rows.find((row) => row.id === 'cash')
    // confirmBalances, not updateProfile: confirming unchanged values is still a
    // confirmation and has to re-date the baseline snapshot to today.
    appStore.confirmBalances({
      cash_amount: cashRow ? valueOf(cashRow) : projectedProfile.cash_amount,
      investments: (storedProfile.investments ?? []).map((investment) => {
        const row = rows.find((r) => r.id === investment.id)
        return { ...investment, balance: row ? valueOf(row) : investment.balance }
      }),
    })
    open = false
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="gap-0 p-0 sm:max-w-[576px]">
    <Dialog.Header class="p-4">
      <Dialog.Title>{$_('page.dashboard.quickUpdate.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {$_('page.dashboard.quickUpdate.description')}
      </Dialog.Description>
      <p class="text-sm text-muted-foreground">{$_('page.dashboard.quickUpdate.hint')}</p>
    </Dialog.Header>

    <div class="px-4 pb-4">
      <Separator class="mb-4" />

      <table class="w-full">
        <thead>
          <tr class="text-left align-bottom">
            <th class="w-28"
              ><span class="sr-only">{$_('page.dashboard.quickUpdate.item')}</span></th
            >
            <th class="px-1 py-2 font-medium">
              <span class="block text-sm">{appStore.formatDateOnly(lastUpdated)}</span>
              <span class="block text-xs font-normal text-muted-foreground">
                {$_('page.dashboard.quickUpdate.lastUpdatedValue')}
              </span>
            </th>
            <th class="w-4"></th>
            <th class="p-2 font-medium">
              <span class="block text-sm">{$_('page.dashboard.quickUpdate.today')}</span>
              <span class="block text-xs font-normal text-muted-foreground">
                {$_('page.dashboard.quickUpdate.currentValue')}
              </span>
            </th>
            <th class="w-20"></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.id)}
            {@const change = percentChange(row.previous, valueOf(row))}
            <tr>
              <th scope="row" class="py-2 pr-1 text-left text-sm font-medium">{row.label}</th>
              <td class="px-1 py-2 text-sm text-muted-foreground">
                {appStore.formatCurrencyCode(row.previous)}
              </td>
              <td class="text-muted-foreground">
                <ArrowRight class="size-4" aria-hidden="true" />
              </td>
              <td class="p-1">
                <SuffixedInput
                  value={valueOf(row)}
                  suffix={appStore.profile.currencyOrDefault}
                  aria-label={$_('page.dashboard.quickUpdate.currentValueFor', {
                    values: { name: row.label },
                  })}
                  formatNumber={appStore.formatNumber}
                  onValueChange={(value) => (edits[row.id] = value ?? 0)}
                />
              </td>
              <td
                class={cn(
                  'py-2 pl-1 text-right text-sm',
                  change !== undefined && change < 0 ? 'text-destructive' : 'text-success',
                )}
              >
                {change === undefined ? '—' : appStore.formatPercent(change, 2, true)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <Separator />

    <Dialog.Footer class="flex-row items-center justify-between bg-muted p-4 sm:justify-between">
      <Button variant="ghost" onclick={reset}>
        <RotateCcw />
        {$_('page.dashboard.quickUpdate.resetValues')}
      </Button>
      <Button onclick={confirm}>{$_('page.dashboard.quickUpdate.confirm')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
