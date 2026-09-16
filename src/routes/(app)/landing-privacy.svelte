<script lang="ts">
  import { _ } from 'svelte-i18n'

  import Code from '@lucide/svelte/icons/code'
  import Download from '@lucide/svelte/icons/download'
  import Monitor from '@lucide/svelte/icons/monitor'

  import { Badge } from '$lib/components/ui/badge'
  import * as Card from '$lib/components/ui/card'
  import { Separator } from '$lib/components/ui/separator'

  const items = $derived([
    {
      id: 'stored',
      icon: Monitor,
      title: $_('page.landing.privacy.storedTitle'),
      description: $_('page.landing.privacy.storedDescription'),
    },
    {
      id: 'backup',
      icon: Download,
      title: $_('page.landing.privacy.backupTitle'),
      description: $_('page.landing.privacy.backupDescription'),
    },
    {
      id: 'openSource',
      icon: Code,
      title: $_('page.landing.privacy.openSourceTitle'),
      description: $_('page.landing.privacy.openSourceDescription'),
    },
  ])
</script>

<div class="grid items-start gap-8 md:grid-cols-2">
  <div class="flex max-w-2xl flex-col gap-2">
    <h2 class="text-2xl font-bold">{$_('page.landing.privacy.title')}</h2>
    <p class="text-muted-foreground">{$_('page.landing.privacy.description')}</p>
  </div>

  <ul class="m-0 flex list-none flex-col gap-4 p-0">
    {#each items as item, index (item.id)}
      {@const Icon = item.icon}
      {#if index > 0}
        <Separator />
      {/if}
      <li class="flex gap-3">
        <Icon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div class="flex flex-col gap-1">
          <p class="text-sm font-bold">{item.title}</p>
          <p class="text-sm text-muted-foreground">{item.description}</p>
        </div>
      </li>
    {/each}
  </ul>
</div>

<Card.Root class="mt-12 gap-0 border-dashed py-0 shadow-none">
  <Card.Content class="flex flex-col gap-3 p-6 sm:flex-row sm:items-start sm:gap-4">
    <Badge variant="outline">{$_('page.landing.planned.tag')}</Badge>
    <p class="max-w-3xl text-sm text-muted-foreground">
      <span class="font-bold text-foreground">{$_('page.landing.planned.title')}</span>
      {$_('page.landing.planned.description')}
    </p>
  </Card.Content>
</Card.Root>
