import React, { useState } from 'react';
import { Transaction, LedgerConfig } from '../types';
import { Panel, Heading, StatLabel, Button, Dot, Icon, ErrorNote, inputStyle } from '../ui/kit';

interface AdvisorsProps {
  token: string;
  transactions: Transaction[];
  config: LedgerConfig[];
}

const SUGGESTIONS = [
  'Where is my money going faster than I thought?',
  'Can I afford a R 12 000 trip in December?',
  'What should I stop paying for?'
];

export function Advisors({ token, transactions, config }: AdvisorsProps) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getPrompt = (key: string, fallback: string) => {
    const found = config.find(c => c.key === key);
    return found ? found.value : fallback;
  };

  const personas = [
    {
      id: 'steady_hand',
      name: 'Steady Hand',
      blurb: 'Calm reading of the day to day. Tells you where you actually stand, without alarm.',
      systemInstruction: getPrompt('prompt_steady_hand', "You are Steady Hand, a calm and reassuring financial advisor. Analyse the user's transactions and answer their question focusing on stability and peace of mind. Write in plain sentences. Do not use exclamation marks or emoji.")
    },
    {
      id: 'true_expenses',
      name: 'True Expenses',
      blurb: 'Looks ahead at what is coming. Sinking funds, annual bills, the December problem.',
      systemInstruction: getPrompt('prompt_true_expenses', "You are True-Expenses Planner, a forward-looking financial advisor. Analyse the user's transactions and answer their question focusing on long-term planning, sinking funds, and preparing for future expenses. Write in plain sentences. Do not use exclamation marks or emoji.")
    },
    {
      id: 'business_books',
      name: 'Business Books',
      blurb: 'Strict on the business side. Margin, deductions, and what the taxman will want.',
      systemInstruction: getPrompt('prompt_business_books', "You are Business Books, a strict, ROI-focused financial advisor. Analyse the user's transactions and answer their question focusing on profitability, tax deductions, and business efficiency. Write in plain sentences. Do not use exclamation marks or emoji.")
    }
  ];

  const [activePersona, setActivePersona] = useState(personas[0].id);
  const active = personas.find(p => p.id === activePersona) || personas[0];

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsAsking(true); setError(null); setAnswer(null);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query, data: transactions, systemInstruction: active.systemInstruction })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'We could not get an answer just now.');
      setAnswer(data.answer);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <div>
      <div style={{ padding: '0 0 var(--nd-s1)' }}>
        <Heading level={2} style={{ fontSize: 20, margin: 0 }}>Advisors</Heading>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--app-ink-muted)', margin: '8px 0 0', maxWidth: '64ch' }}>
          Three ways of reading the same ledger. Pick the one you want to hear from, then ask. Figures are sent for the answer and nothing is stored.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 'var(--nd-gap)' }}>
        {personas.map(p => {
          const on = p.id === activePersona;
          return (
            <button
              key={p.id} type="button" className="rl-card-door"
              onClick={() => { setActivePersona(p.id); setAnswer(null); }}
              aria-pressed={on}
              style={{
                position: 'relative', textAlign: 'left', borderRadius: 0, padding: 'var(--nd-s1)',
                cursor: 'pointer', background: on ? 'var(--nd-paper)' : 'var(--nd-surface)',
                border: 'var(--nd-rule)',
                boxShadow: on ? 'var(--nd-shadow-pressed)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Dot color={on ? 'var(--app-accent)' : 'var(--app-line)'} />
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--app-ink)'
                }}>{p.name}</span>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--app-ink-muted)', margin: '10px 0 0' }}>{p.blurb}</p>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleAsk} style={{ marginTop: 'var(--nd-s1)' }}>
        <Panel>
          <StatLabel size="xs" muted>Your question</StatLabel>
          <div style={{ display: 'flex', gap: 'var(--nd-gap)', marginTop: 'var(--nd-gap)' }}>
            <input
              className="rl-input" type="text" autoComplete="off" id="ask-input"
              placeholder="Where is my money going faster than I thought?"
              value={query} onChange={e => setQuery(e.target.value)} disabled={isAsking}
              style={{ ...inputStyle, height: 44, fontSize: 14 }}
            />
            <Button variant="action" type="submit" disabled={!query.trim() || isAsking} style={{ flex: '0 0 auto' }}>
              {isAsking ? <><Dot size={7} color="var(--nd-paper)" breathe /> Reading</> : <>{Icon.send(13)} Ask</>}
            </Button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--nd-gap)' }}>
            {SUGGESTIONS.map(s => (
              <button
                key={s} type="button" className="nd-chip" onClick={() => setQuery(s)}
                style={{
                  padding: '4px 10px', fontSize: 12, cursor: 'pointer'
                }}
              >{s}</button>
            ))}
          </div>
        </Panel>
      </form>

      {isAsking && (
        <div style={{ marginTop: 'var(--nd-s1)' }}>
          <Panel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)' }}>
              <Dot breathe />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--app-ink-muted)', textTransform: 'uppercase' }}>Reading your ledger. This takes a moment.</span>
            </div>
          </Panel>
        </div>
      )}

      {error && <div style={{ marginTop: 'var(--nd-s1)' }}><ErrorNote title="No answer this time" body={error} /></div>}

      {answer && (
        <div className="rl-enter" style={{
          marginTop: 'var(--nd-s1)', background: 'var(--nd-surface)', border: 'var(--nd-rule)',
          boxShadow: 'var(--nd-shadow)', borderRadius: 0, padding: 'var(--nd-s2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dot />
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
              letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--app-ink)'
            }}>{active.name}</span>
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--app-ink)', margin: '16px 0 0', maxWidth: '70ch', whiteSpace: 'pre-line' }}>
            {answer}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--nd-gap)', marginTop: 'var(--nd-s1)', paddingTop: 'var(--nd-gap)', borderTop: '1px solid var(--app-line)' }}>
            <Button variant="ghost" size="sm" onClick={() => { setAnswer(null); setQuery(''); }}>Ask something else</Button>
          </div>
        </div>
      )}
    </div>
  );
}
