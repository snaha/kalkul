<script lang="ts">
  import { _ } from 'svelte-i18n'
  import ContentLayout from '$lib/components/content-layout.svelte'
  import Horizontal from '$lib/components/ui/horizontal.svelte'
  import Typography from '$lib/components/ui/typography.svelte'
  import Button from '$lib/components/ui/button.svelte'
  import { Close } from 'carbon-icons-svelte'
  import GoalCarousel from '$lib/components/goal-carousel.svelte'
  import { goto } from '$app/navigation'
  import routes from '$lib/routes'
  import { page } from '$app/state'

  const portfolioId = $derived(page.params.portfolio_id)
</script>

<ContentLayout centered={false}>
  <Horizontal --horizontal-justify-content="space-between">
    <Typography variant="h4">{$_('page.goals.new.title')}</Typography>
    <Button variant="ghost" dimension="compact" onclick={() => history.back()}>
      <Close size={20} />
    </Button>
  </Horizontal>
  <Horizontal>
    <Typography>{$_('page.goals.new.subtitle')}</Typography>
  </Horizontal>
</ContentLayout>

<div class="carousel-container">
  <GoalCarousel
    onSelect={(calculator) => {
      switch (calculator) {
        case 'retirement':
          return goto(routes.RETIREMENT_GOAL_CALCULATOR(portfolioId))
        case 'kid-education':
          return goto(routes.KID_EDUCATION_GOAL_CALCULATOR(portfolioId))
      }
    }}
  ></GoalCarousel>
</div>

<style>
  .carousel-container {
    width: 100%;
    display: flex;
    justify-content: center;
    overflow-x: auto;
    padding: 0;
  }

  @media screen and (max-width: 1023px) {
    .carousel-container {
      padding: var(--padding) 0;
    }
  }
</style>
