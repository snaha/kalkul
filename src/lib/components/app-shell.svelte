<script lang="ts">
  import Navbar from '$lib/components/navbar.svelte'
  import { Separator } from '$lib/components/ui/separator'

  let { children } = $props()
</script>

<!-- Default tab title for every page inside the frame. The landing sets its
     own; without this the dashboard would keep it after "Try the demo" swaps
     the landing out. -->
<svelte:head>
  <title>Kalkul</title>
</svelte:head>

<!-- The in-app frame: dark navbar, fixed viewport height, one scrolling main.
     A component rather than the layout itself so the home route can opt out of
     it and render the marketing landing at full page scroll instead. -->
<div class="flex h-screen flex-col bg-background">
  <Navbar />
  <Separator />
  <main class="flex min-h-0 flex-1 flex-col">
    {@render children()}
  </main>
</div>
