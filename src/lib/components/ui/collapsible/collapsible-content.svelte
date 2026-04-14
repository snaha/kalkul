<script lang="ts">
  import { Collapsible as CollapsiblePrimitive } from 'bits-ui'

  let { ref = $bindable(), ...restProps }: CollapsiblePrimitive.ContentProps = $props()
</script>

<CollapsiblePrimitive.Content bind:ref data-slot="collapsible-content" {...restProps} />
