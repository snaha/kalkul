<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { ArrowRight } from '@lucide/svelte'

  import { Button } from '$lib/components/ui/button'

  interface Props {
    canContinue: boolean
    onBack: () => void
    onSkip: () => void
    onContinue: () => void
  }

  let { canContinue, onBack, onSkip, onContinue }: Props = $props()
</script>

<div class="flex w-full items-center gap-4">
  <Button variant="ghost" onclick={onBack}>
    {$_('page.setup.back')}
  </Button>
  <div class="flex flex-1 items-center justify-end gap-2">
    <Button variant="ghost" onclick={onSkip}>
      {$_('page.setup.skip')}
    </Button>
    <Button disabled={!canContinue} onclick={onContinue}>
      {$_('page.setup.continue')}
      <ArrowRight class="size-4" />
    </Button>
  </div>
</div>
