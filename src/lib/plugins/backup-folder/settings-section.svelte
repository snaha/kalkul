<script lang="ts">
  import { _, locale } from 'svelte-i18n'

  import FolderSync from '@lucide/svelte/icons/folder-sync'

  import { Button } from '$lib/components/ui/button'

  import { backupFolderStore } from './store.svelte'

  /** When something happened, in the UI language. */
  const dateTime = (ms: number) =>
    new Date(ms).toLocaleString($locale ?? undefined, { dateStyle: 'medium', timeStyle: 'short' })

  const status = $derived(backupFolderStore.status)

  let busy = $state(false)
  // Replacing this computer's data takes a second, explicit click.
  let confirmingReplace = $state(false)

  $effect(() => {
    if (status.kind !== 'conflict' && status.kind !== 'syncing') confirmingReplace = false
  })

  async function act(action: () => Promise<void>): Promise<void> {
    busy = true
    try {
      await action()
    } catch (e) {
      console.error('Backup folder action failed', e)
      alert($_('plugins.backupFolder.settings.error'))
    } finally {
      busy = false
    }
  }

  function connect(): Promise<void> {
    return act(async () => {
      if (await backupFolderStore.beginConnect()) await backupFolderStore.connectChosen()
    })
  }
</script>

<div class="flex flex-col gap-1">
  <h2 class="text-xl font-bold text-foreground">{$_('plugins.backupFolder.settings.nav')}</h2>
  <p class="text-sm text-muted-foreground">
    {$_('plugins.backupFolder.settings.description')}
  </p>
</div>

{#if !backupFolderStore.supported}
  <p class="text-sm font-medium text-muted-foreground">
    {$_('plugins.backupFolder.settings.unsupported')}
  </p>
{:else if status.kind === 'disconnected'}
  <div class="flex items-start gap-4">
    <Button variant="outline" class="w-44" disabled={busy} onclick={connect}>
      <FolderSync class="size-4" />
      {$_('plugins.backupFolder.settings.chooseFolder')}
    </Button>
    <p class="flex-1 text-sm font-medium text-muted-foreground">
      {$_('plugins.backupFolder.settings.chooseFolderDescription')}
    </p>
  </div>
{:else}
  <div class="flex items-start gap-4">
    <Button
      variant="outline"
      class="w-44"
      disabled={busy}
      onclick={() => act(backupFolderStore.disconnect)}
    >
      {$_('plugins.backupFolder.settings.disconnect')}
    </Button>
    <p class="flex-1 text-sm font-medium text-muted-foreground">
      {#if backupFolderStore.connection}
        {$_('plugins.backupFolder.settings.connectedTo', {
          values: {
            folder: backupFolderStore.connection.folder,
            computer: backupFolderStore.connection.device,
          },
        })}
      {/if}
      {$_('plugins.backupFolder.settings.disconnectDescription')}
    </p>
  </div>

  <div class="flex flex-col gap-3 rounded-md border p-4" role="status">
    {#if status.kind === 'checking'}
      <p class="text-sm text-foreground">{$_('plugins.backupFolder.settings.checking')}</p>
    {:else if status.kind === 'syncing'}
      <p class="text-sm text-foreground">{$_('plugins.backupFolder.settings.syncing')}</p>
    {:else if status.kind === 'synced'}
      <p class="text-sm text-foreground">
        {backupFolderStore.lastCheckedAt
          ? $_('plugins.backupFolder.settings.syncedAt', {
              values: { time: dateTime(backupFolderStore.lastCheckedAt) },
            })
          : $_('plugins.backupFolder.settings.connected')}
      </p>
    {:else if status.kind === 'folder-missing'}
      <p class="text-sm text-foreground">
        {$_('plugins.backupFolder.settings.folderMissing', {
          values: { folder: backupFolderStore.connection?.folder ?? '' },
        })}
      </p>
      <Button class="self-start" disabled={busy} onclick={connect}>
        <FolderSync class="size-4" />
        {$_('plugins.backupFolder.settings.chooseFolderAgain')}
      </Button>
    {:else if status.kind === 'needs-permission'}
      <p class="text-sm text-foreground">{$_('plugins.backupFolder.settings.needsPermission')}</p>
      <Button class="self-start" disabled={busy} onclick={() => act(backupFolderStore.allowAccess)}>
        {$_('plugins.backupFolder.settings.allowAccess')}
      </Button>
    {:else if status.kind === 'conflict'}
      <p class="text-sm text-foreground">
        {$_('plugins.backupFolder.settings.conflict', {
          values: {
            computer: status.remoteDevice,
            time: dateTime(status.remoteTime),
          },
        })}
      </p>
      {#if confirmingReplace}
        <p class="text-sm font-bold text-foreground">
          {$_('plugins.backupFolder.settings.replaceWarning')}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            disabled={busy}
            onclick={() => act(() => backupFolderStore.resolve('remote'))}
          >
            {$_('plugins.backupFolder.settings.replaceConfirm')}
          </Button>
          <Button variant="outline" disabled={busy} onclick={() => (confirmingReplace = false)}>
            {$_('plugins.backupFolder.settings.cancel')}
          </Button>
        </div>
      {:else}
        <div class="flex flex-wrap gap-2">
          <Button disabled={busy} onclick={() => act(() => backupFolderStore.resolve('local'))}>
            {$_('plugins.backupFolder.settings.keepLocal')}
          </Button>
          <Button variant="outline" disabled={busy} onclick={() => (confirmingReplace = true)}>
            {$_('plugins.backupFolder.settings.useRemote')}
          </Button>
        </div>
      {/if}
    {:else if status.kind === 'fork'}
      <p class="text-sm text-foreground">{$_('plugins.backupFolder.settings.fork')}</p>
      <div class="flex flex-wrap gap-2">
        {#each status.versions as version (version.hash)}
          <Button
            variant="outline"
            disabled={busy}
            onclick={() => act(() => backupFolderStore.choose(version.hash))}
          >
            {$_('plugins.backupFolder.settings.useVersion', {
              values: {
                computer: version.device,
                time: dateTime(version.time),
              },
            })}
          </Button>
        {/each}
      </div>
    {:else if status.kind === 'unreadable'}
      <p class="text-sm text-foreground">
        {$_('plugins.backupFolder.settings.unreadable', {
          values: {
            computer: status.remoteDevice,
            time: dateTime(status.remoteTime),
          },
        })}
      </p>
      <Button variant="outline" class="self-start" onclick={() => location.reload()}>
        {$_('plugins.backupFolder.settings.reload')}
      </Button>
    {:else if status.kind === 'error'}
      <p class="text-sm text-foreground">{$_('plugins.backupFolder.settings.failed')}</p>
      <Button
        variant="outline"
        class="self-start"
        disabled={busy}
        onclick={() => act(backupFolderStore.syncNow)}
      >
        {$_('plugins.backupFolder.settings.retry')}
      </Button>
    {/if}
  </div>
{/if}
