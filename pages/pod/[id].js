import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function Pod() {
  const router = useRouter();
  const { id } = router.query;

  const [session, setSession] = useState(null);
  const [pod, setPod] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [spotInput, setSpotInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  useEffect(() => {
    if (!id) return;

    supabase.from('pods').select('*').eq('id', id).single().then(({ data }) => setPod(data));
    supabase.from('profiles').select('*').eq('pod_id', id).then(({ data }) => setMembers(data || []));
    supabase
      .from('messages')
      .select('*')
      .eq('pod_id', id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data || []));

    const channel = supabase
      .channel(`pod-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `pod_id=eq.${id}` },
        (payload) => setMessages((prev) => [...prev, payload.new])
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!text.trim() || !session) return;
    await supabase.from('messages').insert({
      pod_id: id,
      user_id: session.user.id,
      name: session.user.email.split('@')[0],
      body: text.trim(),
    });
    setText('');
  }

  async function saveMeetingSpot(e) {
    e.preventDefault();
    if (!spotInput.trim()) return;
    const { error } = await supabase.from('pods').update({ meeting_spot: spotInput.trim() }).eq('id', id);
    if (error) {
      alert('Could not save that: ' + error.message);
      return;
    }
    setPod((prev) => ({ ...prev, meeting_spot: spotInput.trim() }));
    setSpotInput('');
  }

  if (!pod) return <div className="wrap">Loading…</div>;

  return (
    <div className="wrap">
      <h1>{pod.activity} Pod</h1>
      <div className="card">
        <p style={{ color: 'var(--text-soft)', fontSize: 13, fontWeight: 600 }}>
          {pod.days.join(' & ').toUpperCase()} · {pod.time_slot.split(' (')[0].toUpperCase()}
        </p>
        <p>{members.map((m) => m.name).join(', ')}</p>
      </div>

      <div className="card">
        <h3>Meeting spot</h3>
        {pod.meeting_spot ? (
          <>
            <p>{pod.meeting_spot}</p>
            <iframe
              title="Meeting spot map"
              width="100%"
              height="220"
              style={{ border: 0, borderRadius: 4 }}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(pod.meeting_spot)}&output=embed`}
            />
            <p style={{ marginTop: 10 }}>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pod.meeting_spot)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Get directions
              </a>
            </p>
          </>
        ) : (
          <form onSubmit={saveMeetingSpot} style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              value={spotInput}
              onChange={(e) => setSpotInput(e.target.value)}
              placeholder="e.g. Fuller Park, main entrance"
            />
            <button type="submit">Set spot</button>
          </form>
        )}
      </div>

      <div className="card">
        <h3>Pod chat</h3>
        <div>
          {messages.map((m) => (
            <div className="msg" key={m.id}>
              <b>{m.name}:</b> {m.body}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={sendMessage} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Say hey to your pod..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  );
}
