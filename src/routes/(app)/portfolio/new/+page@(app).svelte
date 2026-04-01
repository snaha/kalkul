<script lang="ts">
  import EditPortfolio from '$lib/components/edit-portfolio.svelte'
  import Fullscreen from '$lib/components/fullscreen.svelte'

  function close() {
    history.back()
  }
</script>

<Fullscreen>
  <EditPortfolio {close} />
</Fullscreen>
