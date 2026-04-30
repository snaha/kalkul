<script lang="ts">
  import { _ } from 'svelte-i18n'

  import type { Frequency } from '$lib/schemas'

  import ReadOnlyItemCard from './read-only-item-card.svelte'

  interface Props {
    name: string
    amount: number
    frequency: Frequency
    sentiment: 'positive' | 'negative'
    formatCurrency: (value: number) => string
  }

  let { name, amount, frequency, sentiment, formatCurrency }: Props = $props()

  const sign = $derived(sentiment === 'positive' ? '+' : '-')
  const valueClass = $derived(sentiment === 'positive' ? 'text-success' : 'text-destructive')
  const suffix = $derived(
    frequency === 'monthly'
      ? $_('page.financialData.frequency.short.monthly')
      : frequency === 'yearly'
        ? $_('page.financialData.frequency.short.yearly')
        : $_('page.financialData.frequency.short.weekly'),
  )
  const value = $derived(amount > 0 ? `${sign}${formatCurrency(amount)} / ${suffix}` : '')
</script>

<ReadOnlyItemCard {name} {value} {valueClass} />
