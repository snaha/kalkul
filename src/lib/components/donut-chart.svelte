<script lang="ts">
  type Segment = {
    label: string
    value: number
    color: string
  }

  type Props = {
    segments: Segment[]
    centerLabel?: string
    centerSublabel?: string
    size?: number
    variant?: 'donut' | 'pie'
  }

  let { segments, centerLabel, centerSublabel, size = 256, variant = 'donut' }: Props = $props()

  const RADIUS = 80
  const STROKE_WIDTH = 32
  const PIE_RADIUS = RADIUS + STROKE_WIDTH / 2
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const VIEW_SIZE = 200
  const CENTER = VIEW_SIZE / 2

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

  const wedges = $derived.by(() => {
    const visible = segments.filter((s) => s.value > 0)
    if (total === 0 || visible.length === 0) return []
    let startAngle = -Math.PI / 2 // start at 12 o'clock
    return visible.map((segment) => {
      const ratio = segment.value / total
      const endAngle = startAngle + ratio * 2 * Math.PI
      const path = describeWedge(CENTER, CENTER, PIE_RADIUS, startAngle, endAngle)
      const fullCircle = ratio === 1
      const wedge = { color: segment.color, path, fullCircle }
      startAngle = endAngle
      return wedge
    })
  })

  function describeWedge(
    cx: number,
    cy: number,
    r: number,
    startAngle: number,
    endAngle: number,
  ): string {
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 {VIEW_SIZE} {VIEW_SIZE}"
  class="overflow-visible"
  role="img"
>
  {#if variant === 'donut'}
    <!-- Background ring -->
    <circle
      cx={CENTER}
      cy={CENTER}
      r={RADIUS}
      fill="none"
      stroke="var(--muted)"
      stroke-width={STROKE_WIDTH}
    />

    <!-- Donut segments -->
    {#each arcs as arc, i (i)}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        stroke={arc.color}
        stroke-width={STROKE_WIDTH}
        stroke-dasharray={arc.dasharray}
        stroke-dashoffset={arc.dashoffset}
        stroke-linecap="butt"
        transform="rotate(-90 {CENTER} {CENTER})"
      />
    {/each}
  {:else}
    <!-- Pie background (when empty) -->
    {#if wedges.length === 0}
      <circle cx={CENTER} cy={CENTER} r={PIE_RADIUS} fill="var(--muted)" />
    {/if}

    <!-- Pie wedges -->
    {#each wedges as wedge, i (i)}
      {#if wedge.fullCircle}
        <circle cx={CENTER} cy={CENTER} r={PIE_RADIUS} fill={wedge.color} />
      {:else}
        <path d={wedge.path} fill={wedge.color} />
      {/if}
    {/each}
  {/if}

  <!-- Center text -->
  {#if centerLabel}
    <text
      x={CENTER}
      y={CENTER - 4}
      text-anchor="middle"
      dominant-baseline="middle"
      class="fill-foreground text-[30px] font-bold"
    >
      {centerLabel}
    </text>
  {/if}
  {#if centerSublabel}
    <text
      x={CENTER}
      y={CENTER + 20}
      text-anchor="middle"
      dominant-baseline="middle"
      class="fill-muted-foreground text-xs"
    >
      {centerSublabel}
    </text>
  {/if}
</svg>
