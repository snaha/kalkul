<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Copy, Eye, EyeOff, SquarePen, Trash2, X } from '@lucide/svelte'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import type {
    Frequency,
    ProfileInvestment,
    ProfileLiability,
    ProfileTangibleAsset,
    TangibleAssetStatus,
  } from '$lib/schemas'
  import { appStore } from '$lib/stores/app.svelte'
  import type { PortfolioStore } from '$lib/stores/portfolio.svelte'

  export type AssetKind = 'investment' | 'tangibleAsset' | 'liability'

  type Asset = ProfileInvestment | ProfileTangibleAsset | ProfileLiability

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    kind: AssetKind
    initial: Asset | undefined
    plan: PortfolioStore
  }

  let { open = $bindable(), onOpenChange, kind, initial, plan }: Props = $props()

  interface FormState {
    id: string
    name: string
    // Investment
    balance: number | undefined
    apy: number | undefined
    // Tangible asset
    value: number | undefined
    status: TangibleAssetStatus
    // Tangible asset (financed) + liability share these
    outstanding_balance: number | undefined
    installment_frequency: Frequency
    annual_rate: number | undefined
    installment_amount: number | undefined
    remaining_term: number | undefined
  }

  let currencyLabel = $derived(appStore.profile.currencyOrDefault)

  function blankForm(): FormState {
    const counter =
      kind === 'investment'
        ? (appStore.profile.investments ?? []).length + 1
        : kind === 'tangibleAsset'
          ? (appStore.profile.tangible_assets ?? []).length + 1
          : (appStore.profile.liabilities ?? []).length + 1
    const defaultName =
      kind === 'investment'
        ? $_('page.setup.investments.defaultName', { values: { index: counter } })
        : kind === 'tangibleAsset'
          ? $_('page.setup.tangibleAssets.defaultName', { values: { index: counter } })
          : $_('page.setup.liabilities.defaultName', { values: { index: counter } })
    return {
      id: crypto.randomUUID(),
      name: defaultName,
      balance: undefined,
      apy: undefined,
      value: undefined,
      status: 'fully_owned',
      outstanding_balance: undefined,
      installment_frequency: 'monthly',
      annual_rate: undefined,
      installment_amount: undefined,
      remaining_term: undefined,
    }
  }

  function seedForm(src: Asset | undefined): FormState {
    if (!src) return blankForm()
    const f = blankForm()
    f.id = src.id
    f.name = src.name
    if (kind === 'investment') {
      const inv = src as ProfileInvestment
      f.balance = inv.balance > 0 ? inv.balance : undefined
      f.apy = inv.apy > 0 ? inv.apy : undefined
    } else if (kind === 'tangibleAsset') {
      const a = src as ProfileTangibleAsset
      f.value = a.value > 0 ? a.value : undefined
      f.status = a.status
      f.outstanding_balance =
        a.outstanding_balance !== undefined && a.outstanding_balance > 0
          ? a.outstanding_balance
          : undefined
      f.installment_frequency = a.installment_frequency ?? 'monthly'
      f.annual_rate = a.annual_rate !== undefined && a.annual_rate > 0 ? a.annual_rate : undefined
      f.installment_amount =
        a.installment_amount !== undefined && a.installment_amount > 0
          ? a.installment_amount
          : undefined
      f.remaining_term =
        a.remaining_term !== undefined && a.remaining_term > 0 ? a.remaining_term : undefined
    } else {
      const l = src as ProfileLiability
      f.outstanding_balance = l.outstanding_balance > 0 ? l.outstanding_balance : undefined
      f.installment_frequency = l.installment_frequency
      f.annual_rate = l.annual_rate > 0 ? l.annual_rate : undefined
      f.installment_amount = l.installment_amount > 0 ? l.installment_amount : undefined
      f.remaining_term = l.remaining_term > 0 ? l.remaining_term : undefined
    }
    return f
  }

  let form = $state<FormState>(blankForm())
  let editingName = $state(false)
  let nameInputRef: HTMLInputElement | undefined = $state()

  // Re-seed form whenever the dialog opens.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      form = seedForm(initial)
      editingName = initial === undefined
    }
    wasOpen = open
  })

  const isNew = $derived(initial === undefined)

  const isIncluded = $derived.by(() => {
    if (isNew) return true
    const ids =
      kind === 'investment'
        ? plan.included_investment_ids
        : kind === 'tangibleAsset'
          ? plan.included_tangible_asset_ids
          : plan.included_liability_ids
    if (ids === undefined) return true
    return ids.includes(form.id)
  })

  function frequencyLabel(f: Frequency): string {
    if (f === 'yearly') return $_('page.setup.common.yearly')
    if (f === 'weekly') return $_('page.setup.common.weekly')
    return $_('page.setup.common.monthly')
  }

  function projectInvestment(f: FormState): ProfileInvestment {
    return { id: f.id, name: f.name, balance: f.balance ?? 0, apy: f.apy ?? 0 }
  }

  function projectTangibleAsset(f: FormState): ProfileTangibleAsset {
    return {
      id: f.id,
      name: f.name,
      value: f.value ?? 0,
      status: f.status,
      outstanding_balance: f.status === 'financed' ? (f.outstanding_balance ?? 0) : undefined,
      installment_frequency: f.status === 'financed' ? f.installment_frequency : undefined,
      annual_rate: f.status === 'financed' ? (f.annual_rate ?? 0) : undefined,
      installment_amount: f.status === 'financed' ? (f.installment_amount ?? 0) : undefined,
      remaining_term: f.status === 'financed' ? (f.remaining_term ?? 0) : undefined,
    }
  }

  function projectLiability(f: FormState): ProfileLiability {
    return {
      id: f.id,
      name: f.name,
      outstanding_balance: f.outstanding_balance ?? 0,
      installment_frequency: f.installment_frequency,
      annual_rate: f.annual_rate ?? 0,
      installment_amount: f.installment_amount ?? 0,
      remaining_term: f.remaining_term ?? 0,
    }
  }

  function close() {
    onOpenChange(false)
  }

  function save() {
    if (kind === 'investment') {
      const existing = appStore.profile.investments ?? []
      const projected = projectInvestment(form)
      const idx = existing.findIndex((i) => i.id === form.id)
      const next =
        idx === -1
          ? [...existing, projected]
          : existing.map((it, i) => (i === idx ? projected : it))
      appStore.updateProfile({ investments: next, has_investments: next.length > 0 })
      // If the plan has an explicit include list, append the new id so the
      // item is visible in this plan by default. Undefined include list means
      // "all included" already.
      if (idx === -1 && plan.included_investment_ids !== undefined) {
        plan.update({
          included_investment_ids: [...plan.included_investment_ids, form.id],
        })
      }
    } else if (kind === 'tangibleAsset') {
      const existing = appStore.profile.tangible_assets ?? []
      const projected = projectTangibleAsset(form)
      const idx = existing.findIndex((a) => a.id === form.id)
      const next =
        idx === -1
          ? [...existing, projected]
          : existing.map((it, i) => (i === idx ? projected : it))
      appStore.updateProfile({ tangible_assets: next, has_tangible_assets: next.length > 0 })
      if (idx === -1 && plan.included_tangible_asset_ids !== undefined) {
        plan.update({
          included_tangible_asset_ids: [...plan.included_tangible_asset_ids, form.id],
        })
      }
    } else {
      const existing = appStore.profile.liabilities ?? []
      const projected = projectLiability(form)
      const idx = existing.findIndex((l) => l.id === form.id)
      const next =
        idx === -1
          ? [...existing, projected]
          : existing.map((it, i) => (i === idx ? projected : it))
      appStore.updateProfile({ liabilities: next, has_liabilities: next.length > 0 })
      if (idx === -1 && plan.included_liability_ids !== undefined) {
        plan.update({
          included_liability_ids: [...plan.included_liability_ids, form.id],
        })
      }
    }
    close()
  }

  function duplicate() {
    if (kind === 'investment') {
      const existing = appStore.profile.investments ?? []
      const idx = existing.findIndex((i) => i.id === form.id)
      if (idx === -1) return
      const copy: ProfileInvestment = {
        ...existing[idx],
        id: crypto.randomUUID(),
        name: $_('page.setup.common.copySuffix', { values: { name: existing[idx].name } }),
      }
      const next = [...existing.slice(0, idx + 1), copy, ...existing.slice(idx + 1)]
      appStore.updateProfile({ investments: next })
    } else if (kind === 'tangibleAsset') {
      const existing = appStore.profile.tangible_assets ?? []
      const idx = existing.findIndex((a) => a.id === form.id)
      if (idx === -1) return
      const copy: ProfileTangibleAsset = {
        ...existing[idx],
        id: crypto.randomUUID(),
        name: $_('page.setup.common.copySuffix', { values: { name: existing[idx].name } }),
      }
      const next = [...existing.slice(0, idx + 1), copy, ...existing.slice(idx + 1)]
      appStore.updateProfile({ tangible_assets: next })
    } else {
      const existing = appStore.profile.liabilities ?? []
      const idx = existing.findIndex((l) => l.id === form.id)
      if (idx === -1) return
      const copy: ProfileLiability = {
        ...existing[idx],
        id: crypto.randomUUID(),
        name: $_('page.setup.common.copySuffix', { values: { name: existing[idx].name } }),
      }
      const next = [...existing.slice(0, idx + 1), copy, ...existing.slice(idx + 1)]
      appStore.updateProfile({ liabilities: next })
    }
    close()
  }

  function toggleExclude() {
    const allIds =
      kind === 'investment'
        ? (appStore.profile.investments ?? []).map((i) => i.id)
        : kind === 'tangibleAsset'
          ? (appStore.profile.tangible_assets ?? []).map((a) => a.id)
          : (appStore.profile.liabilities ?? []).map((l) => l.id)
    const currentIds =
      kind === 'investment'
        ? plan.included_investment_ids
        : kind === 'tangibleAsset'
          ? plan.included_tangible_asset_ids
          : plan.included_liability_ids
    const seeded = currentIds ?? allIds
    const nextIds = seeded.includes(form.id)
      ? seeded.filter((id) => id !== form.id)
      : [...seeded, form.id]
    if (kind === 'investment') {
      plan.update({ included_investment_ids: nextIds })
    } else if (kind === 'tangibleAsset') {
      plan.update({ included_tangible_asset_ids: nextIds })
    } else {
      plan.update({ included_liability_ids: nextIds })
    }
  }

  function remove() {
    const confirmMessage =
      kind === 'investment'
        ? $_('page.plan.deleteInvestmentConfirm')
        : kind === 'tangibleAsset'
          ? $_('page.plan.deleteTangibleAssetConfirm')
          : $_('page.plan.deleteLiabilityConfirm')
    if (!window.confirm(confirmMessage)) return
    if (kind === 'investment') {
      const next = (appStore.profile.investments ?? []).filter((i) => i.id !== form.id)
      appStore.updateProfile({ investments: next, has_investments: next.length > 0 })
    } else if (kind === 'tangibleAsset') {
      const next = (appStore.profile.tangible_assets ?? []).filter((a) => a.id !== form.id)
      appStore.updateProfile({ tangible_assets: next, has_tangible_assets: next.length > 0 })
    } else {
      const next = (appStore.profile.liabilities ?? []).filter((l) => l.id !== form.id)
      appStore.updateProfile({ liabilities: next, has_liabilities: next.length > 0 })
    }
    close()
  }

  function startRenaming() {
    editingName = true
    queueMicrotask(() => {
      nameInputRef?.focus()
      nameInputRef?.select()
    })
  }

  function stopRenaming() {
    editingName = false
  }
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-xl">
    <Dialog.Header class="flex flex-row items-center gap-1 border-b p-4 pe-3">
      {#if editingName}
        <Input
          bind:ref={nameInputRef}
          value={form.name}
          oninput={(e) => (form.name = (e.target as HTMLInputElement).value)}
          onblur={isNew ? undefined : stopRenaming}
          onkeydown={(e) => {
            if (!isNew && (e.key === 'Enter' || e.key === 'Escape')) stopRenaming()
          }}
          class="flex-1 text-lg font-semibold"
        />
      {:else}
        <Dialog.Title class="flex-1 truncate text-lg font-semibold">{form.name}</Dialog.Title>
      {/if}

      {#if !isNew}
        <Button
          variant="ghost"
          size="icon"
          onclick={startRenaming}
          aria-label={$_('page.plan.renameItem')}
        >
          <SquarePen class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={duplicate}
          aria-label={$_('page.plan.duplicateItem')}
        >
          <Copy class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={toggleExclude}
          aria-label={isIncluded ? $_('page.plan.excludeFromPlan') : $_('page.plan.includeInPlan')}
        >
          {#if isIncluded}
            <Eye class="size-4" />
          {:else}
            <EyeOff class="size-4 text-destructive" />
          {/if}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onclick={remove}
          aria-label={$_('page.plan.deleteItem')}
        >
          <Trash2 class="size-4" />
        </Button>
      {/if}

      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-4">
      {#if kind === 'investment'}
        <div class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.investments.currentBalance')}</Label>
            <SuffixedInput
              value={form.balance}
              suffix={currencyLabel}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => (form.balance = v)}
            />
          </div>
          <div class="flex w-32 flex-col gap-2">
            <Label>{$_('page.setup.investments.apy')}</Label>
            <SuffixedInput
              value={form.apy}
              suffix="%"
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => (form.apy = v)}
            />
          </div>
        </div>
      {:else if kind === 'tangibleAsset'}
        <div class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.tangibleAssets.currentValue')}</Label>
            <SuffixedInput
              value={form.value}
              suffix={currencyLabel}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => (form.value = v)}
            />
          </div>
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.tangibleAssets.status')}</Label>
            <Select.Root
              type="single"
              value={form.status}
              onValueChange={(v) => {
                if (v) form.status = v as TangibleAssetStatus
              }}
            >
              <Select.Trigger class="w-full">
                {form.status === 'financed'
                  ? $_('page.setup.tangibleAssets.financed')
                  : $_('page.setup.tangibleAssets.fullyOwned')}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="fully_owned">
                  {$_('page.setup.tangibleAssets.fullyOwned')}
                </Select.Item>
                <Select.Item value="financed">
                  {$_('page.setup.tangibleAssets.financed')}
                </Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        {#if form.status === 'financed'}
          <div class="flex flex-col gap-2">
            <Label>{$_('page.setup.tangibleAssets.outstandingBalance')}</Label>
            <SuffixedInput
              value={form.outstanding_balance}
              suffix={currencyLabel}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => (form.outstanding_balance = v)}
            />
          </div>
          <div class="flex items-end gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.tangibleAssets.installmentFrequency')}</Label>
              <Select.Root
                type="single"
                value={form.installment_frequency}
                onValueChange={(v) => {
                  if (v) form.installment_frequency = v as Frequency
                }}
              >
                <Select.Trigger class="w-full">
                  {frequencyLabel(form.installment_frequency)}
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="monthly">{$_('page.setup.common.monthly')}</Select.Item>
                  <Select.Item value="yearly">{$_('page.setup.common.yearly')}</Select.Item>
                  <Select.Item value="weekly">{$_('page.setup.common.weekly')}</Select.Item>
                </Select.Content>
              </Select.Root>
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.tangibleAssets.annualRate')}</Label>
              <SuffixedInput
                value={form.annual_rate}
                suffix="%"
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => (form.annual_rate = v)}
              />
            </div>
          </div>
          <div class="flex items-end gap-2">
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.tangibleAssets.installmentAmount')}</Label>
              <SuffixedInput
                value={form.installment_amount}
                suffix={currencyLabel}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => (form.installment_amount = v)}
              />
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <Label>{$_('page.setup.tangibleAssets.remainingTerm')}</Label>
              <SuffixedInput
                value={form.remaining_term}
                suffix={$_('page.setup.tangibleAssets.years')}
                formatNumber={appStore.formatNumber}
                onValueChange={(v) => (form.remaining_term = v)}
              />
            </div>
          </div>
        {/if}
      {:else}
        <!-- liability -->
        <div class="flex flex-col gap-2">
          <Label>{$_('page.setup.liabilities.outstandingBalance')}</Label>
          <SuffixedInput
            value={form.outstanding_balance}
            suffix={currencyLabel}
            formatNumber={appStore.formatNumber}
            onValueChange={(v) => (form.outstanding_balance = v)}
          />
        </div>
        <div class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.liabilities.installmentFrequency')}</Label>
            <Select.Root
              type="single"
              value={form.installment_frequency}
              onValueChange={(v) => {
                if (v) form.installment_frequency = v as Frequency
              }}
            >
              <Select.Trigger class="w-full">
                {frequencyLabel(form.installment_frequency)}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="monthly">{$_('page.setup.common.monthly')}</Select.Item>
                <Select.Item value="yearly">{$_('page.setup.common.yearly')}</Select.Item>
                <Select.Item value="weekly">{$_('page.setup.common.weekly')}</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.liabilities.annualRate')}</Label>
            <SuffixedInput
              value={form.annual_rate}
              suffix="%"
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => (form.annual_rate = v)}
            />
          </div>
        </div>
        <div class="flex items-end gap-2">
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.liabilities.installmentAmount')}</Label>
            <SuffixedInput
              value={form.installment_amount}
              suffix={currencyLabel}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => (form.installment_amount = v)}
            />
          </div>
          <div class="flex flex-1 flex-col gap-2">
            <Label>{$_('page.setup.liabilities.remainingTerm')}</Label>
            <SuffixedInput
              value={form.remaining_term}
              suffix={$_('page.setup.liabilities.years')}
              formatNumber={appStore.formatNumber}
              onValueChange={(v) => (form.remaining_term = v)}
            />
          </div>
        </div>
      {/if}
    </div>

    <Dialog.Footer class="flex flex-row justify-end gap-2 border-t p-4">
      <Button variant="secondary" onclick={close}>{$_('page.plan.cancel')}</Button>
      <Button onclick={save}>{$_('page.plan.saveChanges')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
