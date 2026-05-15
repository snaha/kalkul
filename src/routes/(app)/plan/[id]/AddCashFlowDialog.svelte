<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { X } from '@lucide/svelte'

  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { cn } from '$lib/utils'

  type CashFlowKind = 'transfer' | 'income' | 'expense'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onContinue: (kind: CashFlowKind) => void
  }

  let { open = $bindable(), onOpenChange, onContinue }: Props = $props()

  let selectedKind = $state<CashFlowKind>('income')

  // Re-seed default selection whenever the dialog opens.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      selectedKind = 'income'
    }
    wasOpen = open
  })

  const options = $derived([
    {
      id: 'transfer' as const,
      label: $_('page.plan.transfer'),
      description: $_('page.plan.transferDescription'),
      disabled: false,
    },
    {
      id: 'income' as const,
      label: $_('page.plan.income'),
      description: $_('page.plan.incomeDescription'),
      disabled: false,
    },
    {
      id: 'expense' as const,
      label: $_('page.plan.expense'),
      description: $_('page.plan.expenseDescription'),
      disabled: false,
    },
  ])

  function close() {
    onOpenChange(false)
  }

  function handleContinue() {
    onContinue(selectedKind)
    close()
  }
</script>

<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-md">
    <Dialog.Header class="flex flex-row items-center border-b p-4">
      <Dialog.Title class="flex-1 text-base font-semibold">
        {$_('page.plan.addCashFlow')}
      </Dialog.Title>
      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex flex-col gap-3 p-4">
      <p class="text-sm">{$_('page.plan.addCashFlowQuestion')}</p>

      <div class="flex flex-col gap-2">
        {#each options as option (option.id)}
          <button
            type="button"
            disabled={option.disabled}
            onclick={() => {
              if (!option.disabled) selectedKind = option.id
            }}
            class={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
              option.disabled && 'cursor-not-allowed opacity-50',
              !option.disabled && 'hover:bg-accent/50',
              !option.disabled && selectedKind === option.id && 'border-primary bg-accent',
            )}
          >
            <div
              class={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                !option.disabled && selectedKind === option.id
                  ? 'border-primary'
                  : 'border-muted-foreground',
              )}
            >
              {#if !option.disabled && selectedKind === option.id}
                <div class="size-2 rounded-full bg-primary"></div>
              {/if}
            </div>
            <div class="flex flex-col">
              <span class="text-sm font-medium">{option.label}</span>
              <span class="text-xs text-muted-foreground">{option.description}</span>
            </div>
          </button>
        {/each}
      </div>
    </div>

    <Dialog.Footer class="flex flex-row justify-end gap-2 border-t p-4">
      <Button variant="secondary" onclick={close}>{$_('page.plan.cancel')}</Button>
      <Button onclick={handleContinue}>{$_('page.plan.continue')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
