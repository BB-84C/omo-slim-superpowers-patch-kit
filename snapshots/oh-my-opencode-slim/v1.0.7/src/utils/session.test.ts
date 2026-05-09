import { describe, expect, test } from 'bun:test';
import { extractSessionAgent } from './session';

describe('extractSessionAgent', () => {
  test('returns latest string info.agent from session messages', async () => {
    const client = {
      session: {
        messages: async () => ({
          data: [
            { info: { role: 'user', agent: 'librarian' }, parts: [] },
            { info: { role: 'assistant', agent: 'librarian' }, parts: [] },
          ],
        }),
      },
    } as any;

    await expect(extractSessionAgent(client, 'ses_1')).resolves.toBe(
      'librarian',
    );
  });

  test('returns the last available string agent when multiple message agents exist', async () => {
    const client = {
      session: {
        messages: async () => ({
          data: [
            { info: { role: 'user', agent: 'librarian' }, parts: [] },
            {
              info: { role: 'assistant', agent: 'librarian__task_fallback' },
              parts: [],
            },
          ],
        }),
      },
    } as any;

    await expect(extractSessionAgent(client, 'ses_2')).resolves.toBe(
      'librarian__task_fallback',
    );
  });

  test('returns undefined when no message contains a string agent', async () => {
    const client = {
      session: {
        messages: async () => ({
          data: [
            { info: { role: 'user' }, parts: [] },
            { info: { role: 'assistant', agent: null }, parts: [] },
          ],
        }),
      },
    } as any;

    await expect(extractSessionAgent(client, 'ses_3')).resolves.toBeUndefined();
  });
});
