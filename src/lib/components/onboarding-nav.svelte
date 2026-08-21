<script lang="ts">
  import { _ } from 'svelte-i18n'

  import ArrowRight from '@lucide/svelte/icons/arrow-right'
  import Check from '@lucide/svelte/icons/check'

  import { Button } from '$lib/components/ui/button'

  interface Props {
    canContinue: boolean
    onBack: () => void
    onContinue: () => void
    /** When true, the primary button reads "Done" with a check icon (last step). */
    done?: boolean
  }

  let { canContinue, onBack, onContinue, done = false }: Props = $props()
</script>

<div class="flex w-full items-center gap-4">
  <Button variant="ghost" onclick={onBack}>
    {$_('page.setup.back')}
  </Button>
  <div class="flex flex-1 items-center justify-end gap-2">
    <Button disabled={!canContinue} onclick={onContinue}>
      {done ? $_('page.setup.done') : $_('page.setup.continue')}
      {#if done}
        <Check class="size-4" />
      {:else}
        <ArrowRight class="size-4" />
      {/if}
    </Button>
  </div>
</div>
