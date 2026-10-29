<script lang="ts">
  import { _ } from 'svelte-i18n'

  import X from '@lucide/svelte/icons/x'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import { DEFAULT_RUNWAY_SETTINGS, RUNWAY_CAP_YEARS, getRunwayYears } from '$lib/runway'
  import type { Profile, RunwaySettings } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    open: boolean
    profile: Profile
  }

  let { open = $bindable(), profile }: Props = $props()

  const uid = $props.id()

  // Mounted only while open, so the form seeds once from what is stored and
  // the footer previews the edits until Apply writes them to the profile.
  // svelte-ignore state_referenced_locally
  let form = $state<RunwaySettings>({ ...(profile.runway_settings ?? DEFAULT_RUNWAY_SETTINGS) })

  const preview = $derived(getRunwayYears(profile, form))

  function apply(): void {
    appStore.updateProfile({ runway_settings: $state.snapshot(form) })
    open = false
  }
</script>

{#snippet switchRow(label: string, help: string, checked: boolean, set: (v: boolean) => void)}
  <label class="flex cursor-pointer items-start gap-2">
    <Switch {checked} onCheckedChange={(v) => set(v === true)} />
    <span class="flex flex-1 flex-col gap-0.5">
      <span class="text-sm font-medium">{label}</span>
      <span class="text-sm text-muted-foreground">{help}</span>
    </span>
  </label>
{/snippet}

{#snippet growthBlock(
  id: string,
  enabled: boolean,
  growth: { label: string; help: string; checked: boolean; set: (v: boolean) => void },
  tax: { label: string; help: string; value: number; set: (v: number) => void },
)}
  <div class="flex flex-col gap-4 border-l-4 pl-4">
    <label class="flex cursor-pointer items-start gap-2">
      <Checkbox
        checked={growth.checked}
        disabled={!enabled}
        onCheckedChange={(v) => growth.set(v === true)}
      />
      <span class="flex flex-col gap-1.5">
        <span class="text-sm leading-none font-medium">{growth.label}</span>
        <span class="text-sm text-muted-foreground">{growth.help}</span>
      </span>
    </label>
    <div class="flex items-end gap-2">
      <div class="flex flex-1 flex-col gap-2">
        <Label for={id}>{tax.label}</Label>
        <SuffixedInput
          {id}
          value={tax.value}
          suffix="%"
          formatNumber={appStore.formatNumber}
          onValueChange={(v) => tax.set(v ?? 0)}
        />
      </div>
      <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">{tax.help}</p>
    </div>
  </div>
{/snippet}

<Dialog.Root bind:open>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-xl">
    <Dialog.Header class="flex flex-row items-center p-4">
      <Dialog.Title class="flex-1 text-base font-medium">
        {$_('page.dashboard.finances.runwaySettings.title')}
      </Dialog.Title>
      <Button
        variant="ghost"
        size="icon"
        onclick={() => (open = false)}
        aria-label={$_('page.dashboard.finances.runwaySettings.close')}
      >
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex flex-col gap-4 px-4 pb-4">
      <Dialog.Description class="text-base text-foreground">
        {$_('page.dashboard.finances.runwaySettings.description')}
      </Dialog.Description>
      <Separator />

      {@render switchRow(
        $_('page.dashboard.finances.runwaySettings.includeIncome'),
        $_('page.dashboard.finances.runwaySettings.includeIncomeHelp'),
        form.include_income,
        (v) => (form.include_income = v),
      )}

      {@render switchRow(
        $_('page.dashboard.finances.runwaySettings.withdrawInvestments'),
        $_('page.dashboard.finances.runwaySettings.withdrawInvestmentsHelp'),
        form.withdraw_investments,
        (v) => (form.withdraw_investments = v),
      )}
      {@render growthBlock(
        `${uid}-investmentTaxRate`,
        form.withdraw_investments,
        {
          label: $_('page.dashboard.finances.runwaySettings.investmentGrowth'),
          help: $_('page.dashboard.finances.runwaySettings.investmentGrowthHelp'),
          checked: form.investment_growth,
          set: (v) => (form.investment_growth = v),
        },
        {
          label: $_('page.dashboard.finances.runwaySettings.investmentTaxRate'),
          help: $_('page.dashboard.finances.runwaySettings.investmentTaxRateHelp'),
          value: form.investment_tax_rate,
          set: (v) => (form.investment_tax_rate = v),
        },
      )}

      {@render switchRow(
        $_('page.dashboard.finances.runwaySettings.sellTangibleAssets'),
        $_('page.dashboard.finances.runwaySettings.sellTangibleAssetsHelp'),
        form.sell_tangible_assets,
        (v) => (form.sell_tangible_assets = v),
      )}
      {@render growthBlock(
        `${uid}-tangibleAssetTaxRate`,
        form.sell_tangible_assets,
        {
          label: $_('page.dashboard.finances.runwaySettings.tangibleAssetGrowth'),
          help: $_('page.dashboard.finances.runwaySettings.tangibleAssetGrowthHelp'),
          checked: form.tangible_asset_growth,
          set: (v) => (form.tangible_asset_growth = v),
        },
        {
          label: $_('page.dashboard.finances.runwaySettings.tangibleAssetTaxRate'),
          help: $_('page.dashboard.finances.runwaySettings.tangibleAssetTaxRateHelp'),
          value: form.tangible_asset_tax_rate,
          set: (v) => (form.tangible_asset_tax_rate = v),
        },
      )}
    </div>

    <Dialog.Footer
      class="flex flex-row items-center justify-between border-t bg-muted p-4 sm:justify-between"
    >
      <p class="text-base">
        {$_('page.dashboard.finances.runwaySettings.preview')}
        <strong>
          {#if preview === undefined}
            —
          {:else if preview === Infinity}
            {$_('page.dashboard.finances.runwayCard.capped', {
              values: { years: appStore.formatNumber(RUNWAY_CAP_YEARS) },
            })}
          {:else}
            {$_('page.dashboard.finances.runwayCard.value', {
              values: { years: appStore.formatNumber(Math.round(preview * 10) / 10) },
            })}
          {/if}
        </strong>
      </p>
      <div class="flex items-center gap-2">
        <Button variant="ghost" onclick={() => (form = { ...DEFAULT_RUNWAY_SETTINGS })}>
          {$_('page.dashboard.finances.runwaySettings.reset')}
        </Button>
        <Button onclick={apply}>{$_('page.dashboard.finances.runwaySettings.apply')}</Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
