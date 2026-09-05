import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { REPLACED_CLOSE_CODE, type SyncStatus, WsTransport } from './ws-transport'

class FakeWebSocket {
  static OPEN = 1
  static instances: FakeWebSocket[] = []
  readyState = 0
  sent: string[] = []
  closed = false
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onclose?: (event: { code: number }) => void

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  send(data: string) {
    this.sent.push(data)
  }

  close(code = 1000) {
    this.closed = true
    this.readyState = 3
    this.onclose?.({ code })
  }
}

describe('WsTransport', () => {
  let statuses: SyncStatus[]
  let transport: WsTransport

  beforeEach(() => {
    vi.useFakeTimers()
    FakeWebSocket.instances = []
    vi.stubGlobal('WebSocket', FakeWebSocket)
    statuses = []
    transport = new WsTransport('ws://localhost:3001/ws', (s) => statuses.push(s))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('reports connected on open and sends JSON', async () => {
    await transport.start()
    const socket = FakeWebSocket.instances[0]!
    expect(socket.url).toBe('ws://localhost:3001/ws')
    socket.open()
    expect(statuses).toEqual(['connected'])

    await transport.send({ jsonrpc: '2.0', id: 1, result: {} })
    expect(socket.sent).toEqual(['{"jsonrpc":"2.0","id":1,"result":{}}'])
  })

  it('rejects send while disconnected', async () => {
    await transport.start()
    await expect(transport.send({ jsonrpc: '2.0', id: 1, result: {} })).rejects.toThrow(
      'Not connected',
    )
  })

  it('parses incoming messages and reports invalid ones as errors', async () => {
    const received: unknown[] = []
    const errors: Error[] = []
    transport.onmessage = (m) => received.push(m)
    transport.onerror = (e) => errors.push(e)
    await transport.start()
    const socket = FakeWebSocket.instances[0]!

    socket.onmessage?.({ data: '{"jsonrpc":"2.0","id":7,"method":"tools/list"}' })
    socket.onmessage?.({ data: 'not json' })

    expect(received).toEqual([{ jsonrpc: '2.0', id: 7, method: 'tools/list' }])
    expect(errors.length).toBe(1)
  })

  it('reconnects 3 s after the socket closes', async () => {
    await transport.start()
    const first = FakeWebSocket.instances[0]!
    first.open()
    first.close()
    expect(statuses).toEqual(['connected', 'disconnected'])
    expect(FakeWebSocket.instances.length).toBe(1)

    vi.advanceTimersByTime(3000)
    expect(FakeWebSocket.instances.length).toBe(2)
  })

  it('does not reconnect when the relay replaced it with another tab', async () => {
    await transport.start()
    const socket = FakeWebSocket.instances[0]!
    socket.open()
    socket.close(REPLACED_CLOSE_CODE)
    expect(statuses).toEqual(['connected', 'replaced'])

    vi.advanceTimersByTime(10_000)
    expect(FakeWebSocket.instances.length).toBe(1)
  })

  it('close() stops reconnecting and closes the socket', async () => {
    const onclose = vi.fn()
    transport.onclose = onclose
    await transport.start()
    const socket = FakeWebSocket.instances[0]!

    await transport.close()
    expect(socket.closed).toBe(true)
    expect(onclose).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(10_000)
    expect(FakeWebSocket.instances.length).toBe(1)
  })
})
