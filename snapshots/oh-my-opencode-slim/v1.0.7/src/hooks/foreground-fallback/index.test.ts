import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCooldownStore } from './cooldowns';
import { ForegroundFallbackManager, isRateLimitError } from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockClient(overrides?: {
  promptAsyncImpl?: (args: unknown) => Promise<unknown>;
  messagesData?: Array<{ info: { role: string }; parts: unknown[] }>;
}) {
  const promptAsync = mock(async (args: unknown) => {
    if (overrides?.promptAsyncImpl) return overrides.promptAsyncImpl(args);
    return {};
  });
  const abort = mock(async () => ({}));
  const prompt = mock(async (_args: unknown) => ({}));
  const messages = mock(async () => ({
    data: overrides?.messagesData ?? [
      { info: { role: 'user' }, parts: [{ type: 'text', text: 'hello' }] },
    ],
  }));

  return {
    client: {
      session: {
        abort,
        prompt,
        messages,
        // prompt/promptAsync are cast at runtime — expose via the session object
        promptAsync,
      },
    } as unknown as Parameters<typeof ForegroundFallbackManager>[0],
    mocks: { promptAsync, prompt, abort, messages },
  };
}

function makeChains(
  overrides?: Record<string, string[]>,
): Record<string, string[]> {
  return {
    orchestrator: [
      'anthropic/claude-opus-4-5',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
    ],
    librarian: [
      'anthropic/claude-opus-4-5',
      'openai/gpt-4o',
      'google/gemini-2.5-pro',
    ],
    explorer: ['openai/gpt-4o-mini', 'anthropic/claude-haiku'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isRateLimitError
// ---------------------------------------------------------------------------

describe('isRateLimitError', () => {
  test('returns true for explicit isRetryable APIError', () => {
    expect(isRateLimitError({ data: { isRetryable: true } })).toBe(true);
  });

  test('returns true for 429 status code even if isRetryable is absent', () => {
    expect(isRateLimitError({ data: { statusCode: 429 } })).toBe(true);
  });

  test('unwraps one-level error wrapper', () => {
    expect(isRateLimitError({ error: { data: { isRetryable: true } } })).toBe(
      true,
    );
  });

  test('returns false for non-retryable APIError', () => {
    expect(
      isRateLimitError({ data: { isRetryable: false, statusCode: 400 } }),
    ).toBe(false);
  });

  test('returns false for null', () => {
    expect(isRateLimitError(null)).toBe(false);
  });

  test('returns false for non-object', () => {
    expect(isRateLimitError('string error')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — disabled
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager (disabled)', () => {
  test('does nothing when enabled=false', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), false);

    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sess-1',
        error: { data: { isRetryable: true } },
      },
    });

    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — session.error
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager session.error', () => {
  let client: ReturnType<typeof createMockClient>['client'];
  let mocks: ReturnType<typeof createMockClient>['mocks'];
  let mgr: ForegroundFallbackManager;

  beforeEach(() => {
    ({ client, mocks } = createMockClient());
    mgr = new ForegroundFallbackManager(client, makeChains(), true);
  });

  test('triggers fallback on rate-limit session.error', async () => {
    // First teach the manager which model is in use for this session
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-1',
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
          role: 'assistant',
        },
      },
    });

    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sess-1',
        error: { data: { isRetryable: true } },
      },
    });

    expect(mocks.abort).toHaveBeenCalledTimes(1);
    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();

    const call = mocks.promptAsync.mock.calls[0] as [
      {
        path: { id: string };
        body: {
          agent?: string;
          model: { providerID: string; modelID: string };
        };
      },
    ];
    expect(call[0].path.id).toBe('sess-1');
    // Should have picked the next model after anthropic/claude-opus-4-5
    expect(call[0].body.model.providerID).toBe('openai');
    expect(call[0].body.model.modelID).toBe('gpt-4o');
  });

  test('does nothing when error is not a rate limit', async () => {
    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sess-1',
        error: { message: 'invalid request' },
      },
    });

    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });

  test('does nothing when no chain configured for session', async () => {
    const emptyMgr = new ForegroundFallbackManager(client, {}, true);
    await emptyMgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sess-1',
        error: { data: { isRetryable: true } },
      },
    });

    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });
});

