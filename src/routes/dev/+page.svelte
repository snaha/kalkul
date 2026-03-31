<!-- localization-exclude -->
<script lang="ts">
  import Button from '$lib/components/ui/button.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import Vertical from '$lib/components/ui/vertical.svelte'
  import ContentLayout from '$lib/components/content-layout.svelte'
  import { storageErrorStore } from '$lib/stores/storage-error.svelte'
</script>

<ContentLayout centered={false}>
  <Vertical --vertical-gap="var(--double-padding)">
    <Typography variant="h4">Dev Tools</Typography>

    <Vertical --vertical-gap="var(--padding)">
      <Typography variant="h5">Storage Error Banner</Typography>
      <Typography>Simulate a localStorage quota exceeded error.</Typography>
      <div class="actions">
        <Button variant="strong" dimension="compact" onclick={() => storageErrorStore.setError()}>
          Trigger storage error
        </Button>
        <Button variant="secondary" dimension="compact" onclick={() => storageErrorStore.clear()}>
          Clear storage error
        </Button>
      </div>
      <Typography variant="small">
        Status: {storageErrorStore.hasError ? 'Error active' : 'No error'}
      </Typography>
    </Vertical>
  </Vertical>
</ContentLayout>

<style>
  .actions {
    display: flex;
    gap: var(--half-padding);
  }
</style>
