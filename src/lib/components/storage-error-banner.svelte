<script lang="ts">
  import Typography from '$lib/components/ui/typography.svelte'
  import Button from '$lib/components/ui/button.svelte'
  import { _ } from 'svelte-i18n'
  import { storageErrorStore } from '$lib/stores/storage-error.svelte'
</script>

{#if storageErrorStore.hasError}
  <div class="banner" role="alert">
    <Typography --typography-color="var(--colors-base)">{$_('error.storageFull')}</Typography>
    <Button
      variant="ghost"
      dimension="compact"
      onclick={() => storageErrorStore.clear()}
      aria-label={$_('action.close')}
    >
      <Typography --typography-color="var(--colors-base)">&times;</Typography>
    </Button>
  </div>
{/if}

<style>
  .banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--half-padding) var(--padding);
    background-color: var(--colors-red);
  }
</style>
