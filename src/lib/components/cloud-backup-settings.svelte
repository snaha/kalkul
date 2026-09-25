<script lang="ts">
  import { _ } from 'svelte-i18n'

  import FolderSync from '@lucide/svelte/icons/folder-sync'

  import BackupComputerNameDialog from '$lib/components/backup-computer-name-dialog.svelte'
  import { Button } from '$lib/components/ui/button'
  import { appStore } from '$lib/stores/app.svelte'
  import { cloudBackupStore } from '$lib/stores/cloud-backup.svelte'

  const status = $derived(cloudBackupStore.status)

  let busy = $state(false)
  let nameDialogOpen = $state(false)
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
      alert($_('page.settings.cloudBackup.error'))
    } finally {
      busy = false
    }
  }

  function connect(): Promise<void> {
    return act(async () => {
      if (!(await cloudBackupStore.beginConnect())) return
      // Choosing the folder again keeps this computer's name: nothing to ask.
      if (cloudBackupStore.connection) await cloudBackupStore.finishConnect(undefined)
      else nameDialogOpen = true
    })
  }
</script>

{#if !cloudBackupStore.supported}
  <p class="text-sm font-medium text-muted-foreground">
    {$_('page.settings.cloudBackup.unsupported')}
  </p>
{:else if status.kind === 'disconnected'}
  <div class="flex items-start gap-4">
    <Button variant="outline" class="w-44" disabled={busy} onclick={connect}>
      <FolderSync class="size-4" />
      {$_('page.settings.cloudBackup.chooseFolder')}
    </Button>
    <p class="flex-1 text-sm font-medium text-muted-foreground">
      {$_('page.settings.cloudBackup.chooseFolderDescription')}
    </p>
  </div>
{:else}
  <div class="flex items-start gap-4">
    <Button
      variant="outline"
      class="w-44"
      disabled={busy}
      onclick={() => act(cloudBackupStore.disconnect)}
    >
      {$_('page.settings.cloudBackup.disconnect')}
    </Button>
    <p class="flex-1 text-sm font-medium text-muted-foreground">
      {#if cloudBackupStore.connection}
        {$_('page.settings.cloudBackup.connectedTo', {
          values: {
            folder: cloudBackupStore.connection.folder,
            computer: cloudBackupStore.connection.device,
          },
        })}
      {/if}
      {$_('page.settings.cloudBackup.disconnectDescription')}
    </p>
  </div>

  <div class="flex flex-col gap-3 rounded-md border p-4" role="status">
    {#if status.kind === 'syncing'}
      <p class="text-sm text-foreground">{$_('page.settings.cloudBackup.syncing')}</p>
    {:else if status.kind === 'synced'}
      <p class="text-sm text-foreground">
        {cloudBackupStore.lastSyncedAt
          ? $_('page.settings.cloudBackup.syncedAt', {
              values: { time: appStore.formatDateTime(cloudBackupStore.lastSyncedAt) },
            })
          : $_('page.settings.cloudBackup.connected')}
      </p>
    {:else if status.kind === 'held'}
      <p class="text-sm text-foreground">
        {$_('page.settings.cloudBackup.held', {
          values: {
            computer: status.remoteDevice,
            time: appStore.formatDateTime(status.remoteTime),
          },
        })}
      </p>
    {:else if status.kind === 'folder-missing'}
      <p class="text-sm text-foreground">
        {$_('page.settings.cloudBackup.folderMissing', {
          values: { folder: cloudBackupStore.connection?.folder ?? '' },
        })}
      </p>
      <Button class="self-start" disabled={busy} onclick={connect}>
        <FolderSync class="size-4" />
        {$_('page.settings.cloudBackup.chooseFolderAgain')}
      </Button>
    {:else if status.kind === 'needs-permission'}
      <p class="text-sm text-foreground">{$_('page.settings.cloudBackup.needsPermission')}</p>
      <Button class="self-start" disabled={busy} onclick={() => act(cloudBackupStore.allowAccess)}>
        {$_('page.settings.cloudBackup.allowAccess')}
      </Button>
    {:else if status.kind === 'conflict'}
      <p class="text-sm text-foreground">
        {$_('page.settings.cloudBackup.conflict', {
          values: {
            computer: status.remoteDevice,
            time: appStore.formatDateTime(status.remoteTime),
          },
        })}
      </p>
      {#if confirmingReplace}
        <p class="text-sm font-bold text-foreground">
          {$_('page.settings.cloudBackup.replaceWarning')}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            disabled={busy}
            onclick={() => act(() => cloudBackupStore.resolve('remote'))}
          >
            {$_('page.settings.cloudBackup.replaceConfirm')}
          </Button>
          <Button variant="outline" disabled={busy} onclick={() => (confirmingReplace = false)}>
            {$_('page.settings.cloudBackup.cancel')}
          </Button>
        </div>
      {:else}
        <div class="flex flex-wrap gap-2">
          <Button disabled={busy} onclick={() => act(() => cloudBackupStore.resolve('local'))}>
            {$_('page.settings.cloudBackup.keepLocal')}
          </Button>
          <Button variant="outline" disabled={busy} onclick={() => (confirmingReplace = true)}>
            {$_('page.settings.cloudBackup.useRemote')}
          </Button>
        </div>
      {/if}
    {:else if status.kind === 'error'}
      <p class="text-sm text-foreground">{$_('page.settings.cloudBackup.failed')}</p>
      <Button
        variant="outline"
        class="self-start"
        disabled={busy}
        onclick={() => act(cloudBackupStore.syncNow)}
      >
        {$_('page.settings.cloudBackup.retry')}
      </Button>
    {/if}
  </div>
{/if}

<BackupComputerNameDialog
  bind:open={nameDialogOpen}
  onSubmit={(computerName) => cloudBackupStore.finishConnect(computerName)}
  onCancel={cloudBackupStore.cancelConnect}
/>
