import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { getYearlyPlanProjection } from '$lib/plan-projection'
import { portfolioSchema, profileSchema } from '$lib/schemas'
import { appStore } from '$lib/stores/app.svelte'

type App = typeof appStore

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] }
}

function findPortfolio(app: App, id: string) {
  const portfolio = app.portfolios.find((p) => p.id === id)
  if (!portfolio) throw new Error(`Unknown portfolio id: ${id}`)
  return portfolio
}

/**
 * MCP server that runs inside the browser tab and operates directly on the
 * app store, so every write goes through the same validation and persistence
 * as the UI. The local relay (server/index.ts) only forwards JSON-RPC.
 */
export function createKalkulMcpServer(app: App = appStore): McpServer {
  const server = new McpServer({ name: 'kalkul', version: '1.0.0' })

  server.registerTool(
    'get_data',
    {
      description:
        "The user's profile (cash, assets, liabilities, cash flows) and portfolios (plans)",
    },
    () => text(JSON.parse(app.exportBackup())),
  )

  server.registerTool(
    'update_profile',
    {
      description: 'Merge the given fields into the profile',
      inputSchema: profileSchema.partial(),
    },
    (args) => {
      app.updateProfile(args)
      return text(app.profile.toJSON())
    },
  )

  server.registerTool(
    'add_portfolio',
    {
      description: 'Create a portfolio (plan); returns its id',
      inputSchema: portfolioSchema.omit({ id: true }),
    },
    (args) => text({ id: app.addPortfolio(args) }),
  )

  server.registerTool(
    'update_portfolio',
    {
      description: 'Merge the given fields into the portfolio with this id',
      inputSchema: portfolioSchema.partial().required({ id: true }),
    },
    ({ id, ...updates }) => {
      const portfolio = findPortfolio(app, id)
      portfolio.update(updates)
      return text(portfolio.toJSON())
    },
  )

  server.registerTool(
    'delete_portfolio',
    { description: 'Delete the portfolio with this id', inputSchema: { id: z.string() } },
    ({ id }) => {
      findPortfolio(app, id).delete()
      return text({ ok: true })
    },
  )

  server.registerTool(
    'get_projection',
    {
      description:
        'Yearly projection of a portfolio computed by the app (net worth, cash, investments, ...)',
      inputSchema: { portfolio_id: z.string() },
    },
    ({ portfolio_id }) =>
      text(
        getYearlyPlanProjection(findPortfolio(app, portfolio_id).toJSON(), app.profile.toJSON()),
      ),
  )

  return server
}
