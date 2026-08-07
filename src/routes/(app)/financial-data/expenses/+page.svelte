<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ArrowRight from '@lucide/svelte/icons/arrow-right'

  import { resolve } from '$app/paths'

  import ExpensesEditor from '$lib/components/expenses-editor.svelte'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  const lastUpdatedDate = $derived(appStore.formatLastUpdated())

  // Loan installments are recurring outflows too, but they live on the
  // financed assets / liabilities that own them — listed read-only here.
  const installments = $derived([
    ...(appStore.profile.tangible_assets ?? [])
      .filter((a) => a.status === 'financed' && (a.installment_amount ?? 0) > 0)
      .map((a) => ({
        id: a.id,
        label: a.name,
        amount: a.installment_amount ?? 0,
        href: routes.FINANCIAL_DATA_TANGIBLE_ASSETS,
      })),
    ...(appStore.profile.liabilities ?? [])
      .filter((l) => l.installment_amount > 0)
      .map((l) => ({
        id: l.id,
        label: l.name,
        amount: l.installment_amount,
        href: routes.FINANCIAL_DATA_LIABILITIES,
      })),
  ])
</script>

<div class="flex w-full flex-col items-start gap-2">
  <p class="text-lg leading-7 font-medium">{$_('page.financialData.expenses.title')}</p>
  {#if lastUpdatedDate}
    <span class="text-xs leading-4 text-muted-foreground">
      {$_('page.financialData.overview.lastUpdated', { values: { date: lastUpdatedDate } })}
    </span>
  {/if}
</div>

<p class="text-sm leading-5 text-muted-foreground">
  {$_('page.financialData.expenses.description')}
</p>

<ExpensesEditor />

{#if installments.length > 0}
  <div class="flex w-full flex-col gap-4">
    <p class="text-sm leading-5 text-muted-foreground">
      {$_('page.financialData.expenses.installmentsCaption')}
    </p>
    {#each installments as installment (installment.id)}
      <a
        href={resolve(installment.href)}
        class="flex items-center gap-2 rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-accent"
      >
        <span class="flex-1 truncate text-base font-medium">{installment.label}</span>
        <span class="shrink-0 text-sm text-destructive">
          -{appStore.formatCurrency(installment.amount)}
        </span>
        <ArrowRight class="size-4 shrink-0 text-muted-foreground" />
      </a>
    {/each}
  </div>
{/if}
