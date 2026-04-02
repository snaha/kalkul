<script lang="ts">
  import { ArrowRight, ChevronsUpDown, EllipsisVertical, Plus, SquarePen } from '@lucide/svelte'
  import { goto } from '$app/navigation'
  import { _ } from 'svelte-i18n'
  import { Button } from '$lib/components/ui/button'
  import { Card, CardContent } from '$lib/components/ui/card'
  import { Checkbox } from '$lib/components/ui/checkbox'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { Separator } from '$lib/components/ui/separator'
  import { Switch } from '$lib/components/ui/switch'
  import routes from '$lib/routes'

  interface Income {
    id: string
    name: string
    amount: string
    frequency: string
    showAdvanced: boolean
    withholdTaxes: boolean
    taxPercentage: string
    start: string
    end: string
    changeOverTime: string
    editing: boolean
    editingName: boolean
  }

  let incomes = $state<Income[]>([])
  let incomeCounter = $state(0)

  let canContinue = $derived(
    incomes.some((i) => i.amount.trim().length > 0 && Number(i.amount) > 0),
  )

  function addIncome() {
    incomeCounter++
    for (const inc of incomes) {
      inc.editing = false
    }
    incomes.push({
      id: crypto.randomUUID(),
      name: $_('page.setup.income.defaultName', { values: { index: incomeCounter } }),
      amount: '',
      frequency: 'monthly',
      showAdvanced: false,
      withholdTaxes: false,
      taxPercentage: '',
      start: 'immediately',
      end: 'never',
      changeOverTime: 'none',
      editing: true,
      editingName: false,
    })
  }

  function toggleEditing(income: Income) {
    income.editing = !income.editing
  }

  function startEditingName(income: Income) {
    income.editingName = true
  }

  function stopEditingName(income: Income) {
    income.editingName = false
  }

  function formatAmount(amount: string): string {
    const num = Number(amount)
    if (isNaN(num) || num === 0) return ''
    return `+${num.toLocaleString()} EUR`
  }

  function handleContinue() {
    goto(routes.HOME)
  }

  function handleSkip() {
    goto(routes.HOME)
  }

  function handleBack() {
    goto(routes.SETUP_FINANCES)
  }
</script>

