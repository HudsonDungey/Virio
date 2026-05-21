# CLAUDE.md

Operating manual for this repository. Read it before writing code. It binds humans and AI agents equally.

This is a Yarn workspaces monorepo: a Next.js dashboard, Foundry Solidity contracts, a TypeScript SDK, and an off-chain executor. The protocol is onchain, public, and permissionless. There are no API keys and no hosted backend.

```
contracts/            Foundry project — the protocol. Source of truth for all behavior.
packages/sdk/         @virio/sdk — typed viem client. Mirrors the contracts.
packages/scheduler/   @virio/scheduler — off-chain executor (charge loop).
packages/dashboard/   Next.js 14 app-router frontend + docs.
```

---

## 1. Engineering Philosophy

The goal is a codebase that a competent engineer — or an AI agent — can fully reason about with minimal context. Optimize for clarity of reasoning, not lines of code, not cleverness, not feature count.

- **Simplicity over cleverness.** Clever code is a liability the moment someone else reads it.
- **Readability is correctness.** Code is read far more than written. Unreadable code hides bugs.
- **Predictability.** Same input, same output. No hidden state, no spooky action at a distance.
- **Minimal abstractions.** Every abstraction must justify its existence. An abstraction that saves three lines but adds a layer of indirection is a net loss.
- **Low coupling, explicit data flow.** Data moves through arguments and return values, not ambient context. You should be able to trace any value to its origin by reading, not guessing.
- **Composability.** Small, sharp pieces that combine. Not frameworks within frameworks.
- **Maintainability over cleverness.** The code that ships is the code that must be maintained for years.

Operating beliefs:

- Every abstraction must justify its existence.
- If a junior engineer cannot understand it quickly, simplify it.
- Prefer deletion over additional architecture.
- The best code is often no code.
- A smaller system with the same behavior is strictly better.

---

## 2. Repository Mental Model

The contracts are the system. Everything else is a typed view onto them.

```
Customer wallet ──approve──▶ ERC-20
       │
       └──subscribe──▶ VirioSubscriptionManager ◀──charge()── Executor (anyone)
                              │  splits onchain
                              ├──▶ Merchant   (net)
                              ├──▶ Executor   (fee)
                              └──▶ Protocol   (fee)
```

- **Contracts** (`contracts/src`) hold all state and enforce all rules: plans, subscriptions, payroll, fees, timing. Settlement is a pure function of onchain state, which is why executors are interchangeable and there is no custody.
- **SDK** (`packages/sdk`) is a thin, typed wrapper over the manager ABI using viem. It adds no business logic the contract does not already enforce. Its types mirror the Solidity structs exactly.
- **Scheduler** (`packages/scheduler`) is the executor: a `tick()` loop that finds due subscriptions and calls `charge()`. The contract enforces timing, so ticks are idempotent and safe to retry.
- **Dashboard** (`packages/dashboard`) is a server-first Next.js app. It reads chain state via the SDK and signs writes with the connected wallet.

Execution is event-driven. Onchain events (`PlanCreated`, `Subscribed`, `ChargeExecuted`, `Cancelled`) are the canonical record. Off-chain components index events and reconcile against them; they never become a second source of truth.

Data flow is one-directional: **wallet → contract → event → indexer/UI.** Never invert it.

---

## 3. AI Agent Operating Rules

You are a systems engineer working in a system that must stay legible to the next agent. Optimize for future reasoning clarity and a small confusion surface.

**Structure**
- Never introduce an abstraction until the same code exists in three places. Two is a coincidence; three is a pattern.
- Prefer modifying an existing file over creating a new one. A new file is a new thing to find.
- Prefer deletion and refactoring over expansion. Removing code that makes the change unnecessary is the best outcome.
- Keep files small and single-purpose. If a file does two unrelated things, split by responsibility, not by line count.
- Avoid deep nesting — in folders, in JSX, in control flow. Flat is findable.
- No "enterprise patterns": no factories, managers, providers, or service layers unless the problem genuinely demands one. It almost never does.

**Dependencies & generalization**
- Never add a dependency without strong justification. Justify it in the PR. Prefer the platform.
- Never generalize prematurely. Write the specific thing. Generalize only when a second concrete case forces it.
- Be highly skeptical of custom hooks and custom utilities. Most are inlined logic wearing a costume. Inline first; extract only on the third repetition.

**Reasoning**
- Think like a systems engineer, not a framework maximalist.
- Optimize for future reasoning clarity. The next reader is an AI with a fresh context window — make the code self-explanatory.
- Reduce token complexity. Less surface area means less to load, less to misread, less to break.
- Trace data flow explicitly. If you cannot say where a value comes from, the design is wrong.

**Process**
- Before adding, ask whether deleting solves it.
- Match the surrounding style exactly. Consistency beats personal preference.
- When the contracts and the SDK disagree, the contracts are right. Fix the SDK.
- Do not leave half-finished work, dead code, commented-out blocks, or speculative scaffolding.

