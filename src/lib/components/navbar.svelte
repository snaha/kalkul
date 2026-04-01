<script lang="ts">
  import { Moon, Sun, EllipsisVertical } from '@lucide/svelte'
  import { base } from '$app/paths'
  import { Button } from '$lib/components/ui/button'

  let dark = $state(false)

  function toggleDarkMode() {
    dark = !dark
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }

  $effect(() => {
    dark =
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  })
</script>

<header class="flex items-center justify-between bg-primary p-2">
  <a href="{base}/">
    <img src="{base}/logo.svg" alt="Kalkul" class="size-9 invert" />
  </a>
  <div class="flex items-center gap-4">
    <Button
      variant="ghost"
      size="icon"
      class="text-primary-foreground hover:bg-white/10"
      onclick={toggleDarkMode}
    >
      {#if dark}
        <Sun class="size-4" />
      {:else}
        <Moon class="size-4" />
      {/if}
    </Button>
    <Button variant="ghost" size="icon" class="text-primary-foreground hover:bg-white/10">
      <EllipsisVertical class="size-4" />
    </Button>
  </div>
</header>
