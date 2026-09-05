import { z } from 'zod'

import { type KalkulTool, type ToolResult, kalkulTools } from './tools'

/** Tool shape of the W3C WebMCP `modelContext.registerTool()` API. */
export type WebMcpTool = {
  name: string
  description: string
  inputSchema: { type?: string; properties?: Record<string, unknown>; required?: string[] }
  execute: (args: Record<string, unknown>) => Promise<ToolResult>
}

export type ModelContext = {
  registerTool(tool: WebMcpTool): unknown
  unregisterTool(name: string): unknown
}

/**
 * The spec hangs the API off `document.modelContext`; Chrome 146–149 shipped
 * it as `navigator.modelContext` (deprecated in 150). Undefined when the
 * browser has neither, or during SSR.
 */
export function getModelContext(): ModelContext | undefined {
  if (typeof document === 'undefined') return undefined
  const doc = document as Document & { modelContext?: ModelContext }
  const nav = navigator as Navigator & { modelContext?: ModelContext }
  return doc.modelContext ?? nav.modelContext
}

export function toWebMcpTool(tool: KalkulTool): WebMcpTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema
      ? z.toJSONSchema(tool.inputSchema)
      : { type: 'object', properties: {} },
    execute: async (args) => tool.execute(args),
  }
}

/** Registers the Kalkul tools with the browser; returns the cleanup that unregisters them. */
export function registerWebMcpTools(ctx: ModelContext, tools = kalkulTools()): () => void {
  for (const t of tools) ctx.registerTool(toWebMcpTool(t))
  return () => {
    for (const t of tools) ctx.unregisterTool(t.name)
  }
}
