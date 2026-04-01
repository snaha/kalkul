<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { appStore } from '$lib/stores/app.svelte'
  import routes from '$lib/routes'
  import { _ } from 'svelte-i18n'
  import { AddLarge, Close, DocumentExport, TrashCan } from 'carbon-icons-svelte'
  import Button from '$lib/components/ui/button.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import Vertical from '$lib/components/ui/vertical.svelte'
  import Horizontal from '$lib/components/ui/horizontal.svelte'
  import Loader from '$lib/components/ui/loader.svelte'
  import Fullscreen from '$lib/components/fullscreen.svelte'
  import Checkbox from '$lib/components/ui/checkbox.svelte'
  import Divider from '$lib/components/ui/divider.svelte'
  import LocalizedDateInput from '$lib/components/localized-date-input.svelte'
  import { addYears } from 'date-fns'

  const portfolioId = $derived(page.params.portfolio_id)
  const portfolio = $derived(appStore.portfolios.find((p) => p.id === portfolioId))

  let isLoading = $derived(appStore.loading)

  let includeBreakdown = $state(false)
  let breakdownKeyDates: Date[] = $state([])
  const now = new Date()
  const defaultBreakdownKeyDates = [
    addYears(now, 0),
    addYears(now, 10),
    addYears(now, 20),
    addYears(now, 30),
    addYears(now, 40),
    addYears(now, 50),
  ]

  function exportPdf() {
    const params = new URLSearchParams()

    if (includeBreakdown && breakdownKeyDates.length > 0) {
      params.set('keyDates', breakdownKeyDates.map((d) => d.toISOString().split('T')[0]).join(','))
    }

    const url = routes.PDF_EXPORT(portfolioId) + (params.toString() ? `?${params.toString()}` : '')
    window.open(url, '_blank')
  }

  function cancel() {
    goto(routes.PORTFOLIO(portfolioId))
  }

  function addKeyDate() {
    const nextIndex = breakdownKeyDates.length
    breakdownKeyDates = [
      ...breakdownKeyDates,
      nextIndex < defaultBreakdownKeyDates.length
        ? defaultBreakdownKeyDates[nextIndex]
        : new Date(),
    ]
  }

  function removeKeyDate(i: number) {
    breakdownKeyDates = [...breakdownKeyDates.slice(0, i), ...breakdownKeyDates.slice(i + 1)]
  }
</script>

<svelte:head>
  <title>{portfolio?.name} - {$_('component.PDFExport.exportTitle')}</title>
</svelte:head>

{#if isLoading}
  <Fullscreen>
    <Loader />
  </Fullscreen>
{:else if !portfolio}
  <Fullscreen>
    404 - {$_('common.notFound')}
  </Fullscreen>
{:else}
  <Fullscreen>
    <Vertical class="max-width-560" --vertical-gap="var(--double-padding)">
      <Horizontal --gap="var(--padding)">
        <Typography variant="h4">{$_('component.PDFExport.exportTitle')}</Typography>
        <div style="flex: 1;"></div>
        <Typography>{portfolio.name}</Typography>
      </Horizontal>

      <Typography>{$_('component.PDFExport.exportDescription')}</Typography>

      <Vertical --vertical-gap="0">
        <Checkbox dimension="compact" bind:checked={includeBreakdown}>
          <span class="checkbox-label-green">{$_('component.PDFExport.includeBreakdown')}</span>
        </Checkbox>
        <Typography variant="small">{$_('component.PDFExport.breakdownExplanation')}</Typography>
      </Vertical>

      {#if includeBreakdown}
        <Horizontal --horizontal-align-items="stretch">
          <Divider
            orientation="vertical"
            style="height: unset; margin: 0; margin-left: var(--padding)"
          />
          <Vertical
            class="max-width-560"
            --vertical-gap="var(--half-padding)"
            --vertical-align-items="start"
          >
            <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
            {#each breakdownKeyDates as _, i}
              <Horizontal
                class="box"
                --horizontal-justify-content="space-between"
                --horizontal-align-items="end"
              >
                <LocalizedDateInput variant="solid" bind:value={breakdownKeyDates[i]} />
                <Button variant="ghost" dimension="compact" onclick={() => removeKeyDate(i)}
                  ><TrashCan size={24} /></Button
                >
              </Horizontal>
            {/each}

            <Button variant="ghost" dimension="compact" onclick={addKeyDate}
              ><AddLarge size={24} />{$_('component.PDFExport.addKeyDate')}</Button
            >
          </Vertical>
        </Horizontal>
      {/if}

      <Horizontal --gap="var(--half-padding)">
        <Button variant="strong" dimension="compact" onclick={exportPdf}>
          <DocumentExport size={24} />
          {$_('component.PDFExport.exportButton')}
        </Button>
        <Button variant="secondary" dimension="compact" onclick={cancel}>
          <Close size={24} />{$_('common.cancel')}
        </Button>
      </Horizontal>
    </Vertical>
  </Fullscreen>
{/if}

<style>
  :global(.max-width-560) {
    max-width: 560px;
    width: 100%;
  }

  .checkbox-label-green {
    color: var(--colors-high);
  }

  :global(.box) {
    border-radius: var(--padding);
    padding: var(--padding) !important;
    background-color: var(--colors-low);
    width: 100%;
  }
</style>
