<script lang="ts">
  interface Props {
    messages?: string[]
  }

  let { messages }: Props = $props()
</script>

<!-- Localized schema messages for one editor item whose last save was
     rejected (see ListEditor.errors). Rendered directly under the card. -->
{#if messages && messages.length > 0}
  <p class="px-2 text-sm text-destructive" role="alert">
    {messages.join(' ')}
  </p>
{/if}
