<script lang="ts">
  import type { Frequency } from '$lib/schemas'

  import ReadOnlyItemCard from './read-only-item-card.svelte'

  interface Props {
    name: string
    amount: number
    frequency: Frequency
    sentiment: 'positive' | 'negative'
    formatCurrency: (value: number) => string
    frequencyShort: { monthly: string; yearly: string; weekly: string }
  }

  let { name, amount, frequency, sentiment, formatCurrency, frequencyShort }: Props = $props()

  const sign = $derived(sentiment === 'positive' ? '+' : '-')
  const valueClass = $derived(sentiment === 'positive' ? 'text-success' : 'text-destructive')
  const suffix = $derived(frequencyShort[frequency])
  const value = $derived(amount > 0 ? `${sign}${formatCurrency(amount)} / ${suffix}` : '')
</script>

<ReadOnlyItemCard {name} {value} {valueClass} />
