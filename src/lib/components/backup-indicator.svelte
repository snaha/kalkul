<script lang="ts">
  import { _ } from 'svelte-i18n'

  import CircleAlert from '@lucide/svelte/icons/circle-alert'
  import Clock from '@lucide/svelte/icons/clock'
  import CloudCheck from '@lucide/svelte/icons/cloud-check'
  import CloudUpload from '@lucide/svelte/icons/cloud-upload'
  import LoaderCircle from '@lucide/svelte/icons/loader-circle'
  import RefreshCw from '@lucide/svelte/icons/refresh-cw'

  import { resolve } from '$app/paths'

  import { Button } from '$lib/components/ui/button'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'
  import { cloudBackupStore } from '$lib/stores/cloud-backup.svelte'
  import { cn } from '$lib/utils'

  interface Props {
    /** Classes for the navbar's dark background. */
    class?: string
  }

  let { class: className }: Props = $props()

  /** How long "Updated from …" stays up after a download. */
  const NOTICE_MS = 6000

  // Re-evaluated when a new download lands, and once more when it expires.
  let now = $state(Date.now())
  $effect(() => {
    const pull = cloudBackupStore.lastPull
    if (!pull) return
    now = Date.now()
    const timer = setTimeout(() => (now = Date.now()), NOTICE_MS)
    return () => clearTimeout(timer)
  })

  type Indicator = {
    icon: typeof CloudCheck
    label: string
    /** Needs the user: amber, and the label always shows. */
    attention?: boolean
    spin?: boolean
  }

  function attention(label: string): Indicator {
    return { icon: CircleAlert, label, attention: true }
  }

  const indicator = $derived.by((): Indicator | undefined => {
    const status = cloudBackupStore.status
    const pull = cloudBackupStore.lastPull
    switch (status.kind) {
      case 'disconnected':
        return undefined
      case 'needs-permission':
        return attention($_('navbar.backup.needsPermission'))
      case 'conflict':
        return attention($_('navbar.backup.conflict'))
      case 'folder-missing':
        return attention($_('navbar.backup.folderMissing'))
      case 'error':
        return attention($_('navbar.backup.failed'))
      case 'held':
        return {
          icon: Clock,
          label: $_('navbar.backup.held', { values: { computer: status.remoteDevice } }),
        }
      case 'syncing':
        return { icon: LoaderCircle, label: $_('navbar.backup.saving'), spin: true }
      case 'synced':
        if (cloudBackupStore.pending) {
          return { icon: CloudUpload, label: $_('navbar.backup.pending') }
        }
        if (pull && now - pull.at < NOTICE_MS) {
          return {
            icon: RefreshCw,
            label: $_('navbar.backup.updatedFrom', { values: { computer: pull.device } }),
          }
        }
        return {
          icon: CloudCheck,
          label: cloudBackupStore.lastSyncedAt
            ? $_('navbar.backup.savedAt', {
                values: { time: appStore.formatDateTime(cloudBackupStore.lastSyncedAt) },
              })
            : $_('navbar.backup.saved'),
        }
    }
  })
</script>

{#if indicator}
  {@const Icon = indicator.icon}
  <Button
    variant="ghost"
    size="sm"
    href={resolve(routes.SETTINGS)}
    title={indicator.label}
    aria-label={indicator.label}
    class={cn(className, indicator.attention && 'text-amber-400 hover:text-amber-300')}
  >
    <Icon class={cn('size-4', indicator.spin && 'animate-spin')} />
    <span class={cn('max-w-64 truncate', !indicator.attention && 'hidden sm:inline')}>
      {indicator.label}
    </span>
  </Button>
{/if}
