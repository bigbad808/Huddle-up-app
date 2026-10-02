import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const ACTIVITIES = ['Running', 'Lifting', 'Cycling', 'Yoga', 'Basketball', 'Swimming'];
const LEVELS = ['New to it', 'Casual', 'Regular', 'Experienced'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIMES = ['Early morning (6-8am)', 'Midday (11am-1pm)', 'Evening (5-7pm)', 'Night (7-9pm)'];

export default function Home() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [sentLink, setSentLink] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activity, setActivity] = useState('');
  const [level, setLevel] = useState('');
  const [days, setDays] = useState([]);
  const [time, setTime] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [session]);

  async function sendMagicLink(e) {
    e.preventDefault();
    await supabase.auth.signInWithOtp({ email });
    setSentLink(true);
  }

  async function submitProfile(e) {
    e.preventDefault();
    if (!activity || !level || !time || days.length === 0) {
      alert('Fill in all fields and pick at least one day.');
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        user_id: session.user.id,
        name: session.user.email.split('@')[0],
        activity,
        level,
        days,
        time_slot: time,
        city,
      })
      .select()
      .single();
    if (error) {
      alert('Something went wrong: ' + error.message);
      return;
    }
    setProfile(data);
  }

  function toggleDay(d) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function upgrade() {
    const res = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert('Something went wrong starting checkout: ' + (data.error || 'unknown error'));
    }
  }

  function PremiumBadge() {
    if (!profile) return null;
    return profile.is_premium ? (
      <p style={{ color: 'var(--secondary)', fontWeight: 600, fontSize: 14 }}>⭐ Premium member</p>
    ) : (
      <div className="card">
        <p style={{ marginBottom: 10 }}>Free plan — skip the matching queue and get priority pod placement.</p>
        <button onClick={upgrade}>Upgrade — $7/mo</button>
      </div>
    );
  }

  if (loading) return <div className="wrap">Loading…</div>;

  if (!session) {
    return (
      <div className="wrap">
        <h1>Huddle Up</h1>
        <p>Sign in with your email to find your pod. No password — we'll send you a link.</p>
        {sentLink ? (
          <p>Check your email for a sign-in link.</p>
        ) : (
          <form onSubmit={sendMagicLink}>
            <fieldset>
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </fieldset>
            <button type="submit">Send me a link</button>
          </form>
        )}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="wrap">
        <h1>Find your pod</h1>
        <p>Tell us how you like to move.</p>
        <form onSubmit={submitProfile}>
          <fieldset>
            <legend>Activity</legend>
            <select value={activity} onChange={(e) => setActivity(e.target.value)} required>
              <option value="" disabled>Choose an activity</option>
              {ACTIVITIES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </fieldset>
          <fieldset>
            <legend>Level</legend>
            <select value={level} onChange={(e) => setLevel(e.target.value)} required>
              <option value="" disabled>Choose your level</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </fieldset>
          <fieldset>
            <legend>Which days work?</legend>
            <div className="chips">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className={`chip ${days.includes(d) ? 'selected' : ''}`}
                  onClick={() => toggleDay(d)}
                >
                  {d}
                </div>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Time of day</legend>
            <select value={time} onChange={(e) => setTime(e.target.value)} required>
              <option value="" disabled>Choose a time</option>
              {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </fieldset>
          <fieldset>
            <legend>City (optional)</legend>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Denver, CO" />
          </fieldset>
          <button type="submit">Find my pod</button>
        </form>
      </div>
    );
  }

  if (!profile.pod_id) {
    return (
      <div className="wrap">
        <h1>You're in the queue</h1>
        <PremiumBadge />
        <div className="card">
          <p>We'll group you with 2–4 other people who picked {profile.activity}, {profile.time_slot}, on {profile.days.join(', ')}.</p>
          <p style={{ color: 'var(--text-soft)' }}>
            Matching runs automatically every 15 minutes while enough people are signed up.
            Nobody is matched until there are at least 3 people with a compatible schedule.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <h1>You're matched</h1>
      <PremiumBadge />
      <p>Head to your pod to see who's in it and say hello.</p>
      <a className="btn" href={`/pod/${profile.pod_id}`}>Go to my pod</a>
    </div>
  );
}
