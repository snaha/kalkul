<script lang="ts">
  type Segment = {
    label: string
    value: number
    color: string
  }

  type Props = {
    segments: Segment[]
    centerLabel: string
    centerSublabel?: string
    size?: number
  }

  let { segments, centerLabel, centerSublabel, size = 256 }: Props = $props()

  const RADIUS = 80
  const STROKE_WIDTH = 32
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const VIEW_SIZE = 200

  const total = $derived(segments.reduce((sum, s) => sum + s.value, 0))

  const arcs = $derived.by(() => {
    let offset = 0
    return segments
      .filter((s) => s.value > 0)
      .map((segment) => {
        const ratio = total > 0 ? segment.value / total : 0
        const dashLength = ratio * CIRCUMFERENCE
        const arc = {
          color: segment.color,
          dasharray: `${dashLength} ${CIRCUMFERENCE - dashLength}`,
          dashoffset: -offset,
        }
        offset += dashLength
        return arc
      })
  })
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {VIEW_SIZE} {VIEW_SIZE}"
  class="overflow-visible"
  role="img"
>
  <!-- Background circle -->
  <circle
    cx={VIEW_SIZE / 2}
    cy={VIEW_SIZE / 2}
    r={RADIUS}
    fill="none"
    stroke="var(--muted)"
    stroke-width={STROKE_WIDTH}
  />

  <!-- Segments -->
  {#each arcs as arc, i (i)}
    <circle
      cx={VIEW_SIZE / 2}
      cy={VIEW_SIZE / 2}
      r={RADIUS}
      fill="none"
      stroke={arc.color}
      stroke-width={STROKE_WIDTH}
      stroke-dasharray={arc.dasharray}
      stroke-dashoffset={arc.dashoffset}
      stroke-linecap="butt"
      transform="rotate(-90 {VIEW_SIZE / 2} {VIEW_SIZE / 2})"
    />
  {/each}

  <!-- Center text -->
  <text
    x={VIEW_SIZE / 2}
    y={VIEW_SIZE / 2 - 4}
    text-anchor="middle"
    dominant-baseline="middle"
    class="fill-foreground text-[30px] font-bold"
  >
    {centerLabel}
  </text>
  {#if centerSublabel}
    <text
      x={VIEW_SIZE / 2}
      y={VIEW_SIZE / 2 + 20}
      text-anchor="middle"
      dominant-baseline="middle"
      class="fill-muted-foreground text-xs"
    >
      {centerSublabel}
    </text>
  {/if}
</svg>
