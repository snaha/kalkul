<script lang="ts">
  import { EllipsisVertical } from '@lucide/svelte'

  import { resolve } from '$app/paths'

  import logo from '$lib/assets/logo.svg'
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte'
  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'
  import { notImplemented } from '$lib/utils'
</script>

<header class="flex items-center justify-between bg-neutral-950 p-2">
  <a href={resolve(routes.HOME)}>
    <img src={logo} alt="Kalkul" class="size-9" />
  </a>
  <div class="flex items-center gap-4">
    <ThemeSwitcher class="text-white hover:bg-white/10" />
    <Button
      variant="ghost"
      size="icon"
      class="text-white hover:bg-white/10"
      onclick={notImplemented}
    >
      <EllipsisVertical class="size-4" />
    </Button>
  </div>
</header>
