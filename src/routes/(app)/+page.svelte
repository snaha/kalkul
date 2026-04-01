<script lang="ts">
  import { ArrowRight } from '@lucide/svelte'
  import { base } from '$app/paths'
  import { _ } from 'svelte-i18n'
  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'
</script>

<div class="flex flex-1 flex-col items-center p-8">
  <div class="flex w-full max-w-[576px] flex-col items-center gap-4">
    <img src="{base}/images/hero-illustration.svg" alt={$_('page.home.heroAlt')} class="size-80" />
    <div class="flex w-full flex-col gap-2 text-center text-foreground">
      <h1 class="text-3xl font-bold leading-9">
        {$_('page.home.heroTitle')}
      </h1>
      <p class="text-lg">
        {$_('page.home.heroDescription')}
      </p>
    </div>
    <Button href={routes.SETUP}>
      {$_('page.home.getStarted')}
      <ArrowRight class="size-4" />
    </Button>
  </div>
</div>
