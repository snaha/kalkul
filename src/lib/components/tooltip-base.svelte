<script lang="ts" module>
  import type { TooltipData } from '$lib/types'
  import type { Snippet } from 'svelte'
  import Typography from './ui/typography.svelte'
  export type TooltipGraphProps = {
    tooltipData: TooltipData[]
    tooltipPosition: { x: number; y: number }
    children?: Snippet
    birthDate?: Date
    year: number
    adjustWithInflation: boolean
    disabled?: boolean
  }
</script>

<script lang="ts">
  import { formatAge } from '$lib/utils'
  import { _ } from 'svelte-i18n'
  import Badge from './ui/badge.svelte'
  import { UserAvatarFilledAlt } from 'carbon-icons-svelte'
  import Horizontal from './ui/horizontal.svelte'
  import InflationBadge from './inflation-badge.svelte'

  const {
    tooltipData,
    tooltipPosition,
    children,
    birthDate,
    year,
    adjustWithInflation,
    disabled = false,
  }: TooltipGraphProps = $props()

  function getAge(year: number, birthDate?: Date): string | undefined {
    if (!birthDate) {
      return
    }

    // Calculate age for that year
    const targetDate = new Date(year, 0, 1) // January 1st of the year
    const age = formatAge(birthDate, targetDate)

    return `${$_('common.age')}: ${age}`
  }
</script>

{#if !disabled}
  <div
    class="tooltip"
    class:visible={tooltipData.length > 0 && !disabled}
    style={`transform: translate(calc(${tooltipPosition.x}px - 100%),calc(${tooltipPosition.y}px - 50%)`}
  >
    {#if tooltipData.length > 0}
      <div class="tooltip-header">
        <Horizontal --horizontal-gap="var(--half-padding)">
          <Typography variant="h5" class="color-light">{year}</Typography>
          {#if adjustWithInflation}
            <InflationBadge>{$_('common.inflationAdjusted')}</InflationBadge>
          {/if}
        </Horizontal>

        {#if getAge(year, birthDate)}
          <Badge dimension="small" class="age-badge">
            <UserAvatarFilledAlt size={16} />
            <Typography variant="small" --typography-color="var(--colors-dark-ultra-high)">
              {getAge(year, birthDate)}</Typography
            >
          </Badge>
        {/if}
      </div>
      {#if children}
        {@render children()}
      {/if}
    {/if}
  </div>
{/if}

<style>
  :global(.color-light) {
    color: var(--colors-base) !important;
  }
  .tooltip {
    pointer-events: none;
    position: absolute;
    width: 321px;
    display: flex;
    flex-direction: column;
    gap: var(--padding);
    padding: var(--padding);
    border-radius: var(--padding);
    border: 1px solid var(--colors-base);
    background: var(--colors-top);
    z-index: 10;
    transition:
      max-height 0.2s ease-out,
      opacity 0.2s ease-out;
    overflow: hidden;
    opacity: 0;
    visibility: hidden;
    max-height: 0;
  }

  .tooltip.visible {
    opacity: 1;
    visibility: visible;
    max-height: 500px;
  }
  .tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--half-padding);
  }
  :global(.age-badge) {
    background-color: var(--colors-dark-low) !important;
    color: var(--colors-dark-ultra-high) !important;
  }
</style>
