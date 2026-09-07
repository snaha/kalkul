import { z } from 'zod'

import { getYearlyPlanProjection } from '$lib/plan-projection'
import { portfolioSchema, profileSchema } from '$lib/schemas'
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
        "The user's profile (cash, assets, liabilities, cash flows) and portfolios (plans)",
      inputSchema: undefined,
      annotations: READ_ONLY,
      execute: () => text(JSON.parse(app.exportBackup())),
    },
    tool(
      'update_profile',
      'Merge the given fields into the profile',
      profileSchema.partial(),
      WRITE,
      (args) => {
        app.updateProfile(args)
        return text(app.profile.toJSON())
      },
    ),
    tool(
      'add_portfolio',
      'Create a portfolio (plan); returns its id',
      portfolioSchema.omit({ id: true }),
      WRITE,
      (args) => text({ id: app.addPortfolio(args) }),
    ),
    tool(
      'update_portfolio',
      'Merge the given fields into the portfolio with this id',
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
