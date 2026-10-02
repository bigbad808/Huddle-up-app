import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MIN_POD_SIZE = 3;
const MAX_POD_SIZE = 5;

function keyFor(profile) {
  const days = [...profile.days].sort().join(',');
  return `${profile.activity}|${days}|${profile.time_slot}`;
}

export default async function handler(req, res) {
  if (process.env.MATCH_SECRET && req.query.secret !== process.env.MATCH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: unmatched, error } = await admin
    .from('profiles')
    .select('*')
    .is('pod_id', null);

  if (error) return res.status(500).json({ error: error.message });

  const groups = {};
  for (const profile of unmatched) {
    const key = keyFor(profile);
    if (!groups[key]) groups[key] = [];
    groups[key].push(profile);
  }

  const podsCreated = [];

  for (const key of Object.keys(groups)) {
    let pool = groups[key];
    while (pool.length >= MIN_POD_SIZE) {
      const batch = pool.splice(0, MAX_POD_SIZE);
      if (batch.length < MIN_POD_SIZE) break;

      const sample = batch[0];
      const { data: pod, error: podErr } = await admin
        .from('pods')
        .insert({ activity: sample.activity, days: sample.days, time_slot: sample.time_slot })
        .select()
        .single();

      if (podErr) continue;

      const ids = batch.map((p) => p.id);
      await admin.from('profiles').update({ pod_id: pod.id }).in('id', ids);
      podsCreated.push({ pod_id: pod.id, members: batch.map((p) => p.name) });
    }
  }

  return res.status(200).json({ podsCreated, remainingUnmatchedGroups: Object.keys(groups).length });
}
