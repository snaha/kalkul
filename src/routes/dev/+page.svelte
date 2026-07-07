<!-- localization-exclude -->
<script lang="ts">
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import { CATEGORY_COLORS } from '$lib/chart-colors'
  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'
  import storageKeys from '$lib/storage-keys'
  import { appStore } from '$lib/stores/app.svelte'

  const colorCategories = [
    { name: 'Cash', colors: [CATEGORY_COLORS.cash] },
    { name: 'Investments', colors: CATEGORY_COLORS.investments },
    { name: 'Tangible assets', colors: CATEGORY_COLORS.tangibleAssets },
    { name: 'Liabilities', colors: CATEGORY_COLORS.liabilities },
  ]

  const presets = [
    {
      name: 'Empty (fresh start)',
      description: 'Clears all data. Shows the hero landing page.',
      data: { profile: { name: '', email: '' }, portfolios: [] },
    },
    {
      name: 'No finances',
      description: 'Name set, no financial data. Shows dashboard with empty finances panel.',
      data: {
        profile: { name: 'Jane Doe', email: '', currency: 'EUR' },
        portfolios: [],
      },
    },
    {
      name: 'Cash only',
      description: 'Basic profile with cash. Shows single-segment donut chart.',
      data: {
        profile: {
          name: 'Jane Doe',
          email: '',
          currency: 'EUR',
          cash_amount: 50000,
        },
        portfolios: [],
      },
    },
    {
      name: 'Full portfolio',
      description: 'Balanced profile with all asset types, incomes, and expenses.',
      data: {
        profile: {
          name: 'Jane Doe',
          email: '',
          birth_date: '1990-06-15',
          location: 'czechRepublic',
          currency: 'EUR',
          cash_amount: 50000,
          has_investments: true,
          investments: [
            { id: 'inv-1', name: 'ETF Portfolio', balance: 80000, apy: 7 },
            { id: 'inv-2', name: 'Bonds', balance: 20000, apy: 3.5 },
          ],
          has_tangible_assets: true,
          tangible_assets: [
            {
              id: 'ta-1',
              name: 'Apartment',
              value: 250000,
              status: 'financed',
              outstanding_balance: 180000,
              installment_frequency: 'monthly',
              annual_rate: 3.2,
              installment_amount: 875,
              remaining_term: 25,
            },
            { id: 'ta-2', name: 'Car', value: 15000, status: 'fully_owned' },
          ],
          has_liabilities: true,
          liabilities: [
            {
              id: 'li-1',
              name: 'Student loan',
              outstanding_balance: 12000,
              installment_frequency: 'monthly',
              annual_rate: 4.5,
              installment_amount: 250,
              remaining_term: 5,
            },
          ],
          incomes: [
            {
              id: 'inc-1',
              name: 'Salary',
              amount: 4200,
              frequency: 'monthly',
              withhold_taxes: true,
              tax_percentage: 23,
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
            {
              id: 'inc-2',
              name: 'Freelance',
              amount: 800,
              frequency: 'monthly',
              withhold_taxes: false,
              start: 'immediately',
              end: 'never',
              change_over_time: 'none',
            },
          ],
          expenses: [
            {
              id: 'exp-1',
              name: 'Living costs',
              amount: 1500,
              frequency: 'monthly',
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
            {
              id: 'exp-2',
              name: 'Insurance',
              amount: 200,
              frequency: 'monthly',
              start: 'immediately',
              end: 'never',
              change_over_time: 'none',
            },
          ],
        },
        portfolios: [],
      },
    },
    {
      name: 'Heavy investor',
      description: 'Multiple diversified investment accounts, moderate cash, no real estate.',
      data: {
        profile: {
          name: 'Martin Chen',
          email: '',
          birth_date: '1985-03-22',
          location: 'other',
          currency: 'EUR',
          cash_amount: 25000,
          has_investments: true,
          investments: [
            { id: 'inv-1', name: 'S&P 500 ETF', balance: 120000, apy: 8 },
            { id: 'inv-2', name: 'European stocks', balance: 45000, apy: 6 },
            { id: 'inv-3', name: 'Government bonds', balance: 60000, apy: 3 },
            { id: 'inv-4', name: 'Corporate bonds', balance: 30000, apy: 4.5 },
            { id: 'inv-5', name: 'Crypto fund', balance: 15000, apy: 12 },
          ],
          has_tangible_assets: false,
          has_liabilities: false,
          incomes: [
            {
              id: 'inc-1',
              name: 'Salary',
              amount: 6500,
              frequency: 'monthly',
              withhold_taxes: true,
              tax_percentage: 30,
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
            {
              id: 'inc-2',
              name: 'Dividends',
              amount: 3600,
              frequency: 'yearly',
              withhold_taxes: true,
              tax_percentage: 15,
              start: 'immediately',
              end: 'never',
              change_over_time: 'none',
            },
          ],
          expenses: [
            {
              id: 'exp-1',
              name: 'Rent',
              amount: 1800,
              frequency: 'monthly',
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
            {
              id: 'exp-2',
              name: 'Living expenses',
              amount: 1200,
              frequency: 'monthly',
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
          ],
        },
        portfolios: [],
      },
    },
    {
      name: 'Real estate portfolio',
      description: 'Multiple properties, mix of owned and financed, rental income.',
      data: {
        profile: {
          name: 'Eva Novak',
          email: '',
          birth_date: '1978-11-03',
          location: 'czechRepublic',
          currency: 'EUR',
          cash_amount: 35000,
          has_investments: true,
          investments: [{ id: 'inv-1', name: 'Savings account', balance: 40000, apy: 2 }],
          has_tangible_assets: true,
          tangible_assets: [
            {
              id: 'ta-1',
              name: 'Primary residence',
              value: 320000,
              status: 'financed',
              outstanding_balance: 120000,
              installment_frequency: 'monthly',
              annual_rate: 2.8,
              installment_amount: 950,
              remaining_term: 12,
            },
            {
              id: 'ta-2',
              name: 'Rental apartment #1',
              value: 180000,
              status: 'financed',
              outstanding_balance: 140000,
              installment_frequency: 'monthly',
              annual_rate: 3.5,
              installment_amount: 720,
              remaining_term: 22,
            },
            {
              id: 'ta-3',
              name: 'Rental apartment #2',
              value: 195000,
              status: 'financed',
              outstanding_balance: 160000,
              installment_frequency: 'monthly',
              annual_rate: 3.8,
              installment_amount: 780,
              remaining_term: 25,
            },
            {
              id: 'ta-4',
              name: 'Vacation cottage',
              value: 85000,
              status: 'fully_owned',
            },
            { id: 'ta-5', name: 'Car', value: 22000, status: 'fully_owned' },
          ],
          has_liabilities: false,
          incomes: [
            {
              id: 'inc-1',
              name: 'Salary',
              amount: 3800,
              frequency: 'monthly',
              withhold_taxes: true,
              tax_percentage: 23,
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
            {
              id: 'inc-2',
              name: 'Rental income #1',
              amount: 950,
              frequency: 'monthly',
              withhold_taxes: true,
              tax_percentage: 15,
              start: 'immediately',
              end: 'never',
              change_over_time: 'none',
            },
            {
              id: 'inc-3',
              name: 'Rental income #2',
              amount: 1050,
              frequency: 'monthly',
              withhold_taxes: true,
              tax_percentage: 15,
              start: 'immediately',
              end: 'never',
              change_over_time: 'none',
            },
          ],
          expenses: [
            {
              id: 'exp-1',
              name: 'Living costs',
              amount: 1400,
              frequency: 'monthly',
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
            {
              id: 'exp-2',
              name: 'Property maintenance',
              amount: 4800,
              frequency: 'yearly',
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
            {
              id: 'exp-3',
              name: 'Property insurance',
              amount: 2400,
              frequency: 'yearly',
              start: 'immediately',
              end: 'never',
              change_over_time: 'none',
            },
          ],
        },
        portfolios: [],
      },
    },
    {
      name: 'Young professional',
      description: 'Early career, student debt, starting to invest. High liabilities ratio.',
      data: {
        profile: {
          name: 'Alex Rivera',
          email: '',
          birth_date: '1998-08-20',
          location: 'france',
          currency: 'EUR',
          cash_amount: 8000,
          has_investments: true,
          investments: [{ id: 'inv-1', name: 'Robo-advisor', balance: 5000, apy: 6 }],
          has_tangible_assets: true,
          tangible_assets: [
            {
              id: 'ta-1',
              name: 'Car',
              value: 12000,
              status: 'financed',
              outstanding_balance: 8000,
              installment_frequency: 'monthly',
              annual_rate: 5.9,
              installment_amount: 280,
              remaining_term: 3,
            },
          ],
          has_liabilities: true,
          liabilities: [
            {
              id: 'li-1',
              name: 'Student loan',
              outstanding_balance: 28000,
              installment_frequency: 'monthly',
              annual_rate: 3.5,
              installment_amount: 350,
              remaining_term: 8,
            },
            {
              id: 'li-2',
              name: 'Personal loan',
              outstanding_balance: 5000,
              installment_frequency: 'monthly',
              annual_rate: 7.9,
              installment_amount: 200,
              remaining_term: 2,
            },
          ],
          incomes: [
            {
              id: 'inc-1',
              name: 'Salary',
              amount: 2800,
              frequency: 'monthly',
              withhold_taxes: true,
              tax_percentage: 20,
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
          ],
          expenses: [
            {
              id: 'exp-1',
              name: 'Rent',
              amount: 850,
              frequency: 'monthly',
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
            {
              id: 'exp-2',
              name: 'Living expenses',
              amount: 600,
              frequency: 'monthly',
              start: 'immediately',
              end: 'never',
              change_over_time: 'match_inflation',
            },
          ],
        },
        portfolios: [],
      },
    },
  ]

  function loadPreset(preset: (typeof presets)[number]) {
    if (preset.data.profile.name === '') {
      appStore.reset()
      localStorage.removeItem(storageKeys.DATA)
      appStore.loading = false
    } else {
      appStore.importBackup(JSON.stringify(preset.data))
    }
    goto(resolve(routes.HOME))
  }

  const profileJson = $derived(JSON.stringify(appStore.profile.toJSON(), undefined, 2))
</script>

<div class="mx-auto flex max-w-2xl flex-col gap-8 p-8">
  <h1 class="text-3xl font-bold">Dev Tools</h1>

  <div class="flex flex-col gap-4">
    <h2 class="text-xl font-bold">Load preset</h2>
    {#each presets as preset (preset.name)}
      <div class="flex items-center gap-4 rounded-lg border p-4">
        <div class="flex flex-1 flex-col gap-1">
          <span class="font-medium">{preset.name}</span>
          <span class="text-sm text-muted-foreground">{preset.description}</span>
        </div>
        <Button size="sm" onclick={() => loadPreset(preset)}>Load</Button>
      </div>
    {/each}
  </div>

  <div class="flex flex-col gap-4">
    <h2 class="text-xl font-bold">Chart colors</h2>
    <div class="flex flex-col gap-3">
      {#each colorCategories as category (category.name)}
        <div class="flex items-center gap-3">
          <span class="w-32 text-sm font-medium">{category.name}</span>
          <div class="flex gap-2">
            {#each category.colors as color, i (i)}
              <div class="flex flex-col items-center gap-1">
                <div class="size-10 rounded-md" style="background-color: {color}"></div>
                <span class="text-[10px] text-muted-foreground">{color}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="flex flex-col gap-4">
    <h2 class="text-xl font-bold">Current profile</h2>
    <pre class="max-h-96 overflow-auto rounded-lg bg-muted p-4 text-xs">{profileJson}</pre>
  </div>
</div>