describe('ForegroundFallbackManager replay contract', () => {
  test('preserves agent name on foreground replay via promptAsync', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-agent-preserve',
          agent: 'librarian',
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
        },
      },
    });

    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sess-agent-preserve',
        error: { data: { isRetryable: true } },
      },
    });

    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
    const call = mocks.promptAsync.mock.calls[0] as [
      {
        body: {
          agent?: string;
          model: { providerID: string; modelID: string };
        };
      },
    ];
    expect(call[0].body.agent).toBe('librarian');
    expect(call[0].body.model.providerID).toBe('openai');
    expect(call[0].body.model.modelID).toBe('gpt-4o');
  });

  test('does not perform mid-flight fallback for task-owned child sessions', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(
      client,
      makeChains({
        librarian: ['anthropic/claude-opus-4-5', 'openai/gpt-4o'],
      }),
      true,
    );

    await mgr.handleEvent({
      type: 'session.created',
      properties: {
        sessionID: 'child-1',
        info: { id: 'child-1', parentID: 'parent-1' },
      },
    });
    await mgr.handleEvent({
      type: 'subagent.session.created',
      properties: { sessionID: 'child-1', agentName: 'librarian' },
    });
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'child-1',
          agent: 'librarian',
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
        },
      },
    });

    await mgr.handleEvent({
      type: 'session.status',
      properties: {
        sessionID: 'child-1',
        status: {
          type: 'retry',
          attempt: 3,
          message: 'whatever',
          next: Date.now() + 5000,
        },
      },
    });

    expect(mocks.abort).not.toHaveBeenCalled();
    expect(mocks.prompt).not.toHaveBeenCalled();
    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — message.updated
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager message.updated', () => {
  test('tracks model from message.updated and falls back on error', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-2',
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
          error: { data: { isRetryable: true } },
        },
      },
    });

    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
  });

  test('uses agent name from message.updated to select correct chain', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    // explorer message with its model
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-3',
          agent: 'explorer',
          providerID: 'openai',
          modelID: 'gpt-4o-mini',
          error: { data: { isRetryable: true } },
        },
      },
    });

    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
    const call = mocks.promptAsync.mock.calls[0] as [
      {
        body: {
          agent?: string;
          model: { providerID: string; modelID: string };
        };
      },
    ];
    // explorer chain: ['openai/gpt-4o-mini', 'anthropic/claude-haiku']
    // current=gpt-4o-mini is tried → next = claude-haiku
    expect(call[0].body.model.providerID).toBe('anthropic');
    expect(call[0].body.model.modelID).toBe('claude-haiku');
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — session.status retry
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager session.status', () => {
  test('triggers fallback on retry status with rate limit message', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    // Pre-seed model
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-4',
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
        },
      },
    });

    await mgr.handleEvent({
      type: 'session.status',
      properties: {
        sessionID: 'sess-4',
        status: { type: 'retry', message: 'usage limit reached, retrying...' },
      },
    });

    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
  });

  test('triggers fallback on retry status with overloaded provider message', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    // Pre-seed model
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-4-overloaded',
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
        },
      },
    });

    await mgr.handleEvent({
      type: 'session.status',
      properties: {
        sessionID: 'sess-4-overloaded',
        status: {
          type: 'retry',
          message: 'Provider is overloaded. Retrying in 2s',
        },
      },
    });

    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
    const call = mocks.promptAsync.mock.calls[0] as [
      {
        body: {
          agent?: string;
          model: { providerID: string; modelID: string };
        };
      },
    ];
    expect(call[0].body.model.providerID).toBe('openai');
    expect(call[0].body.model.modelID).toBe('gpt-4o');
  });

  test('triggers fallback on retry status with no-available-Claude-accounts message', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    // Pre-seed model
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-4-no-accounts',
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
        },
      },
    });

    await mgr.handleEvent({
      type: 'session.status',
      properties: {
        sessionID: 'sess-4-no-accounts',
        status: {
          type: 'retry',
          message:
            'Internal Server Error: No available Claude accounts support the requested model: claude-opus-4-5. Retrying in 5s attempt #3',
        },
      },
    });

    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
    const call = mocks.promptAsync.mock.calls[0] as [
      {
        body: {
          agent?: string;
          model: { providerID: string; modelID: string };
        };
      },
    ];
    expect(call[0].body.model.providerID).toBe('openai');
    expect(call[0].body.model.modelID).toBe('gpt-4o');
  });
  test('ignores session.status when status.type is not retry', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    await mgr.handleEvent({
      type: 'session.status',
      properties: {
        sessionID: 'sess-4',
        status: { type: 'busy', message: 'connection timeout, retrying...' },
      },
    });

    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — chain exhaustion
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager chain exhaustion', () => {
  test('does not call promptAsync when the only chain model is already the current model', async () => {
    // Scenario: chain = ['openai/gpt-b'], current model IS 'openai/gpt-b'.
    // tryFallback adds 'openai/gpt-b' to tried → chain.find() returns undefined → exhausted.
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(
      client,
      { orchestrator: ['openai/gpt-b'] },
      true,
    );

    // Seed current model as the only chain entry
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 's',
          providerID: 'openai',
          modelID: 'gpt-b',
        },
      },
    });

    // Rate limit fires — only model in chain is already current → nothing to fall back to
    await mgr.handleEvent({
      type: 'session.error',
      properties: { sessionID: 's', error: { data: { isRetryable: true } } },
    });

    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });

  test('does not call promptAsync when all chain models have been tried', async () => {
    // Scenario: chain = ['anthropic/claude-a', 'openai/gpt-b'].
    // Current model is 'openai/gpt-b' (the last fallback already in use).
    // tried will contain: 'openai/gpt-b' (current) → chain.find() → 'anthropic/claude-a'
    // would be picked… unless we also mark it tried via a prior switch.
    // Use agent name tracking so we can target the right chain, then seed tried
    // by having the manager go through both models via sequential events
    // (each on a distinct session so dedup does not interfere).
    const { client, mocks } = createMockClient();
    const chain = ['openai/model-x', 'openai/model-y'];
    const mgr = new ForegroundFallbackManager(
      client,
      { librarian: chain },
      true,
    );

    // Session A: current model is model-x, which IS in the chain → picks model-y ✓
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-exhaust',
          agent: 'librarian',
          providerID: 'openai',
          modelID: 'model-x',
          error: { data: { isRetryable: true } },
        },
      },
    });
    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();

    // Session B (fresh session, different ID): only model-y is in chain and it IS
    // the current model → tried gets model-y → chain.find() = undefined → exhausted
    const { client: client2, mocks: mocks2 } = createMockClient();
    const mgr2 = new ForegroundFallbackManager(
      client2,
      { librarian: ['openai/model-y'] }, // single-entry chain already in use
      true,
    );
    await mgr2.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-exhaust-2',
          agent: 'librarian',
          providerID: 'openai',
          modelID: 'model-y',
          error: { data: { isRetryable: true } },
        },
      },
    });
    expect(mocks2.promptAsync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — deduplication
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager deduplication', () => {
  test('ignores a second trigger within dedup window for same session', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    const event = {
      type: 'session.error',
      properties: {
        sessionID: 'sess-dup',
        error: { data: { isRetryable: true } },
      },
    };

    await mgr.handleEvent(event);
    await mgr.handleEvent(event); // immediate second trigger — should be deduped

    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
  });

  test('different sessions are not deduplicated against each other', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sess-A',
        error: { data: { isRetryable: true } },
      },
    });
    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sess-B',
        error: { data: { isRetryable: true } },
      },
    });

    expect(mocks.promptAsync).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — subagent.session.created
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager subagent.session.created', () => {
  test('tracks child agent identity but does not perform mid-flight fallback', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    // Register the session as 'explorer' via subagent creation event
    await mgr.handleEvent({
      type: 'subagent.session.created',
      properties: { sessionID: 'sub-1', agentName: 'explorer' },
    });

    // Now trigger rate limit — should use explorer's chain
    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sub-1',
        error: { data: { isRetryable: true } },
      },
    });

    expect(mocks.prompt).not.toHaveBeenCalled();
    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — session.deleted cleanup
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager session.deleted', () => {
  test('cleans up session state on session.deleted preventing memory leaks', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    // Populate all maps for this session
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-del',
          agent: 'orchestrator',
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
        },
      },
    });

    // Delete the session
    await mgr.handleEvent({
      type: 'session.deleted',
      properties: { sessionID: 'sess-del' },
    });

    // After deletion, a new rate-limit on the same ID should behave as a fresh
    // session (no prior model known → uses chain from start, dedup cleared)
    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sess-del',
        error: { data: { isRetryable: true } },
      },
    });

    // Should have triggered (dedup was cleared by session.deleted)
    // and should pick the first chain model (no current model seed after deletion)
    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
    const call = mocks.promptAsync.mock.calls[0] as [
      { body: { model: { providerID: string; modelID: string } } },
    ];
    // orchestrator chain: ['anthropic/claude-opus-4-5', 'openai/gpt-4o', 'google/gemini-2.5-pro']
    // no current model → first untried = anthropic/claude-opus-4-5
    expect(call[0].body.model.providerID).toBe('anthropic');
    expect(call[0].body.model.modelID).toBe('claude-opus-4-5');
  });

  test('ignores session.deleted with no sessionID', async () => {
    const { client } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);
    // Should not throw
    await expect(
      mgr.handleEvent({ type: 'session.deleted', properties: {} }),
    ).resolves.toBeUndefined();
  });

  test('cleans up state using info.id shape (top-level session deletion)', async () => {
    // OpenCode emits { properties: { info: { id } } } for top-level sessions
    // and { properties: { sessionID } } for subagent sessions. Both must clean up.
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    // Seed state for the session
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-info-del',
          agent: 'orchestrator',
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
        },
      },
    });

    // Delete via the info.id shape
    await mgr.handleEvent({
      type: 'session.deleted',
      properties: { info: { id: 'sess-info-del' } },
    });

    // State is cleared: a new rate-limit on same ID should behave as fresh session
    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'sess-info-del',
        error: { data: { isRetryable: true } },
      },
    });

    // Triggered (dedup was cleared by deletion)
    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — resolveChain correctness
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager resolveChain cross-agent isolation', () => {
  test('does not use another agent chain when known agent has no configured chain', async () => {
    // oracle has no chain in runtimeChains; without the fix resolveChain would
    // fall through to the cross-agent "last resort" and pick a model from
    // orchestrator's chain — re-prompting oracle with an orchestrator model.
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(
      client,
      {
        // oracle intentionally absent — no chain configured
        orchestrator: ['openai/gpt-4o', 'google/gemini-2.5-pro'],
      },
      true,
    );

    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'oracle-sess',
          agent: 'oracle', // agent IS known
          providerID: 'anthropic',
          modelID: 'claude-opus-4-5',
          error: { data: { isRetryable: true } },
        },
      },
    });

    // oracle has no chain → should not fall back at all
    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });

  test('uses cross-agent last-resort only when agent name is unknown', async () => {
    // When the agent name is genuinely unknown AND current model is not in any
    // chain, the last-resort flattened chain is acceptable.
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(
      client,
      { orchestrator: ['openai/gpt-4o'] },
      true,
    );

    // No agent name tracked, no model tracked — triggers session.error
    await mgr.handleEvent({
      type: 'session.error',
      properties: {
        sessionID: 'unknown-agent-sess',
        error: { data: { isRetryable: true } },
      },
    });

    // Falls through to last-resort → picks first model from any chain
    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    expect(mocks.prompt).not.toHaveBeenCalled();
    const call = mocks.promptAsync.mock.calls[0] as [
      { body: { model: { providerID: string; modelID: string } } },
    ];
    expect(call[0].body.model.providerID).toBe('openai');
    expect(call[0].body.model.modelID).toBe('gpt-4o');
  });
});

