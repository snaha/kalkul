<script lang="ts">
  import EditProfile from '$lib/components/edit-profile.svelte'
  import Fullscreen from '$lib/components/fullscreen.svelte'

  function close() {
    history.back()
  }
</script>

<Fullscreen>
  <EditProfile {close} />
</Fullscreen>
