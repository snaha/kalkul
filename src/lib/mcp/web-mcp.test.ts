import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { appStore } from '$lib/stores/app.svelte'

import { kalkulTools } from './tools'
import { type ModelContext, type WebMcpTool, getModelContext, registerWebMcpTools } from './web-mcp'

class FakeModelContext implements ModelContext {
  tools = new Map<string, WebMcpTool>()
  registerTool(tool: WebMcpTool) {
    this.tools.set(tool.name, tool)
  }
  unregisterTool(name: string) {
    this.tools.delete(name)
  }
}

describe('registerWebMcpTools', () => {
  let ctx: FakeModelContext

  beforeEach(() => {
    const backing = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (backing.has(key) ? backing.get(key) : undefined),
      setItem: (key: string, value: string) => {
        backing.set(key, value)
      },
      removeItem: (key: string) => {
        backing.delete(key)
      },
    })
    appStore.importBackup(JSON.stringify({ profile: { name: 'Jane', email: '' }, portfolios: [] }))
    ctx = new FakeModelContext()
  })

  afterEach(() => {
    appStore.clear()
    vi.unstubAllGlobals()
  })

  it('registers every tool with a JSON Schema input and unregisters on cleanup', () => {
    const cleanup = registerWebMcpTools(ctx, kalkulTools(appStore))
    expect([...ctx.tools.keys()].sort()).toEqual([
      'add_portfolio',
      'delete_portfolio',
      'get_data',
      'get_projection',
      'update_portfolio',
      'update_profile',
    ])
    expect(ctx.tools.get('get_data')?.inputSchema).toEqual({ type: 'object', properties: {} })
    const del = ctx.tools.get('delete_portfolio')?.inputSchema
    expect(del?.type).toBe('object')
    expect(del?.required).toEqual(['id'])
    expect(del?.properties).toEqual({ id: { type: 'string' } })

    cleanup()
    expect(ctx.tools.size).toBe(0)
  })

  it('executes through the shared handlers with validation', async () => {
    registerWebMcpTools(ctx, kalkulTools(appStore))
    const result = await ctx.tools.get('update_profile')?.execute({ name: 'Robot' })
    expect(result).toEqual({
      content: [{ type: 'text', text: '{"name":"Robot","email":""}' }],
    })
    expect(appStore.profile.name).toBe('Robot')

    await expect(ctx.tools.get('update_profile')?.execute({ name: 5 })).rejects.toThrow()
  })
})

describe('getModelContext', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is undefined without the API', () => {
    vi.stubGlobal('document', {})
    vi.stubGlobal('navigator', {})
    expect(getModelContext()).toBeUndefined()
  })

  it('prefers document.modelContext over the deprecated navigator form', () => {
    const onDocument = new FakeModelContext()
    const onNavigator = new FakeModelContext()
    vi.stubGlobal('document', { modelContext: onDocument })
    vi.stubGlobal('navigator', { modelContext: onNavigator })
    expect(getModelContext()).toBe(onDocument)
    vi.stubGlobal('document', {})
    expect(getModelContext()).toBe(onNavigator)
  })
})
