<script lang="ts" module>
  export interface KindPickerOption<T extends string = string> {
    id: T
    label: string
    description: string
    disabled?: boolean
  }
</script>

<script lang="ts" generics="T extends string">
  import { _ } from 'svelte-i18n'

  import X from '@lucide/svelte/icons/x'

  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Label } from '$lib/components/ui/label'
  import * as RadioGroup from '$lib/components/ui/radio-group'
  import { cn } from '$lib/utils'

  interface Props {
    open: boolean
    /** Dialog title, e.g. "Add asset". */
    title: string
    /** Question line above the options, e.g. "What type of asset…?". */
    question: string
    options: KindPickerOption<T>[]
    /** Selection seeded every time the dialog opens. */
    defaultId: T
    onOpenChange: (open: boolean) => void
    onContinue: (kind: T) => void
  }

  let {
    open = $bindable(),
    title,
    question,
    options,
    defaultId,
    onOpenChange,
    onContinue,
  }: Props = $props()

  // Initial value only matters before the first open — the $effect below
  // re-seeds from the current defaultId every time the dialog opens.
  // svelte-ignore state_referenced_locally
  let selected = $state<T>(defaultId)

  // Re-seed the selection whenever the dialog opens.
  let wasOpen = false
  $effect(() => {
    if (open && !wasOpen) {
      selected = defaultId
    }
    wasOpen = open
  })

  function close() {
    onOpenChange(false)
  }

  function handleContinue() {
    onContinue(selected)
    close()
  }
</script>

<!-- Shared kind picker for the Add asset / Add cash flow dialogs. Built on
     RadioGroup so screen readers get radiogroup/radio roles, a checked state,
     and arrow-key navigation — the previous hand-rolled buttons conveyed the
     selection by color only. -->
<Dialog.Root bind:open {onOpenChange}>
  <Dialog.Content showCloseButton={false} class="gap-0 p-0 sm:max-w-md">
    <Dialog.Header class="flex flex-row items-center border-b p-4">
      <Dialog.Title class="flex-1 text-base font-semibold">
        {title}
      </Dialog.Title>
      <Button variant="ghost" size="icon" onclick={close} aria-label={$_('page.plan.closeDialog')}>
        <X class="size-4" />
      </Button>
    </Dialog.Header>

    <div class="flex flex-col gap-3 p-4">
      <p class="text-sm">{question}</p>

      <RadioGroup.Root
        value={selected}
        onValueChange={(v) => (selected = v as T)}
        class="flex flex-col gap-2"
      >
        {#each options as option (option.id)}
          <Label
            class={cn(
              'flex items-start gap-3 rounded-lg border p-3 text-left font-normal transition-colors',
              option.disabled && 'cursor-not-allowed opacity-50',
              !option.disabled && 'cursor-pointer hover:bg-accent/50',
              !option.disabled && selected === option.id && 'border-primary bg-accent',
            )}
          >
            <RadioGroup.Item value={option.id} disabled={option.disabled} class="mt-0.5" />
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium">{option.label}</span>
              <span class="text-xs text-muted-foreground">{option.description}</span>
            </div>
          </Label>
        {/each}
      </RadioGroup.Root>
    </div>

    <Dialog.Footer class="flex flex-row justify-end gap-2 border-t p-4">
      <Button variant="secondary" onclick={close}>{$_('page.plan.cancel')}</Button>
      <Button onclick={handleContinue}>{$_('page.plan.continue')}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
