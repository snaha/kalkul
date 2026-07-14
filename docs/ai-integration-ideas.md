# AI Integration Ideas for Kalkul

_Exploration of approaches for AI-assisted financial planning in a local-first architecture_

## Overview

Kalkul-next is a local-first SPA that stores all data in the browser's localStorage. This document explores various approaches for integrating AI assistants to help users with financial planning while respecting the local-first architecture.

### Key Insight

The AI doesn't need to perform financial calculations - the JavaScript projection engine (`src/lib/plan-projection.ts`) handles that with full Decimal.js precision. The AI's role is to:

1. **Read** - Access portfolio data and calculation results
2. **Reason** - Understand user goals, compare scenarios, identify issues
3. **Suggest** - Propose changes with projected outcomes
4. **Apply** (with approval) - Make changes when user confirms

This separation is powerful: AI handles reasoning and advice, JavaScript handles precision math.

### Design Goals

- **Privacy-first**: Data can stay in the browser
- **All browsers**: Firefox support required (rules out some Web APIs)
- **Suggest with preview**: AI proposes changes, user approves before applying
- **Full planning assistant**: Scenario comparison, goal optimization, portfolio health checks

---

## Technical Approaches

### Approach 1: WebSocket Bridge

**Architecture**:

```
┌─────────────────────────────────┐
│         Browser (any)           │
│  ┌───────────────────────────┐  │
│  │    Kalkul App             │  │
│  │    - localStorage data    │  │
│  │    - Proposal preview UI  │  │
│  │    - WebSocket client     │  │
│  └───────────┬───────────────┘  │
└──────────────┼──────────────────┘
               │ WebSocket (ws://localhost:3001)
               │
┌──────────────┼──────────────────┐
│  MCP Server (Node.js)           │
│  ┌───────────┴───────────────┐  │
│  │  - WebSocket server       │  │
│  │  - projection engine      │  │
│  │  - MCP protocol handler   │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
               │
        AI Agent (Claude Code, etc.)
```

**How it works**:

1. User opens kalkul-next, app connects to local WebSocket server
2. AI (via MCP) sends requests through WebSocket
3. App responds with current data
4. MCP server runs calculations using shared calculation library
5. AI generates proposal, sends back through WebSocket
6. App displays proposal preview UI
7. User reviews and approves/modifies

**Pros**:

- Works in all browsers
- Real-time bidirectional communication
- Browser uses its own calculations or server can calculate
- Secure (localhost only)

**Cons**:

- Requires running local server
- User must start the server before using AI features

---

### Approach 2: File System Sync

**Architecture**:

```
Browser                    File System              MCP Server
┌───────────┐             ┌───────────┐            ┌───────────┐
│ Kalkul    │◄──────────► │ JSON file │◄──────────►│ MCP tools │
│ (OPFS or  │   sync      │           │   watch    │ + calcs   │
│ FS Access)│             └───────────┘            └───────────┘
└───────────┘
```

**How it works**:

- App saves data to a JSON file (using File System Access API or Origin Private File System)
- MCP server watches the file for changes
- MCP server can write proposals back to file
- App detects file changes and offers to load

**Pros**:

- Simpler than WebSocket (no persistent connection)
- File serves as clear data exchange format
- Offline-capable

**Cons**:

