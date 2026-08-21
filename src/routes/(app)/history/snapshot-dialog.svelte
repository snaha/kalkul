<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Check from '@lucide/svelte/icons/check'
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import { Separator } from '$lib/components/ui/separator'
  import type { Snapshot } from '$lib/schemas'
  import { getFrequencyShortLabel } from '$lib/select-options'
  import { appStore } from '$lib/stores/app.svelte'

  import type { SnapshotField, SnapshotSectionId } from './snapshot-form'
  import { buildSnapshotSections, snapshotFromFields } from './snapshot-form'

  interface Props {
    open: boolean
    /** Adding re-uses the same form; only the title and the date differ. */
    mode: 'add' | 'edit'
    /** Snapshot the fields are seeded from, and the base a save is merged into. */
    source: Snapshot
    /** Date the edited snapshot currently sits at, so a re-date can vacate it. */
    originalDate?: string
    /** Every date already recorded, to keep a save from overwriting another. */
    takenDates: string[]
    /** Today as a date-only ISO string — the latest date a snapshot may carry. */
    today: string
    onConfirm: (snapshot: Snapshot, originalDate?: string) => void
  }

  let {
    open = $bindable(),
    mode,
    source,
    originalDate,
    takenDates,
    today,
    onConfirm,
  }: Props = $props()

  // The stored profile decides which items the dialog offers a field for; the
  // source snapshot supplies the figures.
  const sections = $derived(buildSnapshotSections(appStore.profile.toJSON(), source))

  let date = $state('')
  // Only what the user typed, keyed by field key. A field with no entry — or
  // one cleared back to empty — falls back to its seeded value.
  let edits = $state<Record<string, number | undefined>>({})

  function reset(): void {
    date = source.date
    edits = {}
  }

  // Re-seed on every open so a cancelled edit never carries into the next one.
  $effect(() => {
    if (open) reset()
  })

  const dateError = $derived.by(() => {
    if (!date) return undefined
    if (date > today) return $_('page.history.dialog.dateInFuture')
    // Re-dating onto another snapshot would silently replace it. Its own
    // original date is of course fine to keep.
    if (date !== originalDate && takenDates.includes(date))
      return $_('page.history.dialog.dateTaken')
    return undefined
  })

  const currency = $derived(appStore.profile.currencyOrDefault)

  function suffixFor(field: SnapshotField): string {
    if (!field.frequency) return currency
    return `${currency}/${getFrequencyShortLabel($_, field.frequency)}`
  }

  function labelFor(field: SnapshotField): string {
    const values = { name: field.label }
    if (field.kind === 'debt') return $_('page.history.dialog.debtFor', { values })
    if (field.kind === 'value') return $_('page.history.dialog.valueFor', { values })
    if (field.kind === 'amount') return $_('page.history.dialog.amountFor', { values })
    return $_('page.history.dialog.balanceFor', { values })
  }

  const SECTION_COPY: Record<SnapshotSectionId, { title: string; description: string }> = $derived({
    cash: {
      title: $_('page.history.dialog.cash'),
      description: $_('page.history.dialog.cashDescription'),
    },
    investments: {
      title: $_('page.history.dialog.investments'),
      description: $_('page.history.dialog.investmentsDescription'),
    },
    tangible_assets: {
      title: $_('page.history.dialog.tangibleAssets'),
      description: $_('page.history.dialog.tangibleAssetsDescription'),
    },
    liabilities: {
      title: $_('page.history.dialog.liabilities'),
      description: $_('page.history.dialog.liabilitiesDescription'),
    },
    incomes: {
      title: $_('page.history.dialog.incomes'),
      description: $_('page.history.dialog.incomesDescription'),
    },
    expenses: {
      title: $_('page.history.dialog.expenses'),
      description: $_('page.history.dialog.expensesDescription'),
    },
  })

  /**
   * Fields belonging to one item, so a financed asset's value and debt share a
   * card instead of appearing as two unrelated rows. Fields for the same item
   * are adjacent by construction.
   */
  function groupByItem(fields: SnapshotField[]) {
    const groups: { itemId: string; label: string; fields: SnapshotField[] }[] = []
    for (const field of fields) {
      const last = groups.at(-1)
      if (last?.itemId === field.itemId) last.fields.push(field)
      else groups.push({ itemId: field.itemId, label: field.label, fields: [field] })
    }
    return groups
  }

  function confirm(): void {
    if (dateError || !date) return
    onConfirm(snapshotFromFields(source, sections, edits, date), originalDate)
    open = false
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="gap-0 p-0 sm:max-w-[576px]">
    <Dialog.Header class="p-4">
      <Dialog.Title class="text-base font-normal">
        {mode === 'add' ? $_('page.history.dialog.addTitle') : $_('page.history.dialog.editTitle')}
      </Dialog.Title>
      <!-- Not drawn in the spec, which goes straight from the title to the
           Date section, but the dialog still needs an accessible description. -->
      <Dialog.Description class="sr-only">
        {$_('page.history.dialog.description')}
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex max-h-[70vh] flex-col gap-6 overflow-y-auto px-4 pb-4">
      <section class="flex flex-col gap-2">
        <div class="flex flex-col">
          <Label for="snapshot-date" class="text-lg font-bold">
            {$_('page.history.dialog.date')}
          </Label>
          <p class="text-sm text-muted-foreground">
            {$_('page.history.dialog.dateDescription')}
          </p>
        </div>
        <Input
          id="snapshot-date"
          type="date"
          max={today}
          bind:value={date}
          aria-invalid={dateError ? 'true' : undefined}
          aria-describedby={dateError ? 'snapshot-date-error' : undefined}
        />
        {#if dateError}
          <p id="snapshot-date-error" class="text-sm text-destructive">{dateError}</p>
        {/if}
      </section>

      {#each sections as section (section.id)}
        <section class="flex flex-col gap-2">
          <div class="flex flex-col">
            <h3 class="text-lg font-bold">{SECTION_COPY[section.id].title}</h3>
            <p class="text-sm text-muted-foreground">{SECTION_COPY[section.id].description}</p>
          </div>

          {#if section.id === 'cash'}
            {@const field = section.fields[0]}
            <SuffixedInput
              value={edits[field.key] ?? field.value}
              suffix={currency}
              aria-label={$_('page.history.dialog.cashLabel')}
              formatNumber={appStore.formatNumber}
              onValueChange={(value) => (edits[field.key] = value)}
            />
          {:else if section.fields.length === 0}
            <p class="text-sm text-muted-foreground">
              {$_('page.history.dialog.sectionEmpty')}
            </p>
          {:else}
            {#each groupByItem(section.fields) as group (group.itemId)}
              <div class="flex flex-col gap-2 rounded-lg border p-3">
                {#each group.fields as field, index (field.key)}
                  <div class="flex items-center gap-3">
                    <span class="min-w-0 flex-1 truncate text-sm font-medium">
                      {index === 0 ? group.label : $_('page.history.dialog.debtSubLabel')}
                    </span>
                    <SuffixedInput
                      class="w-40"
                      value={edits[field.key] ?? field.value}
                      suffix={suffixFor(field)}
                      aria-label={labelFor(field)}
                      formatNumber={appStore.formatNumber}
                      onValueChange={(value) => (edits[field.key] = value)}
                    />
                  </div>
                {/each}
              </div>
            {/each}
          {/if}
        </section>
      {/each}
    </div>

    <Separator />

    <Dialog.Footer class="flex-row items-center justify-between bg-muted p-4 sm:justify-between">
      <Button onclick={confirm} disabled={!date || !!dateError}>
        <Check />
        {$_('page.history.dialog.confirm')}
      </Button>
      <Button variant="ghost" onclick={reset}>
        <RotateCcw />
        {$_('page.history.dialog.resetValues')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
