<script lang="ts">
  import { _ } from 'svelte-i18n'

  import RotateCcw from '@lucide/svelte/icons/rotate-ccw'

  import SuffixedInput from '$lib/components/suffixed-input.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Separator } from '$lib/components/ui/separator'
  import { getFrequencyShortLabel } from '$lib/select-options'
  import { type SnapshotField, buildSnapshotSections, snapshotWithEdits } from '$lib/snapshot-form'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    open: boolean
    /** Date of the snapshot to edit (date-only ISO string). */
    date: string
  }

  let { open = $bindable(), date }: Props = $props()

  const snapshot = $derived((appStore.profile.snapshots ?? []).find((s) => s.date === date))
  const sections = $derived(
    snapshot ? buildSnapshotSections(appStore.profile.toJSON(), snapshot, date) : [],
  )
  const fields = $derived(sections.flatMap((section) => section.fields))

  // Only what the user typed, keyed by field key. Clearing a field stores
  // `undefined`, which is no edit: the snapshot keeps its figure.
  let edits = $state<Record<string, number | undefined>>({})

  // Re-seed whenever the dialog is opened so a cancelled edit never lingers.
  $effect(() => {
    if (open) edits = {}
  })

  const currency = $derived(appStore.profile.currencyOrDefault)

  function labelFor(field: SnapshotField): string {
    if (field.kind === 'cash') return $_('page.history.dialog.cash')
    if (field.key.endsWith(':debt'))
      return $_('page.history.dialog.debtFor', { values: { name: field.label } })
    return field.label
  }

  function suffixFor(field: SnapshotField): string {
    if (!field.frequency) return currency
    return `${currency}/${getFrequencyShortLabel($_, field.frequency)}`
  }

  function confirm(): void {
    if (snapshot && Object.values(edits).some((value) => value !== undefined)) {
      appStore.saveSnapshot(snapshotWithEdits(snapshot, sections, edits), date)
    }
    open = false
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="gap-0 p-0 sm:max-w-[576px]">
    <Dialog.Header class="p-4">
      <Dialog.Title>{$_('page.history.edit.title')}</Dialog.Title>
      <Dialog.Description class="text-base text-foreground">
        {$_('page.history.edit.description', {
          values: { date: appStore.formatDateOnly(date) },
        })}
      </Dialog.Description>
    </Dialog.Header>

    <div class="max-h-[60vh] overflow-y-auto px-4 pb-4">
      <Separator class="mb-2" />
      <table class="w-full">
        <tbody>
          {#each fields as field (field.key)}
            <tr>
              <th scope="row" class="py-1 pr-2 text-left text-sm font-medium">
                {labelFor(field)}
              </th>
              <td class="w-56 py-1">
                <SuffixedInput
                  value={edits[field.key] ?? field.value}
                  suffix={suffixFor(field)}
                  aria-label={labelFor(field)}
                  formatNumber={appStore.formatNumber}
                  onValueChange={(value) => (edits[field.key] = value)}
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <Separator />

    <Dialog.Footer class="flex-row items-center justify-between bg-muted p-4 sm:justify-between">
      <Button variant="ghost" onclick={() => (edits = {})}>
        <RotateCcw />
        {$_('page.history.dialog.resetValues')}
      </Button>
      <Button onclick={confirm}>{$_('page.history.dialog.confirm')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
