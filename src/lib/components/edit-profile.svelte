<script lang="ts">
  import { appStore } from '$lib/stores/app.svelte'
  import { Close } from 'carbon-icons-svelte'
  import { _ } from 'svelte-i18n'
  import Button from '$lib/components/ui/button.svelte'
  import LocalizedDateInput from '$lib/components/localized-date-input.svelte'
  import Input from '$lib/components/ui/input/input.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import ErrorComp from './error.svelte'
  import type { z, ZodFormattedError } from 'zod'
  import { emailFormSchema } from '$lib/schemas'
  import Vertical from './ui/vertical.svelte'
  import Horizontal from './ui/horizontal.svelte'
  import ResponsiveLayout from './ui/responsive-layout.svelte'
  import { layoutStore } from '$lib/stores/layout.svelte'
  import LoaderButton from './loader-button.svelte'

  type Props = {
    close?: () => void
  }

  let { close }: Props = $props()

  const date = new Date()
  let name = $state(appStore.profile.name)
  let birthDate: Date | undefined = $state(
    appStore.profile.birth_date ? new Date(appStore.profile.birth_date) : undefined,
  )
  let email = $state(appStore.profile.email)
  let error: string | undefined = $state()
  let emailError: ZodFormattedError<z.infer<typeof emailFormSchema>> | undefined = $state()
  let emailValid = $state(true)
  let emailTouched = $state(false)
  const saveDisabled = $derived(name === '' || !birthDate || birthDate > date || !emailValid)

  function save() {
    error = undefined
    if (!birthDate) {
      error = $_('error.birthDateUndefined')
      return
    }

    try {
      appStore.updateProfile({
        name,
        birth_date: birthDate.toDateString(),
        email,
      })
      close?.()
    } catch (e) {
      error = (e as Error).message
    }
  }

  function cancel(event: Event) {
    event.preventDefault()
    close?.()
  }

  function validateEmailAddress() {
    if (email !== '') {
      const res = emailFormSchema.safeParse({ email })
      if (res.success) {
        emailError = undefined
        emailValid = true
        emailTouched = false
      } else {
        emailError = res.error.format()
        emailValid = false
      }
    }
  }
</script>

{#snippet birthDateError()}
  {$_('error.birthDateError')}
{/snippet}

{#snippet emailErrorSnippet()}
  {$_('error.emailError')}
{/snippet}

<Vertical class="max-width560">
  <Horizontal>
    <Typography variant="h4">{$_('page.profile.editProfile')}</Typography>
    {#if close}
      <div class="grower"></div>
      <Button variant="ghost" dimension="compact" onclick={close}><Close size={20} /></Button>
    {/if}
  </Horizontal>
  <div class="spacer"></div>
  <Input
    autofocus={!layoutStore.mobile}
    variant="solid"
    dimension="compact"
    placeholder={$_('page.profile.profileName')}
    label={$_('common.name')}
    bind:value={name}
  ></Input>
  <LocalizedDateInput
    variant="solid"
    dimension="compact"
    yearPlaceholder="1990"
    monthPlaceholder="01"
    dayPlaceholder="01"
    label={$_('common.birthDate')}
    bind:value={birthDate}
    error={birthDate && birthDate > date ? birthDateError : undefined}
  />
  <Input
    variant="solid"
    dimension="compact"
    placeholder={$_('common.emailOptional')}
    label={$_('common.email')}
    bind:value={email}
    error={emailTouched && email.trim() !== '' && emailError?.email?._errors
      ? emailErrorSnippet
      : undefined}
    oninput={() => (emailTouched = true)}
    onblur={validateEmailAddress}>{$_('page.profile.profileEmailExplanation')}</Input
  >
  {#if error}
    <ErrorComp>{error}</ErrorComp>
  {:else}
    <div class="spacer"></div>
  {/if}
  <ResponsiveLayout --responsive-justify-content="stretch">
    <LoaderButton variant="strong" dimension="compact" onclick={save} disabled={saveDisabled}>
      {$_('common.saveChanges')}
    </LoaderButton>
    {#if close}
      <Button variant="ghost" dimension="compact" onclick={cancel}>{$_('common.cancel')}</Button>
    {/if}
  </ResponsiveLayout>
</Vertical>

<style>
  .grower {
    flex: 1;
  }
  :global(.max-width560) {
    max-width: 560px;
    width: 100%;
  }
  .spacer {
    margin-top: var(--half-padding);
  }
</style>
