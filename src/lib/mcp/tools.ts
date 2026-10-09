import { z } from 'zod'

import { PLAN_LIST_KEYS, planListConfig, removePlanItem, upsertPlanItem } from '$lib/plan-items'
import { getYearlyPlanProjection } from '$lib/plan-projection'
import {
  expenseSchema,
  incomeSchema,
  portfolioSchema,
  profileInvestmentSchema,
  profileLiabilitySchema,
  profileSchema,
  profileTangibleAssetSchema,
  transferSchema,
} from '$lib/schemas'
import { appStore } from '$lib/stores/app.svelte'

type App = typeof appStore

export type ToolResult = { content: { type: 'text'; text: string }[] }

/**
 * MCP tool annotations, a hint to clients (relay agents and WebMCP browser
 * agents alike) about what a tool does before they call it. A browser agent
 * acts on page content, so prompt-injection risk is higher here; a
 * `destructiveHint` at least lets a well-behaved agent ask first.
 */
export type ToolAnnotations = { readOnlyHint?: boolean; destructiveHint?: boolean }

const READ_ONLY: ToolAnnotations = { readOnlyHint: true }
const WRITE: ToolAnnotations = { readOnlyHint: false }
const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true }

/**
 * A tool definition shared by both surfaces: the in-browser MCP server
 * (src/lib/mcp/server.ts, reached through the local relay) and WebMCP
 * (src/lib/mcp/web-mcp.ts, reached by agents running in the browser).
 * `execute` validates its input with `inputSchema` itself, so each surface
 * only has to forward raw arguments.
 */
export type KalkulTool = {
  name: string
  description: string
  inputSchema: z.ZodObject | undefined
  annotations: ToolAnnotations
  execute: (args: Record<string, unknown>) => ToolResult
}

function text(value: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] }
}

function findPortfolio(app: App, id: string) {
  const portfolio = app.portfolios.find((p) => p.id === id)
  if (!portfolio) throw new Error(`Unknown portfolio id: ${id}`)
  return portfolio
}

// The item schema for each plan list, to validate an upsert_plan_item payload
// against the list it is meant for (the input schema can only say "one of").
const LIST_ITEM_SCHEMAS = {
  investments: profileInvestmentSchema,
  tangible_assets: profileTangibleAssetSchema,
  liabilities: profileLiabilitySchema,
  incomes: incomeSchema,
  expenses: expenseSchema,
  transfers: transferSchema,
}

const planListInput = {
  portfolio_id: z.string(),
  list: z.enum(PLAN_LIST_KEYS),
}

function tool<S extends z.ZodObject>(
  name: string,
  description: string,
  inputSchema: S,
  annotations: ToolAnnotations,
  execute: (args: z.output<S>) => ToolResult,
): KalkulTool {
  return {
    name,
    description,
    inputSchema,
    annotations,
    execute: (args) => execute(inputSchema.parse(args)),
  }
}

export function kalkulTools(app: App = appStore): KalkulTool[] {
  return [
    {
      name: 'get_data',
      description:
        "The user's profile (financial data: what they have today, shared by every plan) and portfolios (plans, each carrying its own changes on top of it)",
      inputSchema: undefined,
      annotations: READ_ONLY,
      execute: () => text(JSON.parse(app.exportBackup())),
    },
    tool(
      'update_profile',
      "Merge the given fields into the profile, which is the user's financial data: what they have today, shared by every plan. Array fields (investments, tangible_assets, liabilities, incomes, expenses, transfers) replace the whole list, so fetch, edit and write back the full array. Never use this while working on a plan: use upsert_plan_item and remove_plan_item, which change that plan only. Incomes and expenses carry a schedule: one_time items need transaction_year and transaction_month, recurring items need frequency, start, end and change_over_time.",
      profileSchema.partial(),
      WRITE,
      (args) => {
        app.updateProfile(args)
        return text(app.profile.toJSON())
      },
    ),
    tool(
      'add_portfolio',
      'Create a portfolio (plan): a scenario computed from the profile. Its included_*_ids pick which profile items take part (unset = all). Returns its id',
      portfolioSchema.omit({ id: true }),
      WRITE,
      (args) => text({ id: app.addPortfolio(args) }),
    ),
    tool(
      'update_portfolio',
      "Merge the given fields into the portfolio with this id: name, notes, dates, inflation_rate, included_*_ids, and cash_amount (the cash the plan opens with; unset = the profile's). For the plan's items prefer upsert_plan_item and remove_plan_item.",
      portfolioSchema.partial().required({ id: true }),
      WRITE,
      ({ id, ...updates }) => {
        const portfolio = findPortfolio(app, id)
        portfolio.update(updates)
        return text(portfolio.toJSON())
      },
    ),
    tool(
      'delete_portfolio',
      'Delete the portfolio with this id',
      z.object({ id: z.string() }),
      DESTRUCTIVE,
      ({ id }) => {
        findPortfolio(app, id).delete()
        return text({ ok: true })
      },
    ),
    tool(
      'upsert_plan_item',
      'Add or change an item in a plan. The change lands on the plan only: an item with the id of a profile item overrides it for this plan, any other id is an item the plan alone has. Use this, never update_profile, for whatever is changed while working on a plan. Returns the portfolio.',
      z.object({
        ...planListInput,
        item: z.union(Object.values(LIST_ITEM_SCHEMAS)),
      }),
      WRITE,
      ({ portfolio_id, list, item }) => {
        const portfolio = findPortfolio(app, portfolio_id)
        const parsed = LIST_ITEM_SCHEMAS[list].parse(item)
        upsertPlanItem(planListConfig(list), parsed, portfolio, app.profile)
        return text(portfolio.toJSON())
      },
    ),
    tool(
      'remove_plan_item',
      "Take an item out of a plan: the plan's own item is deleted, a profile item is excluded from this plan. Financial data is never changed. Returns the portfolio.",
      z.object({ ...planListInput, id: z.string() }),
      DESTRUCTIVE,
      ({ portfolio_id, list, id }) => {
        const portfolio = findPortfolio(app, portfolio_id)
        removePlanItem(planListConfig(list), id, portfolio, app.profile)
        return text(portfolio.toJSON())
      },
    ),
    tool(
      'get_projection',
      'Yearly projection of a portfolio computed by the app (net worth, cash, investments, ...)',
      z.object({ portfolio_id: z.string() }),
      READ_ONLY,
      ({ portfolio_id }) =>
        text(
          getYearlyPlanProjection(findPortfolio(app, portfolio_id).toJSON(), app.profile.toJSON()),
        ),
    ),
  ]
}
