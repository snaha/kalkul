<script lang="ts">
  import Navbar from '$lib/components/navbar.svelte'
  import { Separator } from '$lib/components/ui/separator'

  let { children } = $props()
</script>

<div class="flex h-screen flex-col bg-background">
  <Navbar />
  <Separator />
  <main class="flex min-h-0 flex-1 flex-col">
    {@render children()}
  </main>
</div>
