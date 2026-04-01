<script lang="ts">
  import DatePicker from '$lib/components/ui/input/date/picker.svelte'
  import Input from '$lib/components/ui/input/input.svelte'
  import { formatAge } from '$lib/utils'
  import { addYears } from 'date-fns'
  import { _ } from 'svelte-i18n'

  type Dimension = 'default' | 'large' | 'compact' | 'small'

  type Props = {
    dimension?: Dimension
    dateInputLabel: string
    ageLabel: string
    agePlaceholder: string
    date: Date
    birthDate?: Date
    onchange?: () => void
    ageDisabled?: boolean
  }

  let {
    dimension = 'default',
    dateInputLabel,
    ageLabel,
    agePlaceholder,
    date = $bindable(),
    birthDate,
    onchange,
    ageDisabled = false,
  }: Props = $props()

  let age = $state(birthDate ? formatAge(birthDate, date) : '')

  function onAgeInput() {
    if (!age || !birthDate) {
      return
    }
    let ageNumber = parseInt(age, 10)
    if (Number.isNaN(ageNumber)) {
      // TODO display error
      return
    }
    if (ageNumber < 0) {
      ageNumber = Math.abs(ageNumber)
    }

    date = addYears(birthDate, ageNumber)
  }

  function checkAgeInput() {
    if (!birthDate) return
    if (!age) {
      age = formatAge(birthDate, new Date(date))
      return
    }
    let ageNumber = parseInt(age, 10)
    if (Number.isNaN(ageNumber)) {
      age = formatAge(birthDate, new Date(date))
      return
    }
    if (ageNumber < 0) {
      age = Math.abs(ageNumber).toString()
      return
    }
  }

  $effect(() => {
    if (date && birthDate) {
      const ageValue = formatAge(birthDate, new Date(date))
      let ageNumber = parseInt(ageValue, 10)
      if (ageNumber < 0) {
        age = Math.abs(ageNumber).toString()
        return
      }
    }
  })
</script>

<section class="horizontal">
  <DatePicker
    {dimension}
    label={dateInputLabel}
    bind:value={date}
    style="max-width: 100%"
    {onchange}
  ></DatePicker>
  <Input
    type="number"
    variant="solid"
    {dimension}
    placeholder={agePlaceholder}
    label={ageLabel}
    unit={$_('common.years')}
    bind:value={age}
    class="date-age-grower"
    style="max-width: 100%"
    oninput={onAgeInput}
    step={1}
    min={0}
    onblur={checkAgeInput}
    {onchange}
    disabled={ageDisabled}
  ></Input>
</section>

<style>
  .horizontal {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: end;
    gap: var(--half-padding);
  }
  .horizontal :global(.date-age-grower) {
    flex: 1;
    max-width: calc(50% - var(--quarter-padding));
  }
</style>
