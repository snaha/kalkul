<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Info from '@lucide/svelte/icons/info'

  interface Props {
    /** What the text calls the item: incomes, expenses and transfers are cash flows. */
    kind?: 'asset' | 'cashFlow'
  }

  let { kind = 'asset' }: Props = $props()
</script>

<!-- Figma "Alert" on every imported item's dialog (e.g. 1364): the item came
     from financial data, and edits here stay in this projection. -->
<div class="flex items-start gap-2 rounded-lg border bg-accent px-2.5 py-2 text-sm">
  <Info class="mt-0.5 size-4 shrink-0" />
  <div class="flex flex-col gap-0.5">
    <p class="font-medium">{$_('page.plan.localOverrideTitle')}</p>
    <p class="text-muted-foreground">
      {kind === 'cashFlow'
        ? $_('page.plan.localOverrideDescriptionCashFlow')
        : $_('page.plan.localOverrideDescription')}
    </p>
  </div>
</div>
