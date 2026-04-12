<script lang="ts">
  import { _ } from 'svelte-i18n'

  import { Monitor, Moon, Sun } from '@lucide/svelte'

  import { Button } from '$lib/components/ui/button'
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu'

  type Theme = 'light' | 'dark' | 'system'

  interface Props {
    class?: string
  }

  let { class: className }: Props = $props()

  let theme = $state<Theme>('system')

  function getSystemDark(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function applyTheme(t: Theme) {
    const isDark = t === 'dark' || (t === 'system' && getSystemDark())
    document.documentElement.classList.toggle('dark', isDark)
  }

  function setTheme(t: Theme) {
    theme = t
    localStorage.setItem('theme', t)
    applyTheme(t)
  }

  $effect(() => {
    const stored = localStorage.getItem('theme') as Theme | undefined
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      theme = stored
    } else {
      theme = 'system'
    }
    applyTheme(theme)

    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  })
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button variant="ghost" size="icon" class={className} {...props}>
        {#if theme === 'light'}
          <Sun class="size-4" />
        {:else if theme === 'dark'}
          <Moon class="size-4" />
        {:else}
          <Monitor class="size-4" />
        {/if}
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    <DropdownMenu.RadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
      <DropdownMenu.RadioItem value="light">
        <Sun class="size-4" />
        {$_('theme.light')}
      </DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="dark">
        <Moon class="size-4" />
        {$_('theme.dark')}
      </DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="system">
        <Monitor class="size-4" />
        {$_('theme.system')}
      </DropdownMenu.RadioItem>
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>
