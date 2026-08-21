<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Copy from '@lucide/svelte/icons/copy'
  import Ellipsis from '@lucide/svelte/icons/ellipsis'
  import SquarePen from '@lucide/svelte/icons/square-pen'
  import Trash2 from '@lucide/svelte/icons/trash-2'

  import { Button } from '$lib/components/ui/button'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'
  import * as Table from '$lib/components/ui/table'
  import type { SnapshotRow } from '$lib/snapshot-rows'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    rows: SnapshotRow[]
    onEdit: (date: string) => void
    onDuplicate: (date: string) => void
    onDelete: (date: string) => void
  }

  let { rows, onEdit, onDuplicate, onDelete }: Props = $props()
</script>

<Table.Root>
  <Table.Header>
    <Table.Row>
      <Table.Head>{$_('page.history.table.date')}</Table.Head>
      <Table.Head class="text-right">{$_('page.history.table.totalAssets')}</Table.Head>
      <Table.Head class="text-right">{$_('page.history.table.liabilities')}</Table.Head>
      <Table.Head class="text-right">{$_('page.history.table.netWorth')}</Table.Head>
      <Table.Head class="text-right">{$_('page.history.table.fi')}</Table.Head>
      <Table.Head class="w-10">
        <span class="sr-only">{$_('page.history.table.actions')}</span>
      </Table.Head>
    </Table.Row>
  </Table.Header>
  <Table.Body>
    {#each rows as row (row.date)}
      <Table.Row>
        <Table.Cell class="font-medium">{appStore.formatDateOnly(row.date)}</Table.Cell>
        <Table.Cell class="text-right tabular-nums">
          {appStore.formatNumber(Math.round(row.totalAssets))}
        </Table.Cell>
        <Table.Cell class="text-right tabular-nums">
          {appStore.formatNumber(Math.round(row.liabilities))}
        </Table.Cell>
        <Table.Cell class="text-right tabular-nums">
          {appStore.formatNumber(Math.round(row.netWorth))}
        </Table.Cell>
        <Table.Cell class="text-right tabular-nums">
          {row.fiPercent === undefined ? '—' : appStore.formatPercent(row.fiPercent, 0)}
        </Table.Cell>
        <Table.Cell class="p-0 text-right">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  variant="ghost"
                  size="icon"
                  {...props}
                  aria-label={$_('page.history.table.rowActions', {
                    values: { date: appStore.formatDateOnly(row.date) },
                  })}
                >
                  <Ellipsis class="size-4" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end">
              <DropdownMenu.Item onclick={() => onEdit(row.date)}>
                <SquarePen class="size-4" />
                {$_('page.history.row.edit')}
              </DropdownMenu.Item>
              <DropdownMenu.Item onclick={() => onDuplicate(row.date)}>
                <Copy class="size-4" />
                {$_('page.history.row.duplicate')}
              </DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item class="text-destructive" onclick={() => onDelete(row.date)}>
                <Trash2 class="size-4" />
                {$_('page.history.row.delete')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>
