<script lang="ts" module>
  export interface LedgerRow {
    id: string
    label: string
    value: string
  }
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n'

  import * as Card from '$lib/components/ui/card'

  interface Props {
    /** A few of the sample's own balances, for the first sketch. */
    ledger: LedgerRow[]
    /** Last year of the sample's projection, labelled on the second sketch. */
    lastYear: number
    /** The sample plan's name, captioning the third sketch. */
    planName: string
  }

  let { ledger, lastYear, planName }: Props = $props()
</script>

<div class="grid gap-8 md:grid-cols-3">
  <article class="flex flex-col gap-3">
    <!-- The sketches are decorative, but the numbers in them are the sample's
         real balances rather than invented ones. -->
    <Card.Root class="gap-0 overflow-hidden py-0 shadow-xs">
      <Card.Content class="h-28 bg-muted p-0 text-muted-foreground">
        <svg viewBox="0 0 320 120" class="size-full" aria-hidden="true">
          {#each ledger as row, index (row.id)}
            <text x="20" y={34 + index * 28} font-size="11" class="fill-current">{row.label}</text>
            <text
              x="300"
              y={34 + index * 28}
              font-size="11"
              text-anchor="end"
              class="fill-foreground tabular-nums"
            >
              {row.value}
            </text>
            {#if index < ledger.length - 1}
              <line
                x1="20"
                y1={44 + index * 28}
                x2="300"
                y2={44 + index * 28}
                stroke="currentColor"
                class="opacity-40"
              />
            {/if}
          {/each}
          <rect x="20" y="100" width="280" height="2" class="fill-primary" />
        </svg>
      </Card.Content>
    </Card.Root>
    <h3 class="text-lg font-bold">{$_('page.landing.how.recordTitle')}</h3>
    <p class="text-sm text-muted-foreground">{$_('page.landing.how.recordDescription')}</p>
  </article>

  <article class="flex flex-col gap-3">
    <Card.Root class="gap-0 overflow-hidden py-0 shadow-xs">
      <Card.Content class="h-28 bg-muted p-0 text-foreground">
        <svg viewBox="0 0 320 120" class="size-full" aria-hidden="true">
          <path
            d="M20 96 C 90 92, 140 80, 190 58 S 270 20, 300 14 L 300 100 L 20 100 Z"
            fill="currentColor"
            class="opacity-10"
          />
          <path
            d="M20 96 C 90 92, 140 80, 190 58 S 270 20, 300 14"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          />
          <circle cx="300" cy="14" r="5" fill="currentColor" />
          <text x="292" y="40" font-size="11" text-anchor="end" class="fill-current tabular-nums">
            {lastYear}
          </text>
        </svg>
      </Card.Content>
    </Card.Root>
    <h3 class="text-lg font-bold">{$_('page.landing.how.projectTitle')}</h3>
    <p class="text-sm text-muted-foreground">{$_('page.landing.how.projectDescription')}</p>
  </article>

  <article class="flex flex-col gap-3">
    <Card.Root class="gap-0 overflow-hidden py-0 shadow-xs">
      <Card.Content class="h-28 bg-muted p-0 text-foreground">
        <svg viewBox="0 0 320 120" class="size-full" aria-hidden="true">
          <path
            d="M20 96 C 100 90, 180 60, 300 30"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-dasharray="4 4"
            class="text-muted-foreground"
          />
          <path
            d="M20 96 C 90 92, 150 78, 200 66 S 270 22, 300 16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
          />
          <circle cx="150" cy="79" r="5" fill="currentColor" />
          <text x="150" y="104" font-size="11" text-anchor="middle" class="fill-current">
            {planName}
          </text>
        </svg>
      </Card.Content>
    </Card.Root>
    <h3 class="text-lg font-bold">{$_('page.landing.how.compareTitle')}</h3>
    <p class="text-sm text-muted-foreground">{$_('page.landing.how.compareDescription')}</p>
  </article>
</div>