// ---------------------------------------------------------------------------
// Anthropic cooldown integration (v1.3.0 patch 0005)
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager Anthropic cooldown integration', () => {
  let tmp: string;
  let cooldownPath: string;
  let now: number;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'omo-fb-cooldown-'));
    cooldownPath = join(tmp, '.omo-slim-cooldowns.json');
    now = Date.parse('2026-05-05T12:00:00Z');
  });

  function makeManagerWithStore(
    chains: Record<string, string[]> = {
      librarian: ['anthropic/claude-opus-4-7', 'openai/gpt-5.4'],
    },
  ) {
    const store = createCooldownStore({
      filePath: cooldownPath,
      nowFn: () => now,
    });
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, chains, true, store);
    return {
      mgr,
      mocks,
      store,
      cleanup: () => rmSync(tmp, { recursive: true, force: true }),
    };
  }

  test('captures cooldown from anthropic-ratelimit-*-reset headers on session.error', async () => {
    const { mgr, store, cleanup } = makeManagerWithStore();
    try {
      // Seed model identity for the session
      await mgr.handleEvent({
        type: 'message.updated',
        properties: {
          info: {
            sessionID: 'sess-1',
            agent: 'orchestrator',
            providerID: 'anthropic',
            modelID: 'claude-opus-4-7',
          },
        },
      });

      const resetEpochMs = now + 5 * 60 * 60 * 1000; // 5 hours
      await mgr.handleEvent({
        type: 'session.error',
        properties: {
          sessionID: 'sess-1',
          error: {
            message: 'rate limit exceeded',
            data: {
              statusCode: 429,
              responseHeaders: {
                'anthropic-ratelimit-requests-reset': new Date(
                  resetEpochMs,
                ).toISOString(),
              },
            },
          },
        },
      });

      expect(store.snapshot()['anthropic/claude-opus-4-7']).toBe(resetEpochMs);
    } finally {
      cleanup();
    }
  });

  test('skips cooled-down models when picking next fallback', async () => {
    const { mgr, mocks, store, cleanup } = makeManagerWithStore({
      librarian: [
        'anthropic/claude-opus-4-7',
        'openai/gpt-5.4',
        'google/gemini-2.5-pro',
      ],
    });
    try {
      // Pre-populate cooldown for opus and gpt-5.4
      store.set('anthropic/claude-opus-4-7', now + 60_000);
      store.set('openai/gpt-5.4', now + 60_000);

      // Seed agent for the session
      await mgr.handleEvent({
        type: 'message.updated',
        properties: {
          info: {
            sessionID: 'sess-skip',
            agent: 'librarian',
            providerID: 'anthropic',
            modelID: 'claude-opus-4-7',
          },
        },
      });

      // Trigger fallback (no headers, just a generic rate-limit error)
      await mgr.handleEvent({
        type: 'session.error',
        properties: {
          sessionID: 'sess-skip',
          error: { data: { isRetryable: true } },
        },
      });

      // Should have picked gemini-2.5-pro (skipping opus and gpt-5.4 due to cooldown)
      expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
      expect(mocks.prompt).not.toHaveBeenCalled();
      const call = mocks.promptAsync.mock.calls[0] as [
        { body: { model: { providerID: string; modelID: string } } },
      ];
      expect(call[0].body.model.providerID).toBe('google');
      expect(call[0].body.model.modelID).toBe('gemini-2.5-pro');
    } finally {
      cleanup();
    }
  });

  test('falls back to first untried when all models are cooling down', async () => {
    const { mgr, mocks, store, cleanup } = makeManagerWithStore({
      librarian: ['anthropic/claude-opus-4-7', 'openai/gpt-5.4'],
    });
    try {
      // Cool down BOTH models in chain
      store.set('anthropic/claude-opus-4-7', now + 60_000);
      store.set('openai/gpt-5.4', now + 60_000);

      await mgr.handleEvent({
        type: 'message.updated',
        properties: {
          info: {
            sessionID: 'sess-all-cool',
            agent: 'librarian',
            providerID: 'anthropic',
            modelID: 'claude-opus-4-7',
          },
        },
      });

      await mgr.handleEvent({
        type: 'session.error',
        properties: {
          sessionID: 'sess-all-cool',
          error: { data: { isRetryable: true } },
        },
      });

      // Cooldown is a soft hint: when entire chain is cooling, we still
      // pick the first untried (cooldown ignored). Better to attempt and
      // fail than leave the user fully stuck.
      expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
      expect(mocks.prompt).not.toHaveBeenCalled();
      const call = mocks.promptAsync.mock.calls[0] as [
        { body: { model: { providerID: string; modelID: string } } },
      ];
      expect(call[0].body.model.providerID).toBe('openai');
      expect(call[0].body.model.modelID).toBe('gpt-5.4');
    } finally {
      cleanup();
    }
  });

  test('non-anthropic errors do not write to cooldown store', async () => {
    const { mgr, store, cleanup } = makeManagerWithStore();
    try {
      await mgr.handleEvent({
        type: 'message.updated',
        properties: {
          info: {
            sessionID: 'sess-noheader',
            agent: 'orchestrator',
            providerID: 'anthropic',
            modelID: 'claude-opus-4-7',
          },
        },
      });

      await mgr.handleEvent({
        type: 'session.error',
        properties: {
          sessionID: 'sess-noheader',
          error: {
            message: 'rate limit exceeded',
            data: { statusCode: 429 }, // no responseHeaders
          },
        },
      });

      // No cooldown captured because no headers
      expect(store.snapshot()['anthropic/claude-opus-4-7']).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  test('getCooldownStore exposes the underlying store', () => {
    const { mgr, store, cleanup } = makeManagerWithStore();
    try {
      expect(mgr.getCooldownStore()).toBe(store);
    } finally {
      cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// ForegroundFallbackManager — orchestrator pivot
// ---------------------------------------------------------------------------

describe('ForegroundFallbackManager orchestrator pivot', () => {
  test('pivots to orchestrator-beta when orchestrator hits retry status', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    // Pre-populate sessionAgent via message.updated event.
    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-pivot-1',
          agent: 'orchestrator',
          providerID: 'gauge-forge-anthropic',
          modelID: 'claude-opus-4-7',
        },
      },
    });

    await mgr.handleEvent({
      type: 'session.status',
      properties: {
        sessionID: 'sess-pivot-1',
        status: { type: 'retry', message: 'rate-limited' },
      },
    });

    expect(mocks.abort).toHaveBeenCalledTimes(1);
    expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    const call = mocks.promptAsync.mock.calls[0] as [
      {
        path: { id: string };
        body: {
          parts: unknown[];
          model: { providerID: string; modelID: string };
          agent?: string;
        };
      },
    ];
    expect(call[0].path.id).toBe('sess-pivot-1');
    expect(call[0].body.agent).toBe('orchestrator-beta');
    expect(call[0].body.model.providerID).toBe('gauge-forge-openai');
    expect(call[0].body.model.modelID).toBe('gpt-5.4');
  });

  test('notifies plugin-level session identity on orchestrator pivot', async () => {
    const { client } = createMockClient();
    const onSessionAgentChange = mock((_sessionID: string, _agent: string) => {});
    const mgr = new ForegroundFallbackManager(
      client,
      makeChains(),
      true,
      undefined,
      onSessionAgentChange,
    );

    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-pivot-callback',
          agent: 'orchestrator',
          providerID: 'gauge-forge-anthropic',
          modelID: 'claude-opus-4-7',
        },
      },
    });

    await mgr.handleEvent({
      type: 'session.status',
      properties: {
        sessionID: 'sess-pivot-callback',
        status: { type: 'retry', message: 'rate-limited' },
      },
    });

    expect(onSessionAgentChange).toHaveBeenCalledTimes(1);
    expect(onSessionAgentChange).toHaveBeenCalledWith(
      'sess-pivot-callback',
      'orchestrator-beta',
    );
  });

  test('does NOT pivot when current agent is orchestrator-beta', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    await mgr.handleEvent({
      type: 'message.updated',
      properties: {
        info: {
          sessionID: 'sess-beta-1',
          agent: 'orchestrator-beta',
          providerID: 'gauge-forge-openai',
          modelID: 'gpt-5.4',
        },
      },
    });

    await mgr.handleEvent({
      type: 'session.status',
      properties: {
        sessionID: 'sess-beta-1',
        status: { type: 'retry', message: 'rate-limited' },
      },
    });

    // No pivot. Chain-walk for orchestrator-beta has no chain entry, so
    // nothing happens.
    expect(mocks.abort).not.toHaveBeenCalled();
    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });

  test('does NOT pivot for child sessions even if agent is orchestrator', async () => {
    const { client, mocks } = createMockClient();
    const mgr = new ForegroundFallbackManager(client, makeChains(), true);

    // Mark this session as a child via subagent.session.created.
    await mgr.handleEvent({
      type: 'subagent.session.created',
      properties: {
        sessionID: 'sess-child-1',
        agentName: 'orchestrator',
      },
    });

    await mgr.handleEvent({
      type: 'session.status',
      properties: {
        sessionID: 'sess-child-1',
        status: { type: 'retry', message: 'rate-limited' },
      },
    });

    expect(mocks.abort).not.toHaveBeenCalled();
    expect(mocks.promptAsync).not.toHaveBeenCalled();
  });

  test('updates internal sessionAgent map to orchestrator-beta after pivot', async () => {
    const originalDateNow = Date.now;
    let now = Date.parse('2026-05-07T12:00:00Z');
    Date.now = () => now;

    try {
      const { client, mocks } = createMockClient();
      const mgr = new ForegroundFallbackManager(client, makeChains(), true);

      await mgr.handleEvent({
        type: 'message.updated',
        properties: {
          info: {
            sessionID: 'sess-pivot-2',
            agent: 'orchestrator',
            providerID: 'gauge-forge-anthropic',
            modelID: 'claude-opus-4-7',
          },
        },
      });

      await mgr.handleEvent({
        type: 'session.status',
        properties: {
          sessionID: 'sess-pivot-2',
          status: { type: 'retry', message: 'rate-limited' },
        },
      });

      // Move beyond the dedup window so the second trigger can only be blocked
      // by the pivot's sessionAgent update to orchestrator-beta.
      now += 6_000;

      await mgr.handleEvent({
        type: 'session.status',
        properties: {
          sessionID: 'sess-pivot-2',
          status: { type: 'retry', message: 'rate-limited again' },
        },
      });

      // First retry produced exactly one promptAsync call (the pivot).
      // Second retry produced zero because the session is now orchestrator-beta.
      expect(mocks.promptAsync).toHaveBeenCalledTimes(1);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
