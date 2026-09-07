import { Client } from '@modelcontextprotocol/sdk/client'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import storageKeys from '$lib/storage-keys'
import { appStore } from '$lib/stores/app.svelte'

import { createKalkulMcpServer } from './server'

type ToolResult = { content: { type: string; text?: string }[]; isError?: boolean }

const PORTFOLIO = {
  id: 'p1',
  name: 'Retire early',
  start_date: '2026-01-01',
  end_date: '2028-12-31',
  inflation_rate: 2,
}

describe('createKalkulMcpServer', () => {
  let backing: Map<string, string>
  let client: Client

  async function call(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    return (await client.callTool({ name, arguments: args })) as ToolResult
  }

  function json(result: ToolResult): unknown {
    return JSON.parse(result.content[0]?.text ?? 'null')
  }

  beforeEach(async () => {
    backing = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (backing.has(key) ? backing.get(key) : undefined),
      setItem: (key: string, value: string) => {
        backing.set(key, value)
      },
      removeItem: (key: string) => {
        backing.delete(key)
      },
    })
    appStore.importBackup(
      JSON.stringify({ profile: { name: 'Jane', email: '' }, portfolios: [PORTFOLIO] }),
    )

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await createKalkulMcpServer().connect(serverTransport)
    client = new Client({ name: 'test', version: '0' })
    await client.connect(clientTransport)
  })

  afterEach(async () => {
    await client.close()
    appStore.clear()
    vi.unstubAllGlobals()
  })

  it('lists the six tools', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_portfolio',
      'delete_portfolio',
      'get_data',
      'get_projection',
      'update_portfolio',
      'update_profile',
    ])
  })

  it('get_data returns the profile and portfolios', async () => {
    expect(json(await call('get_data'))).toEqual({
      profile: { name: 'Jane', email: '' },
      portfolios: [PORTFOLIO],
    })
  })

  it('update_profile changes the store and localStorage', async () => {
    const result = await call('update_profile', { name: 'Test' })
    expect(result.isError).toBeUndefined()
    expect(appStore.profile.name).toBe('Test')
    expect(JSON.parse(backing.get(storageKeys.DATA) ?? '{}').profile.name).toBe('Test')
  })

  it('update_profile rejects invalid input', async () => {
    const result = await call('update_profile', { name: 123 })
    expect(result.isError).toBe(true)
    expect(appStore.profile.name).toBe('Jane')
  })

  it('add_portfolio returns an id that is in the store', async () => {
    const { id } = json(
      await call('add_portfolio', { ...PORTFOLIO, id: undefined, name: 'New' }),
    ) as {
      id: string
    }
    expect(appStore.portfolios.map((p) => p.id)).toContain(id)
    expect(appStore.portfolios.find((p) => p.id === id)?.name).toBe('New')
  })

  it('update_portfolio updates by id and errors on unknown id', async () => {
    await call('update_portfolio', { id: 'p1', name: 'Renamed' })
    expect(appStore.portfolios[0]?.name).toBe('Renamed')

    const result = await call('update_portfolio', { id: 'nope', name: 'x' })
    expect(result.isError).toBe(true)
  })

  it('delete_portfolio removes by id and errors on unknown id', async () => {
    expect((await call('delete_portfolio', { id: 'nope' })).isError).toBe(true)
    await call('delete_portfolio', { id: 'p1' })
    expect(appStore.portfolios).toEqual([])
  })

  it('get_projection returns yearly rows', async () => {
    const rows = json(await call('get_projection', { portfolio_id: 'p1' })) as { year: number }[]
    expect(rows.length).toBe(3)
    expect(rows[0]?.year).toBe(2026)
  })
})
