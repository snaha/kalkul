<script lang="ts">
  import { EllipsisVertical } from '@lucide/svelte'
  import { base } from '$app/paths'
  import { Button } from '$lib/components/ui/button'
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte'
</script>

<header class="flex items-center justify-between bg-neutral-950 p-2">
  <a href="{base}/">
    <img src="{base}/logo.svg" alt="Kalkul" class="size-9" />
  </a>
  <div class="flex items-center gap-4">
    <ThemeSwitcher class="text-white hover:bg-white/10" />
    <Button variant="ghost" size="icon" class="text-white hover:bg-white/10">
      <EllipsisVertical class="size-4" />
    </Button>
  </div>
</header>