<div class="flex w-full max-w-[576px] flex-col items-end gap-8">
  <div class="flex w-full flex-col gap-2 text-foreground">
    <h1 class="text-2xl font-bold leading-8">
      {$_('page.setup.income.title')}
    </h1>
    <p class="text-base">
      {$_('page.setup.income.description')}
    </p>
  </div>

  <div class="flex w-full flex-col gap-4">
    {#each incomes as income (income.id)}
      <Card class="gap-0 py-0">
        <CardContent class={income.editing ? 'p-4' : 'px-4 py-2.5'}>
          {#if income.editing}
            <div class="flex flex-col gap-4">
              <!-- Header row -->
              <div class="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  class="shrink-0"
                  onclick={() => toggleEditing(income)}
                >
                  <ChevronsUpDown class="size-4" />
                </Button>
                {#if income.editingName}
                  <Input
                    value={income.name}
                    oninput={(e) => {
                      income.name = (e.target as HTMLInputElement).value
                    }}
                    onblur={() => stopEditingName(income)}
                    onkeydown={(e) => {
                      if (e.key === 'Enter') stopEditingName(income)
                    }}
                    class="flex-1"
                  />
                {:else}
                  <span class="flex-1 truncate text-base font-medium">
                    {income.name}
                  </span>
                  <Button variant="ghost" size="icon" onclick={() => startEditingName(income)}>
                    <SquarePen class="size-4" />
                  </Button>
                {/if}
                <Button variant="ghost" size="icon">
                  <EllipsisVertical class="size-4" />
                </Button>
              </div>

              <!-- Amount and Frequency row -->
              <div class="flex items-center gap-2">
                <div class="flex flex-1 flex-col gap-2">
                  <Label>{$_('page.setup.income.amount')}</Label>
                  <div class="relative">
                    <Input
                      placeholder="0"
                      value={income.amount}
                      oninput={(e) => {
                        income.amount = (e.target as HTMLInputElement).value
                      }}
                      class="pr-14"
                    />
                    <span
                      class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm font-medium text-muted-foreground"
                    >
                      EUR
                    </span>
                  </div>
                </div>
                <div class="flex flex-1 flex-col gap-2">
                  <Label>{$_('page.setup.income.frequency')}</Label>
                  <Select.Root
                    type="single"
                    value={income.frequency}
                    onValueChange={(v) => {
                      if (v) income.frequency = v
                    }}
                  >
                    <Select.Trigger class="w-full">
                      {income.frequency === 'monthly'
                        ? $_('page.setup.income.monthly')
                        : income.frequency === 'yearly'
                          ? $_('page.setup.income.yearly')
                          : $_('page.setup.income.weekly')}
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="monthly">{$_('page.setup.income.monthly')}</Select.Item>
                      <Select.Item value="yearly">{$_('page.setup.income.yearly')}</Select.Item>
                      <Select.Item value="weekly">{$_('page.setup.income.weekly')}</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
              </div>

              <!-- Advanced options toggle -->
              <div class="flex cursor-pointer items-center gap-2">
                <Switch
                  checked={income.showAdvanced}
                  onCheckedChange={(v) => {
                    income.showAdvanced = v
                  }}
                />
                <span class="text-sm font-medium">{$_('page.setup.income.advancedOptions')}</span>
              </div>

              <!-- Advanced options content -->
              {#if income.showAdvanced}
                <Separator />

                <!-- Tax withholding -->
                <div class="flex items-end gap-4">
                  <div class="flex flex-1 flex-col justify-center">
                    <label class="flex h-8 cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={income.withholdTaxes}
                        onCheckedChange={(v) => {
                          income.withholdTaxes = v === true
                        }}
                      />
                      <span class="text-sm font-medium leading-none">
                        {$_('page.setup.income.withholdTaxes')}
                      </span>
                    </label>
                  </div>
                  {#if income.withholdTaxes}
                    <div class="flex flex-1 flex-col gap-2">
                      <Label>{$_('page.setup.income.percentageToWithhold')}</Label>
                      <div class="relative">
                        <Input
                          placeholder="0"
                          value={income.taxPercentage}
                          oninput={(e) => {
                            income.taxPercentage = (e.target as HTMLInputElement).value
                          }}
                          class="pr-8"
                        />
                        <span
                          class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-sm font-medium text-muted-foreground"
                        >
                          %
                        </span>
                      </div>
                    </div>
                  {:else}
                    <div class="flex-1"></div>
                  {/if}
                </div>

                <Separator />

                <!-- Start -->
                <div class="flex items-end gap-2">
                  <div class="flex flex-1 flex-col gap-2">
                    <Label>{$_('page.setup.income.start')}</Label>
                    <Select.Root
                      type="single"
                      value={income.start}
                      onValueChange={(v) => {
                        if (v) income.start = v
                      }}
                    >
                      <Select.Trigger class="w-full">
                        {$_('page.setup.income.immediately')}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="immediately">
                          {$_('page.setup.income.immediately')}
                        </Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">
                    {$_('page.setup.income.startDescription')}
                  </p>
                </div>

                <!-- End -->
                <div class="flex items-end gap-2">
                  <div class="flex flex-1 flex-col gap-2">
                    <Label>{$_('page.setup.income.end')}</Label>
                    <Select.Root
                      type="single"
                      value={income.end}
                      onValueChange={(v) => {
                        if (v) income.end = v
                      }}
                    >
                      <Select.Trigger class="w-full">
                        {$_('page.setup.income.never')}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="never">{$_('page.setup.income.never')}</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">
                    {$_('page.setup.income.endDescription')}
                  </p>
                </div>

                <!-- Change over time -->
                <div class="flex items-end gap-2">
                  <div class="flex flex-1 flex-col gap-2">
                    <Label>{$_('page.setup.income.changeOverTime')}</Label>
                    <Select.Root
                      type="single"
                      value={income.changeOverTime}
                      onValueChange={(v) => {
                        if (v) income.changeOverTime = v
                      }}
                    >
                      <Select.Trigger class="w-full">
                        {$_('page.setup.income.none')}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="none">{$_('page.setup.income.none')}</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <p class="flex min-h-8 flex-1 items-center text-xs text-muted-foreground">
                    {$_('page.setup.income.changeDescription')}
                  </p>
                </div>
              {/if}
            </div>
          {:else}
            <!-- Collapsed card -->
            <button
              class="flex w-full cursor-pointer items-center gap-2"
              onclick={() => toggleEditing(income)}
            >
              <span class="shrink-0 text-muted-foreground">
                <ChevronsUpDown class="size-4" />
              </span>
              <span class="flex-1 truncate text-left text-base font-medium">
                {income.name}
              </span>
              {#if formatAmount(income.amount)}
                <span class="shrink-0 text-sm text-green-600">
                  {formatAmount(income.amount)}
                </span>
              {/if}
            </button>
          {/if}
        </CardContent>
      </Card>
    {/each}

    <div>
      <Button variant="secondary" onclick={addIncome}>
        <Plus class="size-4" />
        {$_('page.setup.income.addIncome')}
      </Button>
    </div>
  </div>

  <div class="flex w-full items-center gap-4">
    <Button variant="ghost" onclick={handleBack}>
      {$_('page.setup.back')}
    </Button>
    <div class="flex flex-1 items-center justify-end gap-2">
      <Button variant="ghost" onclick={handleSkip}>
        {$_('page.setup.skip')}
      </Button>
      <Button disabled={!canContinue} onclick={handleContinue}>
        {$_('page.setup.continue')}
        <ArrowRight class="size-4" />
      </Button>
    </div>
  </div>
</div>
