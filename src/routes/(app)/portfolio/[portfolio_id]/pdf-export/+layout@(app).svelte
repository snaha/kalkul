<script lang="ts">
  let { children } = $props()
</script>

{@render children()}

<style>
  :global(html, body) {
    height: 100%;
    margin: 0;
    padding: 0;
    background: white;
  }

  @media print {
    :global(html, body) {
      background: white !important;
    }
  }
</style>
