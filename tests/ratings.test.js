import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { processVote } from '../src/ratings.js';

function makeClient(existingVote) {
  const calls = [];

  const client = {
    calls,
    async query(sql, params) {
      calls.push({ sql: sql.trim().replace(/\s+/g, ' '), params });

      if (sql.includes('SELECT vote FROM user_ratings')) {
        return { rows: existingVote ? [{ vote: existingVote }] : [] };
      }
      return { rows: [] };
    },
  };

  return client;
}

describe('processVote', () => {
  it('rejects invalid vote value', async () => {
    const client = makeClient(null);
    await assert.rejects(
      () => processVote(client, { visitorId: 'v1', songId: 's1', vote: 'sideways' }),
      { message: 'vote must be "up" or "down"' }
    );
  });

  it('casts a new up vote', async () => {
    const client = makeClient(null);
    const myVote = await processVote(client, { visitorId: 'v1', songId: 's1', vote: 'up' });

    assert.equal(myVote, 'up');
    assert.ok(client.calls.some(c => c.sql.includes('thumbs_up = thumbs_up + 1')));
    assert.ok(client.calls.some(c => c.sql.includes('INSERT INTO user_ratings')));
    assert.ok(client.calls.some(c => c.sql.includes('COMMIT')));
  });

  it('casts a new down vote', async () => {
    const client = makeClient(null);
    const myVote = await processVote(client, { visitorId: 'v1', songId: 's1', vote: 'down' });

    assert.equal(myVote, 'down');
    assert.ok(client.calls.some(c => c.sql.includes('thumbs_down = thumbs_down + 1')));
  });

  it('toggles off an existing up vote', async () => {
    const client = makeClient('up');
    const myVote = await processVote(client, { visitorId: 'v1', songId: 's1', vote: 'up' });

    assert.equal(myVote, null);
    assert.ok(client.calls.some(c => c.sql.includes('GREATEST(0, thumbs_up - 1)')));
    assert.ok(client.calls.some(c => c.sql.includes('DELETE FROM user_ratings')));
  });

  it('toggles off an existing down vote', async () => {
    const client = makeClient('down');
    const myVote = await processVote(client, { visitorId: 'v1', songId: 's1', vote: 'down' });

    assert.equal(myVote, null);
    assert.ok(client.calls.some(c => c.sql.includes('GREATEST(0, thumbs_down - 1)')));
  });

  it('changes vote from up to down', async () => {
    const client = makeClient('up');
    const myVote = await processVote(client, { visitorId: 'v1', songId: 's1', vote: 'down' });

    assert.equal(myVote, 'down');
    assert.ok(client.calls.some(c =>
      c.sql.includes('thumbs_down = thumbs_down + 1') &&
      c.sql.includes('GREATEST(0, thumbs_up - 1)')
    ));
    assert.ok(client.calls.some(c => c.sql.includes('UPDATE user_ratings SET vote')));
  });

  it('changes vote from down to up', async () => {
    const client = makeClient('down');
    const myVote = await processVote(client, { visitorId: 'v1', songId: 's1', vote: 'up' });

    assert.equal(myVote, 'up');
    assert.ok(client.calls.some(c =>
      c.sql.includes('thumbs_up = thumbs_up + 1') &&
      c.sql.includes('GREATEST(0, thumbs_down - 1)')
    ));
  });

  it('rolls back on DB error', async () => {
    const client = {
      calls: [],
      async query(sql) {
        const s = sql.trim();
        client.calls.push(s);
        if (s.startsWith('INSERT INTO ratings')) throw new Error('DB exploded');
        return { rows: [] };
      },
    };

    await assert.rejects(
      () => processVote(client, { visitorId: 'v1', songId: 's1', vote: 'up' }),
      { message: 'DB exploded' }
    );
  });
});
