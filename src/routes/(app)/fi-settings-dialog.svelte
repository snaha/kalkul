<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ArrowDown from '@lucide/svelte/icons/arrow-down'
  import Info from '@lucide/svelte/icons/info'
  import X from '@lucide/svelte/icons/x'

  import HelpTooltip from '$lib/components/help-tooltip.svelte'
  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import {
    getAnnualOutflowsTotal,
    getFiNumber,
    getFiPercent,
    getInvestableNetWorth,
  } from '$lib/financial-totals'
  import { DEFAULT_FI_WITHDRAWAL_RATE, type Profile } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    open: boolean
    profile: Profile
  }

  let { open = $bindable(), profile }: Props = $props()

  const uid = $props.id()

  // Mounted only while open, so the rate seeds once from what is stored and
  // the figures preview the edit until Apply writes it to the profile.
  // svelte-ignore state_referenced_locally
  let rate = $state<number | undefined>(profile.fi_withdrawal_rate ?? DEFAULT_FI_WITHDRAWAL_RATE)

  const valid = $derived(rate !== undefined && rate > 0 && rate <= 100)
  const fiNumber = $derived(valid ? getFiNumber(profile, rate) : undefined)
  const fiPercent = $derived(valid ? getFiPercent(profile, rate) : undefined)

  function apply(): void {
    appStore.updateProfile({ fi_withdrawal_rate: rate })
    open = false
  }
</script>

<!-- A figure the dialog reads out: its label, with a tooltip when the frame
     draws an info icon beside it, over the amount. -->
{#snippet figure(label: string, value: string, opts: { help?: string; valueClass?: string } = {})}
  <div class="flex flex-1 flex-col">
    <div class="flex items-center gap-2">
      <p class="text-sm font-medium">{label}</p>
      {#if opts.help}
        <HelpTooltip text={opts.help} icon={Info} iconClass="size-3" />
      {/if}
    </div>
    <p class={['text-lg', opts.valueClass ?? 'font-bold']}>{value}</p>
  </div>
{/snippet}

<Dialog.Root bind:open>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-xl">
    <Dialog.Header class="flex flex-row items-center p-4">
      <Dialog.Title class="flex-1 text-base font-medium">
        {$_('page.dashboard.finances.fiSettings.title')}
      </Dialog.Title>
      <Button
        variant="ghost"
        size="icon"
        onclick={() => (open = false)}
        aria-label={$_('page.dashboard.finances.fiSettings.close')}
      >
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex flex-col gap-4 px-4 pb-4">
      <Dialog.Description class="text-base text-foreground">
        {$_('page.dashboard.finances.fiSettings.description')}
      </Dialog.Description>
      <Separator />

      <div class="flex gap-4">
        {@render figure(
          $_('page.dashboard.finances.fiSettings.livingCost'),
          appStore.formatCurrencyCode(getAnnualOutflowsTotal(profile)),
          { help: $_('page.dashboard.finances.fiSettings.livingCostHelp') },
        )}
        {@render figure(
          $_('page.dashboard.finances.fiSettings.portfolioValue'),
          appStore.formatCurrencyCode(getInvestableNetWorth(profile)),
          { help: $_('page.dashboard.finances.fiSettings.portfolioValueHelp') },
        )}
      </div>

      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <Label for="{uid}-withdrawalRate">
            {$_('page.dashboard.finances.fiSettings.withdrawalRate')}
          </Label>
          <HelpTooltip
            text={$_('page.dashboard.finances.fiSettings.withdrawalRateHelp')}
            icon={Info}
            iconClass="size-3"
          />
        </div>
        <div class="flex items-end gap-4">
          <div class="flex-1">
            <SuffixedInput
              id="{uid}-withdrawalRate"
              value={rate}
              suffix="%"
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => (rate = v)}
            />
          </div>
          <p class="flex-1 text-xs">
            {$_('page.dashboard.finances.fiSettings.withdrawalRateDescription')}
          </p>
        </div>
      </div>

      <ArrowDown class="size-6" aria-hidden="true" />

      <div class="flex items-end gap-4">
        {@render figure(
          $_('page.dashboard.finances.fiSettings.fiNumber'),
          fiNumber === undefined ? '—' : appStore.formatCurrencyCode(fiNumber),
          { valueClass: 'font-semibold' },
        )}
        <p class="flex-1 text-xs">
          {$_('page.dashboard.finances.fiSettings.fiNumberDescription')}
        </p>
      </div>
    </div>

    <Dialog.Footer
      class="flex flex-row items-center justify-between border-t bg-muted p-4 sm:justify-between"
    >
      <p class="text-base">
        {$_('page.dashboard.finances.fiSettings.preview')}
        <strong>{fiPercent === undefined ? '—' : appStore.formatPercent(fiPercent, 0)}</strong>
      </p>
      <div class="flex items-center gap-2">
        <Button variant="ghost" onclick={() => (rate = DEFAULT_FI_WITHDRAWAL_RATE)}>
          {$_('page.dashboard.finances.fiSettings.reset')}
        </Button>
        <Button onclick={apply} disabled={!valid}>
          {$_('page.dashboard.finances.fiSettings.apply')}
        </Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
