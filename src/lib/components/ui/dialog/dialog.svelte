<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui'

  import { holdData } from '$lib/stores/data-holds.svelte'

  type Props = DialogPrimitive.RootProps & {
    /**
     * Whether the open dialog holds its own copy of the data (a draft it
     * saves back), so the data must not be replaced from outside meanwhile.
     * Most dialogs do; pass false for one that edits no data.
     */
    holdsData?: boolean
  }

  let { open = $bindable(false), holdsData = true, ...restProps }: Props = $props()

  holdData(() => open && holdsData)
</script>

<DialogPrimitive.Root bind:open {...restProps} />