- File System Access API not supported in Firefox
- OPFS is sandboxed (external tools can't access)
- Polling or manual refresh needed

---

### Approach 3: CRDT-Based Sync

**Libraries**: Yjs, Automerge, Liveblocks, PartyKit

**Architecture**:

```
Browser                    Sync Server              MCP Server
┌───────────┐             ┌───────────┐            ┌───────────┐
│ localStorage │◄────────►│ CRDT Doc  │◄──────────►│ CRDT Doc  │
│ + CRDT     │   sync     │           │    sync    │ + MCP     │
└───────────┘             └───────────┘            └───────────┘
```

**How it works**:

- Data stored as CRDT document (conflict-free replicated data type)
- Changes automatically sync between all connected clients
- MCP server is just another "client" that can read and write

**Pros**:

- True real-time collaboration
- Conflict resolution built-in
- Offline-first with automatic sync
- Works in all browsers

**Cons**:

- Adds complexity to data model
- Requires sync server (though can be serverless)
- Learning curve for CRDTs

---

### Approach 4: Browser Extension Bridge

**Architecture**:

```
┌────────────────────────────────────────┐
│              Browser                   │
│  ┌──────────────┐   ┌───────────────┐  │
│  │   Kalkul     │◄─►│   Extension   │  │
│  │   App        │   │   (injects)   │  │
│  └──────────────┘   └───────┬───────┘  │
└─────────────────────────────┼──────────┘
                              │ Native Messaging
                              │
                      ┌───────┴───────┐
                      │  Native Host  │
                      │  (MCP Server) │
                      └───────────────┘
```

**How it works**:

1. Browser extension injects content script into Kalkul app
2. Extension reads localStorage, can write back
3. Native messaging connects to local MCP server
4. Works bidirectionally

**Pros**:

- Works in all browsers (Chrome, Firefox, Edge)
- No app code changes needed
- Secure (user explicitly installs extension)

**Cons**:

- Users must install extension
- Native messaging setup is complex
- Platform-specific native host application needed

---

### Approach 5: WebRTC Peer-to-Peer

**Architecture**:

```
Browser ◄─────────────────────► MCP Server
         WebRTC Data Channel
         (peer-to-peer, no server)
```

**How it works**:

- Direct peer-to-peer connection between browser and MCP server
- No relay server needed for data transfer
- Signaling server only needed to establish initial connection

**Pros**:

- Truly peer-to-peer (no intermediate server)
- Low latency
- Works in all browsers

**Cons**:

- Signaling complexity
- NAT traversal issues in some networks
- Overkill for local-only use case

---

### Approach 6: Claude Artifacts / Code Interpreter

**No code changes needed - works today!**

**Flow**:

1. User exports portfolio JSON from Settings
2. User shares JSON with Claude (paste or attach)
3. Claude runs JavaScript/Python in Analysis tool
4. Claude analyzes, calculates scenarios, provides advice
5. Claude generates modified JSON
6. User imports back into Kalkul

**Pros**:

- Works immediately with no development
- Good for one-off consultations
- Claude can use full reasoning capabilities

**Cons**:

- Manual export/import cycle
- Not integrated into app workflow
- Calculation code needs to be provided each time

---

### Approach 7: Use Existing kalkul.app MCP Server

The companion project `kalkul.app` already has an MCP server with 25+ tools:

**Available tools**:

- `get_clients`, `add_client`, `update_client`, `delete_client`
- `get_portfolios`, `add_portfolio`, `update_portfolio`, `delete_portfolio`
- `get_investments`, `add_investment`, `update_investment`, `delete_investment`
- `add_transaction`, `update_transaction`, `delete_transaction`
- `calculate_portfolio_projection`
- `calculate_investment_projection`
- `evaluate_withdrawal_scenario`
- `compare_investment_scenarios`
- `get_market_data` (ISIN/ticker lookup)

**Consideration**: This server uses Supabase for storage. Options:

1. Add localStorage adapter to existing MCP server
2. Sync between local and cloud storage
3. Use cloud version for AI features, local for offline use

---

### Approach 8: Browser Automation (Playwright)

**Use AI to control the browser directly**

**How it works**:

- AI uses Playwright MCP tools to navigate Kalkul UI
- Can read displayed values, fill forms, click buttons
- Sees what user sees

**Pros**:

- Zero code changes
- Good for prototyping

**Cons**:

- Slow (UI navigation vs API calls)
- Brittle (depends on UI structure)
- Can't access calculation internals

---

## Proposal/Preview Workflow

The preferred interaction model: AI proposes changes, user reviews and approves.

### Workflow

```
1. User asks: "What if I retire 2 years earlier?"
         │
         ▼
2. AI analyzes current portfolio + calculates scenarios
         │
         ▼
3. AI returns proposal:
   ┌─────────────────────────────────────────────┐
   │ Scenario: Retire 2 years earlier            │
   │                                             │
   │ Current              │ Proposed             │
   │ Retire: 2045        │ Retire: 2043         │
   │ Value: €850,000     │ Value: €780,000      │
   │ Monthly: €3,500     │ Monthly: €3,100      │
   │                                             │
   │ Impact: -€70,000 value, -€400/month        │
   │                                             │
   │ [Apply Changes]  [Modify]  [Dismiss]       │
   └─────────────────────────────────────────────┘
         │
         ▼
4. User reviews, clicks "Apply Changes"
         │
         ▼
5. Changes saved to portfolio
```

### Proposal Format (JSON Schema)

```json
{
  "type": "scenario_comparison",
  "title": "Retire 2 years earlier",
  "description": "Analysis of retiring in 2043 instead of 2045",
  "baseline": {
    "portfolio_id": "abc123",
    "retirement_date": "2045-01-01",
    "projected_value": 850000,
    "monthly_withdrawal": 3500,
    "exhaustion_date": null
  },
  "proposed": {
    "retirement_date": "2043-01-01",
    "projected_value": 780000,
    "monthly_withdrawal": 3100,
    "exhaustion_date": null
  },
  "changes": [
    {
      "entity": "portfolio",
      "id": "abc123",
      "action": "update",
      "field": "end_date",
      "from": "2045-01-01",
      "to": "2043-01-01"
    }
  ],
  "impact": {
    "value_difference": -70000,
    "withdrawal_difference": -400,
    "summary": "With 2 fewer years of contributions and growth, projected value decreases by €70,000."
  },
  "recommendations": [
    "Increase monthly savings by €150 to maintain €3,500/month withdrawal",
    "Consider part-time work for first 2 years of retirement"
  ]
}
```

---

## Use Cases

### 1. Scenario Comparison

**User**: "What if I retire 2 years earlier?"
**AI actions**:

1. Read current portfolio configuration
2. Calculate baseline projection
3. Modify retirement date, recalculate
4. Generate comparison proposal
5. Include recommendations

### 2. Goal Optimization

**User**: "How much should I save monthly to have €1M by 65?"
**AI actions**:

1. Read current portfolio, age, contributions
2. Calculate required savings rate
3. Test multiple scenarios (conservative/aggressive)
4. Propose transaction modifications
5. Show progression over time

### 3. Portfolio Health Check

**User**: "Is my withdrawal rate sustainable?"
**AI actions**:

1. Read portfolio, withdrawals, timeline
2. Run Monte Carlo or deterministic projections
3. Identify exhaustion risk
4. Suggest adjustments if needed
5. Provide confidence assessment

### 4. Investment Comparison

**User**: "Should I put €10K in ETF A (7% return, 0.5% TER) or ETF B (8% return, 1.2% TER)?"
**AI actions**:

1. Create hypothetical investments with given parameters
2. Project both over portfolio timeline
3. Account for fees impact
4. Compare final values
5. Recommend based on total return after fees

---

## Existing Assets

### From kalkul-next

**Calculation engine** (`src/lib/plan-projection.ts`, `src/lib/financial-totals.ts`):

- `getYearlyPlanProjection()` - yearly plan projection with fees and inflation
- Profile-level totals (net worth, FI percent, runway)
- Full Decimal.js precision
- TypeScript, can run in Node.js

**Data model** (`src/lib/schemas.ts`):

- Profile, Portfolio, assets, liabilities, cash flows (Zod schemas)
- Clean JSON structure
- Easy to serialize/deserialize

**Adapter pattern** (`src/lib/adapters/`):

- Interface for data operations
- Currently localStorage implementation
- Could add WebSocket/sync adapter

### From kalkul.app MCP Server

- Full CRUD operations
- Projection calculations
- Scenario comparison tools
- Market data integration

---

## Recommended Path Forward

### Phase 1: Validate with Export/Import (Now)

- Use current export feature
- Test AI consultation workflows with Claude
- Identify most valuable interactions
- No code changes needed

### Phase 2: Extract Shared Library

- Extract the projection engine into a standalone NPM package
- Use in both browser and Node.js MCP server
- Ensure calculation parity

### Phase 3: Build WebSocket Bridge

- Add WebSocket client to kalkul-next (optional feature)
- Build MCP server with WebSocket + calculation library
- Works in all browsers including Firefox

### Phase 4: Add Proposal UI

- Design proposal preview component
- Handle scenario comparisons visually
- "Apply" button commits changes

### Alternative: Extend kalkul.app MCP

- Add localStorage/file adapter to existing MCP server
- Sync mechanism between local and cloud
- Leverage existing 25+ tools

---

## Questions to Explore

1. **What's the deployment model for MCP server?**
   - User runs locally (npx kalkul-mcp)
   - Bundled with desktop app
   - Cloud-hosted option

2. **Should AI have "write" access?**
   - Read-only + proposals (safer)
   - Direct write with undo (faster)

3. **How to handle offline?**
   - Queue proposals for later review
   - Local-only AI (on-device models)

4. **Multi-portfolio analysis?**
   - Compare across client portfolios
   - Aggregate family finances
