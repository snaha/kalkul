<script lang="ts">
  import { _ } from 'svelte-i18n'

  import type { BarData } from '$lib/components/stacked-bar-chart.svelte'
  import { Separator } from '$lib/components/ui/separator'
  import { buildCurrentProjectionPlan } from '$lib/current-projection'
  import { getDefaultPlanDates } from '$lib/plan-defaults'
  import { sharedItems } from '$lib/plan-owned'
  import { type YearlyProjection, getYearlyPlanProjection } from '$lib/plan-projection'
  import { appStore } from '$lib/stores/app.svelte'

  import LandingCompare from './landing-compare.svelte'
  import LandingCta from './landing-cta.svelte'
  import LandingFooter from './landing-footer.svelte'
  import LandingHeaderNav from './landing-header.svelte'
  import LandingHeroChart from './landing-hero-chart.svelte'
  import LandingPrivacy from './landing-privacy.svelte'
  import { SAMPLE, SAMPLE_BIRTH_YEAR, sampleFormatters } from './landing-sample'
  import { HEADLINE_AGE, getFirstUnfundedYear, getProjectionStats } from './landing-stats'
  import LandingSteps, { type LedgerRow } from './landing-steps.svelte'

  interface Props {
    /** The home page's clock, so the sample projects from the same day. */
    today: Date
  }

  let { today }: Props = $props()

  // Section ids the header's in-page links scroll to.
  const HOW_ID = 'how'
  const PRIVACY_ID = 'privacy'
  /** Years ahead the chart's resting tooltip points at. */
  const RESTING_OFFSET = 15

  // Buttons rather than `href="#how"`: PR previews build with the hash router,
  // where a fragment href reads as a route and navigates away from the page.
  function scrollToSection(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const profile = SAMPLE.profile
  const savedPlan = SAMPLE.portfolios[0]

  // Both projections are the real engine output for the shipped sample, so the
  // marketing figures are the ones the app would show after importing it. The
  // current projection runs to the sample's 85 here rather than the app's 20
  // years: the comparison reads net worth at 65 off it.
  const currentYears = $derived(
    getYearlyPlanProjection(
      buildCurrentProjectionPlan(today, getDefaultPlanDates(profile, today).end_date),
      profile,
    ),
  )
  const planYears = $derived(getYearlyPlanProjection(savedPlan, profile))

  const toBars = (years: YearlyProjection[]): BarData[] =>
    years.map((year) => ({
      year: year.year,
      cash: year.cash,
      investments: year.investments,
      tangibleAssets: year.tangibleAssets,
      liabilities: year.liabilities,
    }))

  const currentBars = $derived(toBars(currentYears))

  // The comparison runs to the headline age only: the same horizon on both
  // cards, and few enough bars that a card-sized chart still reads as bars
  // rather than as a block. The hero keeps the full projection.
  const compareEndYear = SAMPLE_BIRTH_YEAR + HEADLINE_AGE
  const currentCompareYears = $derived(currentYears.filter((year) => year.year <= compareEndYear))

  const currentStats = $derived(getProjectionStats(currentCompareYears, SAMPLE_BIRTH_YEAR))
  const planStats = $derived(getProjectionStats(planYears, SAMPLE_BIRTH_YEAR))
  const planUnfundedYear = $derived(getFirstUnfundedYear(planYears))

  const lastProjectedYear = $derived(
    currentYears.length > 0 ? currentYears[currentYears.length - 1].year : today.getFullYear(),
  )

  // The sample's own currency and country, not the store's: no profile is
  // loaded on this page, so appStore would format Claire's euros as defaults.
  const formatters = $derived(sampleFormatters(appStore.browserLocale))

  // The first sketch is a miniature of the sample's own balance sheet: cash,
  // its first investment and its first property, straight from the file.
  const ledger = $derived.by<LedgerRow[]>(() => {
    const investment = sharedItems(profile.investments)[0]
    const asset = sharedItems(profile.tangible_assets)[0]
    return [
      {
        id: 'cash',
        label: $_('page.plan.cash'),
        value: formatters.formatCompactCurrency(profile.cash_amount ?? 0),
      },
      ...(investment
        ? [
            {
              id: investment.id,
              label: investment.name,
              value: formatters.formatCompactCurrency(investment.balance),
            },
          ]
        : []),
      ...(asset
        ? [
            {
              id: asset.id,
              label: asset.name,
              value: formatters.formatCompactCurrency(asset.value),
            },
          ]
        : []),
    ]
  })
</script>

<svelte:head>
  <title>{$_('page.landing.hero.title')} | Kalkul</title>
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
  <div class="mx-auto w-full max-w-6xl px-4 sm:px-8">
    <LandingHeaderNav howId={HOW_ID} privacyId={PRIVACY_ID} onNavigate={scrollToSection} />

    <section class="flex flex-col gap-6 pt-8 pb-8">
      <h1 class="max-w-2xl text-4xl font-bold sm:text-5xl">
        {$_('page.landing.hero.title')}
      </h1>
      <p class="max-w-2xl text-lg text-muted-foreground">
        {$_('page.landing.hero.lede')}
      </p>
      <LandingCta hint={$_('page.landing.hero.hint')} />

      <LandingHeroChart
        data={currentBars}
        birthYear={SAMPLE_BIRTH_YEAR}
        initialYear={today.getFullYear() + RESTING_OFFSET}
        formatCurrency={formatters.formatCurrency}
      />
    </section>

    <section id={HOW_ID} class="flex scroll-mt-8 flex-col gap-8 py-12">
      <div class="flex max-w-2xl flex-col gap-2">
        <h2 class="text-2xl font-bold">{$_('page.landing.how.title')}</h2>
        <p class="text-muted-foreground">{$_('page.landing.how.description')}</p>
      </div>
      <LandingSteps {ledger} lastYear={lastProjectedYear} planName={savedPlan.name} />
    </section>

    <section class="flex flex-col gap-8 py-12">
      <div class="flex max-w-2xl flex-col gap-2">
        <h2 class="text-2xl font-bold">{$_('page.landing.compare.title')}</h2>
        <p class="text-muted-foreground">{$_('page.landing.compare.description')}</p>
      </div>
      <div>
        <LandingCompare
          currentBars={toBars(currentCompareYears)}
          {currentStats}
          planBars={toBars(planYears)}
          {planStats}
          {planUnfundedYear}
          planName={savedPlan.name}
          planNotes={savedPlan.notes}
          formatCompactCurrency={formatters.formatCompactCurrency}
        />
      </div>
    </section>

    <section id={PRIVACY_ID} class="scroll-mt-8 py-12">
      <LandingPrivacy />
    </section>

    <Separator />

    <section class="flex flex-col items-start gap-4 py-12">
      <h2 class="max-w-2xl text-2xl font-bold">{$_('page.landing.final.title')}</h2>
      <p class="max-w-2xl text-muted-foreground">
        {$_('page.landing.final.description')}
      </p>
      <LandingCta />
    </section>

    <LandingFooter
      year={today.getFullYear()}
      howId={HOW_ID}
      privacyId={PRIVACY_ID}
      onNavigate={scrollToSection}
    />
  </div>
</div>