**Conventional commands** (run from repo root unless noted):

```
yarn compile          # forge build
yarn test:contracts   # forge test -vv
yarn test:gas         # gas report
yarn test:e2e         # SDK + scheduler end-to-end
yarn dev              # dashboard dev server
yarn build            # build sdk + scheduler
yarn typecheck        # tsc across workspaces
```

Run the relevant checks before declaring work done. For contract changes: tests and gas. For TS changes: typecheck.

---

## 4. TypeScript Standards

- `strict` is on and stays on. Do not weaken `tsconfig`.
- No `any`. If a type is genuinely unknown, use `unknown` and narrow. `any` is a hole in the type system and a hole in your reasoning.
- Public functions and exported APIs have explicit return types. Inference is fine for locals; signatures are contracts.
- Prefer `interface` for object shapes, `type` for unions and aliases. Keep them flat.
- Validate at boundaries. Anything entering from the network, the chain, the filesystem, or user input is `unknown` until validated. Inside the trust boundary, trust your types.
- Avoid over-generic utility types. A function with four type parameters is usually two functions. Write the concrete version.
- Naming: descriptive and boring. `getSubscription`, not `fetchSubData`. No abbreviations that aren't already domain terms (`bps`, `id` are fine). Booleans read as predicates (`isActive`, `hasAllowance`).
- bigint for all token amounts and timestamps. Never `number` for money. Convert to display strings only at the UI edge.
- Errors are values you handle, not strings you stringify and hope. Inspect revert reasons explicitly.

---

## 5. Solidity Standards

Security first, simplicity second, gas third — in that order, and the first two rarely conflict.

- **Solidity `^0.8.24`.** Lean on built-in overflow checks; do not reach for unchecked math without a measured reason and a comment.
- **Explicit state transitions.** Each external function moves the contract between clearly defined states. Document the valid transitions. No implicit or ambiguous states.
- **Checks-Effects-Interactions, always.** Mutate all state before any external call. Pair it with a `nonReentrant` guard for defense in depth, not as a substitute for ordering.
- **Minimize storage writes.** Cache storage reads in memory; write once. Storage is the dominant gas cost and the dominant source of inconsistency bugs.
- **Shallow inheritance.** Prefer composition and small interfaces over deep hierarchies. If you need to read three parent contracts to understand one function, the design failed.
- **Modular contracts.** One contract, one responsibility. The subscription manager does not know about payroll.
- **Deterministic execution.** No reliance on anything an attacker can grind (`block.timestamp` is acceptable for coarse periods; never for randomness or fine ordering).
- **Custom errors, not require strings.** `revert TooEarlyToCharge(id, nextAt)` over `require(..., "too early")`. Cheaper and machine-readable.
- **Events for every critical state change.** Off-chain consumers reconstruct state from events; an unemitted transition is an invisible one.
- **Comment invariants, not syntax.** Explain what must always be true (`// nextChargeAt is additive: never drifts`), the threat being mitigated, and any non-obvious ordering. Never narrate the obvious.
- **Avoid upgradeability.** Non-upgradeable bytecode is the strongest guarantee. Ship new behavior as a new deployment and migrate explicitly. Add a proxy only when an explicit requirement demands it, and treat it as a major security surface.

**AI-agent guidance for contract work:**

- **Attack surface analysis.** Before changing any external function, enumerate who can call it, with what inputs, and what they could extract or break. Write it down in the PR.
- **Reentrancy.** Any external call (token transfer, callback) is a yield point. Assume control returns to an attacker mid-function. CEI + guard, every time.
- **Signature verification hygiene.** Bind signatures to a domain separator, a nonce/epoch, and an expiry. Reject malleable signatures. Verify the recovered signer is exactly who you expect — never "non-zero."
- **Access control clarity.** One modifier, one obvious meaning (`onlyOwner`, `onlyEmployer`). No role lattices. The reader should know who can call a function from its signature.
- **Gas-aware architecture.** Favor O(1) operations on user-triggered paths. Never loop over unbounded arrays in a function anyone can call. Batch operations must fail soft per item, not revert the world.

---

## 6. Frontend Standards (Next.js)

- **Server-first.** Default to Server Components. Reach for `"use client"` only for interactivity (state, effects, event handlers, wallet). A client boundary is a cost; pay it deliberately and push it to the leaves.
- **Avoid unnecessary client state.** Most state is derivable from the URL, the server, or the chain. Derive it; don't store it. The fewer `useState` calls, the fewer bugs.
- **Avoid context as a state manager.** Context is for genuinely cross-cutting, rarely-changing values (theme, wallet). It is not a Redux substitute. Do not reach for a global store library.
- **Small, local components.** Colocate a component's logic, types, and markup. A component that needs a 200-line file is two components.
- **No giant UI abstraction systems.** Use the existing primitives. Do not build a meta-framework of wrappers. Prefer three explicit, similar components over one configurable monster.
- **Solve prop drilling by composition**, not by reflexively introducing global state. Pass children, lift state only as far as needed.
- **Minimal animation.** Motion serves comprehension, not decoration. Respect reduced-motion.
- **Performance first.** Ship the least JavaScript that works. Measure before optimizing, but default to the lighter pattern.
- **Accessibility first.** Semantic HTML, real buttons and links, labels, keyboard paths, sufficient contrast. This is non-negotiable, not a follow-up ticket.

