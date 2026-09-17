<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as RadioGroup from '$lib/components/ui/radio-group'
  import { Separator } from '$lib/components/ui/separator'
  import {
    DEMO_PERSONAS,
    DEMO_PLAN_ID,
    type DemoPersonaId,
    exitDemo,
    personaLabel,
    startDemo,
  } from '$lib/demo'
  import routes from '$lib/routes'
  import { appStore } from '$lib/stores/app.svelte'

  interface Props {
    open: boolean
  }

  let { open = $bindable() }: Props = $props()

  // Empty rather than undefined: the radio group's bound value has a fallback.
  let selected = $state('')
  const today = new Date()

  // Literal keys, so the locale checker can see them.
  const blurbs = $derived<Record<DemoPersonaId, string>>({
    tereza: $_('page.demo.personas.tereza'),
    peter: $_('page.demo.personas.peter'),
    claire: $_('page.demo.personas.claire'),
    jan: $_('page.demo.personas.jan'),
  })

  async function start(): Promise<void> {
    const persona = DEMO_PERSONAS.find((p) => p.id === selected)
    if (!persona) return
    startDemo(persona, today)
    open = false
    await goto(resolve(`${routes.PLAN_VIEW}/${DEMO_PLAN_ID}`))
  }

  async function startWithOwnData(): Promise<void> {
    if (appStore.demo) exitDemo()
    open = false
    await goto(resolve(routes.PROFILE))
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="gap-0 p-0 sm:max-w-[576px]">
    <Dialog.Header class="p-4 pr-14">
      <Dialog.Title class="text-base font-medium">{$_('page.demo.title')}</Dialog.Title>
    </Dialog.Header>
    <Separator />
    <div class="flex flex-col gap-4 p-4">
      <Dialog.Description class="text-base text-foreground">
        {$_('page.demo.description')}
      </Dialog.Description>
      <RadioGroup.Root bind:value={selected} class="grid gap-4 sm:grid-cols-2">
        {#each DEMO_PERSONAS as persona (persona.id)}
          <label
            class="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 has-[[data-state=checked]]:border-foreground/30 has-[[data-state=checked]]:bg-primary/5"
          >
            <RadioGroup.Item value={persona.id} class="mt-px" />
            <span class="flex flex-col gap-1.5 text-sm">
              <span class="leading-none font-medium">{personaLabel(persona, today)}</span>
              <span class="text-muted-foreground">{blurbs[persona.id]}</span>
            </span>
          </label>
        {/each}
      </RadioGroup.Root>
    </div>
    <Separator />
    <Dialog.Footer class="flex-row items-center justify-between bg-muted p-4 sm:justify-between">
      <Button size="sm" disabled={!selected} onclick={start}>{$_('page.demo.startDemo')}</Button>
      <Button size="sm" variant="outline" onclick={startWithOwnData}>
        {$_('page.demo.startWithOwnData')}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
