<script lang="ts">
  import { _ } from 'svelte-i18n'

  import X from '@lucide/svelte/icons/x'

  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { appStore } from '$lib/stores/app.svelte'
  import { cn } from '$lib/utils'

  export type AssetKind = 'cash' | 'investment' | 'tangibleAsset' | 'liability'

  interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onContinue: (kind: AssetKind) => void
  }

  let { open = $bindable(), onOpenChange, onContinue }: Props = $props()

  const cashAlreadyExists = $derived(
    appStore.profile.cash_amount !== undefined && appStore.profile.cash_amount > 0,
  )

  let selectedKind = $state<AssetKind>('investment')

  // Re-seed default selection whenever the dialog opens. Default to the first
  // available option (cash if it doesn't yet exist, otherwise investment).
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      selectedKind = cashAlreadyExists ? 'investment' : 'cash'
    }
    wasOpen = open
  })

  const options = $derived([
    {
      id: 'cash' as const,
      label: $_('page.plan.cash'),
      description: cashAlreadyExists
        ? $_('page.plan.cashAlreadyExists')
        : $_('page.plan.cashDescription'),
      // Editing cash via the add flow doesn't make sense when one already exists.
      disabled: cashAlreadyExists,
    },
    {
      id: 'investment' as const,
      label: $_('page.plan.investment'),
      description: $_('page.plan.investmentDescription'),
      disabled: false,
    },
    {
      id: 'tangibleAsset' as const,
      label: $_('page.plan.tangibleAsset'),
      description: $_('page.plan.tangibleAssetDescription'),
      disabled: false,
    },
    {
      id: 'liability' as const,
      label: $_('page.plan.liability'),
      description: $_('page.plan.liabilityDescription'),
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
        {$_('page.plan.addAsset')}
      </Dialog.Title>
      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex flex-col gap-3 p-4">
      <p class="text-sm">{$_('page.plan.addAssetQuestion')}</p>

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