---

## 7. File & Folder Philosophy

- **Shallow over deep.** Prefer two levels to five. Deep trees hide code and inflate import paths.
- **Feature-oriented.** Group by what it does (`docs/`, `payroll/`), not by what it is (`components/`, `hooks/`, `utils/` everywhere). Things that change together live together.
- **No `utils` dumping ground.** "Utils" is where unowned code goes to rot. Name modules by their domain. If a helper has no clear home, it probably belongs inline.
- **Don't over-split.** A 60-line file is not a problem. Splitting it into six 10-line files you must open in sequence is. Split by responsibility, never by line count.
- **No dead code.** Unused exports, commented blocks, "might need later" scaffolding — delete them. Git remembers.
- **No duplicate abstractions.** Two helpers doing the same thing is worse than zero. Before adding, grep for what exists.

---

## 8. Dependency Policy

- **Every dependency is a liability** — supply-chain risk, bundle weight, maintenance burden, and one more thing an agent must learn.
- **Prefer native platform APIs.** `fetch`, `crypto`, `Intl`, viem primitives, the Next.js runtime. The platform is already loaded and already audited.
- **Fewer packages, deliberately chosen.** A dependency must earn its place by saving real complexity, not by being convenient for one function you could write in ten lines.
- **Avoid trend-driven libraries.** Popularity is not a technical argument. Choose for stability and fit, not for the changelog.
- **Remove unused dependencies aggressively.** When you delete the last consumer, delete the dependency in the same PR.
- A new dependency requires explicit justification in the PR description: what it does, why the platform can't, and its weight.

---

## 9. Git & PR Standards

- **Small, atomic commits.** One logical change each. A commit should be revertable in isolation.
- **Concise PRs with a stated reason.** Explain the why, not the what — the diff already shows the what.
- **No massive rewrites.** Large, behavior-preserving refactors are reviewed separately from behavior changes. Never mix them.
- **Preserve repo clarity.** A PR that leaves the codebase simpler than it found it is the standard, not the exception.
- **Tests and types pass before review.** Don't outsource your verification to the reviewer.
- Commit messages: imperative mood, plain language, no decoration.

---

## 10. Performance Philosophy

- **Low bundle size.** Server Components and code at the edges. The best JavaScript is the JavaScript you didn't ship.
- **Compute on the server.** Render and aggregate server-side; send data, not work.
- **Cache-aware.** Use static generation and framework caching deliberately. Know what is static, what is dynamic, and why.
- **Efficient contract interactions.** Batch reads. Cache immutable values (decimals, addresses). Don't refetch what hasn't changed.
- **Reduce RPC overhead.** Coalesce calls, scan events from a known deployment block, paginate large ranges. Treat the RPC as a metered resource.
- **No premature optimization.** Write the clear version first. Optimize only against a measurement, and leave the measurement in the PR.

---

## 11. Security Philosophy

Assume a hostile environment at every boundary — public chain, public RPC, untrusted input, anonymous callers.

- **Validate everything that crosses a trust boundary.** Network responses, chain reads you didn't write, user input, webhook bodies. Verify before you trust.
- **Explicit trust boundaries.** Know exactly where untrusted data becomes trusted, and do the validation precisely there. No "it's probably fine."
- **Minimize secret exposure.** No secrets in the client bundle, in the repo, or in logs. The only client-side key material is the user's own wallet, which signs but never leaves.
- **No hidden auth assumptions.** Authorization is explicit and checked at the point of action — onchain via modifiers, off-chain via verified signatures. Never infer permission from UI state.
- **Constant-time comparisons** for signatures and secrets. Never `===` or `.includes()` on a MAC.
- **Idempotency and replay defense.** Onchain timing prevents double-charges; off-chain, deduplicate on event id and reject stale events.
- **Confirm before you trust an address.** Verify deployed bytecode and addresses before approving spend or sending value.

---

## 12. Final Doctrine

- Simplicity scales. Complexity compounds.
- Explicit beats implicit.
- Fewer abstractions, fewer bugs.
- Delete aggressively. The best diff is often a negative one.
- The contracts are the source of truth; everything else is a view.
- Validate at the boundary; trust within it.
- Build systems humans and AI can reason about with a fresh context window.
- Minimize entropy. Leave the code simpler than you found it.
- Every line must earn its place.
