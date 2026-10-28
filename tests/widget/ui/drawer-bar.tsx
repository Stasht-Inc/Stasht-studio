// Dev-only harness for tests/widget/ui/shots.mjs (ClickUp wdy2xh2upu): the lead drawer's Website chat bar in
// each state, above a composer like the drawer's. Not part of the app build (Vite builds index.html only).
import { createRoot } from 'react-dom/client';
import '../../../styles/globals.css';
import { WidgetAiBar } from '../../../components/LeadDetailDrawer';
import type { WidgetAiState } from '../../../services/leadsAPI';

const states: [string, WidgetAiState][] = [
  ['Chip answers', { ai_enabled: true, assistant_name: 'Chip', handled_by: null }],
  ['You took over', { ai_enabled: true, assistant_name: 'Chip', handled_by: { user_id: 1, name: 'Chris', is_me: true } }],
  ['A teammate took over', { ai_enabled: true, assistant_name: 'Chip', handled_by: { user_id: 2, name: 'Sam', is_me: false } }],
];

function Composer({ title, state }: { title: string; state: WidgetAiState }) {
  return (
    <section className="mb-6" data-state={title}>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      <div className="px-6 pt-4 pb-5 bg-white border border-gray-200 rounded-xl">
        <WidgetAiBar state={state} assistantName={state.assistant_name} busy={false} onTakeOver={() => {}} onHandBack={() => {}} />
        <div className="border border-gray-200 rounded-2xl bg-white px-5 pt-4 pb-4 shadow-sm">
          <textarea rows={3} placeholder="Type a message to Jordan..." className="w-full text-base text-gray-700 placeholder:text-gray-400 resize-none rounded-xl bg-gray-50 border border-gray-200 px-4 py-3" />
          <div className="mt-3 flex justify-end text-sm text-gray-600"><span className="bg-gray-100 rounded-lg px-3 py-2">via Website chat</span></div>
        </div>
      </div>
    </section>
  );
}

createRoot(document.getElementById('root')!).render(
  <main className="min-h-screen bg-gray-100 p-8" style={{ width: 760 }}>
    {states.map(([title, state]) => <Composer key={title} title={title} state={state} />)}
  </main>,
);
