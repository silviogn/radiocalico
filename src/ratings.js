export async function processVote(client, { visitorId, songId, vote }) {
  if (vote !== 'up' && vote !== 'down') {
    throw Object.assign(new Error('vote must be "up" or "down"'), { status: 400 });
  }

  await client.query('BEGIN');

  await client.query(
    `INSERT INTO ratings (song_id, thumbs_up, thumbs_down)
       VALUES ($1, 0, 0) ON CONFLICT (song_id) DO NOTHING`,
    [songId]
  );

  const existing = await client.query(
    'SELECT vote FROM user_ratings WHERE visitor_id = $1 AND song_id = $2',
    [visitorId, songId]
  );

  let myVote = null;

  if (existing.rows.length === 0) {
    const col = vote === 'up' ? 'thumbs_up' : 'thumbs_down';
    await client.query(`UPDATE ratings SET ${col} = ${col} + 1 WHERE song_id = $1`, [songId]);
    await client.query(
      'INSERT INTO user_ratings (visitor_id, song_id, vote) VALUES ($1, $2, $3)',
      [visitorId, songId, vote]
    );
    myVote = vote;
  } else if (existing.rows[0].vote === vote) {
    const col = vote === 'up' ? 'thumbs_up' : 'thumbs_down';
    await client.query(`UPDATE ratings SET ${col} = GREATEST(0, ${col} - 1) WHERE song_id = $1`, [songId]);
    await client.query(
      'DELETE FROM user_ratings WHERE visitor_id = $1 AND song_id = $2',
      [visitorId, songId]
    );
    myVote = null;
  } else {
    const addCol    = vote === 'up' ? 'thumbs_up'   : 'thumbs_down';
    const removeCol = vote === 'up' ? 'thumbs_down' : 'thumbs_up';
    await client.query(
      `UPDATE ratings SET ${addCol} = ${addCol} + 1, ${removeCol} = GREATEST(0, ${removeCol} - 1) WHERE song_id = $1`,
      [songId]
    );
    await client.query(
      'UPDATE user_ratings SET vote = $1 WHERE visitor_id = $2 AND song_id = $3',
      [vote, visitorId, songId]
    );
    myVote = vote;
  }

  await client.query('COMMIT');

  return myVote;
}
