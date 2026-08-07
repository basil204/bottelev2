'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { CheckCircle, Key, LogIn as SignIn, Users as UsersThree, CircleAlert as WarningCircle } from 'lucide-react';

declare global {
  interface Window {
    Telegram?: { WebApp: { initData: string; ready: () => void; expand: () => void; close: () => void } };
  }
}

type Action = 'login' | 'join' | 'batch' | 'invite';
type Workspace = { workspace_id: string; name: string; member_cnt: number; member_limit: number; join_link: string };

const parseAccounts = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
  const [email, ...password] = line.split('|');
  return { email: email.trim(), password: password.join('|').trim() };
}).filter(item => item.email && item.password);

export default function CapCutMiniApp() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Action>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [proxy, setProxy] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [accounts, setAccounts] = useState('');
  const [inviteEmails, setInviteEmails] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        setReady(true);
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  const callApi = async (action: Action, payload: Record<string, unknown>) => {
    const initData = window.Telegram?.WebApp.initData || '';
    if (!initData) throw new Error('Hãy mở Mini App từ nút trong bot Telegram.');
    const response = await fetch('/api/miniapp/capcut', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, action, apiKey, payload })
    });
    const data = await response.json();
    if (!response.ok || data.success === false) throw new Error(data.error || data.message || 'Yêu cầu thất bại');
    return data;
  };

  const submit = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      let payload: Record<string, unknown>;
      if (tab === 'login') payload = { email, password, proxy_url: proxy };
      else if (tab === 'join') payload = { invite_link: inviteLink, proxy_url: proxy, accounts: parseAccounts(accounts) };
      else if (tab === 'batch') payload = { mode: 'admin', admin_email: email, admin_password: password, workspace_id: workspaceId, proxy_url: proxy, accounts: parseAccounts(accounts) };
      else payload = { email, password, workspace_id: workspaceId, proxy_url: proxy, emails: inviteEmails.split(/\r?\n|,/).map(v => v.trim()).filter(Boolean) };
      const data = await callApi(tab, payload);
      setResult(data);
      if (tab === 'login') {
        setApiKey(data.api_key || '');
        setWorkspaces(Array.isArray(data.workspaces) ? data.workspaces : []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Có lỗi xảy ra');
    } finally { setLoading(false); }
  };

  const tabs: { id: Action; label: string }[] = [
    { id: 'login', label: 'Admin' }, { id: 'join', label: 'Join link' },
    { id: 'batch', label: 'Batch join' }, { id: 'invite', label: 'Mời email' }
  ];

  return (
    <main className="min-h-[100dvh] bg-[#f4f7f5] px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-zinc-900">
      <Script src="https://telegram.org/js/telegram-web-app.js?61" strategy="afterInteractive" />
      <div className="mx-auto max-w-xl">
        <header className="mb-5 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#17623f] text-white"><UsersThree size={22} /></div>
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-emerald-700">Telegram Mini App</p><h1 className="text-xl font-bold tracking-tight">CapCut Workspace</h1></div>
        </header>

        {!ready && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Đang xác thực phiên Telegram...</div>}
        <div className="mb-4 grid grid-cols-4 gap-1 rounded-xl border border-zinc-200 bg-white p-1">
          {tabs.map(item => <button key={item.id} type="button" onClick={() => { setTab(item.id); setError(''); setResult(null); }} className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition active:scale-[.98] ${tab === item.id ? 'bg-[#17623f] text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}>{item.label}</button>)}
        </div>

        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_18px_45px_-32px_rgba(20,70,45,.45)]">
          {(tab === 'login' || tab === 'batch' || tab === 'invite') && <div className="grid gap-4 sm:grid-cols-2"><Field label="Email Admin" value={email} onChange={setEmail} type="email" /><Field label="Mật khẩu Admin" value={password} onChange={setPassword} type="password" /></div>}
          <Field label="Proxy URL" value={proxy} onChange={setProxy} placeholder="http://user:pass@host:port" />
          {tab === 'join' && <><Field label="API key" value={apiKey} onChange={setApiKey} type="password" placeholder="capcut_sec_..." /><Field label="Invite link" value={inviteLink} onChange={setInviteLink} placeholder="https://www.capcut.com/t/..." /></>}
          {(tab === 'batch' || tab === 'invite') && <Field label="Workspace ID" value={workspaceId} onChange={setWorkspaceId} />}
          {(tab === 'join' || tab === 'batch') && <Area label="Tài khoản thành viên" value={accounts} onChange={setAccounts} placeholder={'email1@gmail.com|password1\nemail2@gmail.com|password2'} />}
          {tab === 'invite' && <Area label="Email thành viên" value={inviteEmails} onChange={setInviteEmails} placeholder={'member1@gmail.com\nmember2@gmail.com'} />}

          {workspaces.length > 0 && tab === 'login' && <div className="space-y-2 border-t border-zinc-100 pt-4"><p className="text-sm font-semibold">Workspace đã tìm thấy</p>{workspaces.map(ws => <button key={ws.workspace_id} type="button" onClick={() => { setWorkspaceId(ws.workspace_id); setInviteLink(ws.join_link); setTab('join'); }} className="flex w-full items-center justify-between rounded-xl border border-zinc-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50"><span><b className="block text-sm">{ws.name}</b><small className="text-zinc-500">{ws.member_cnt}/{ws.member_limit} thành viên</small></span><span className="text-xs font-semibold text-emerald-700">Chọn</span></button>)}</div>}
          {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><WarningCircle size={20} className="shrink-0" />{error}</div>}
          {result && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle size={19} />Xử lý thành công</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs text-emerald-950">{JSON.stringify(result, null, 2)}</pre></div>}
          <button type="button" disabled={loading || !ready} onClick={submit} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17623f] px-4 text-sm font-bold text-white transition hover:bg-[#1d714a] active:scale-[.98] disabled:opacity-50">{tab === 'login' ? <SignIn size={19} /> : <Key size={19} />}{loading ? 'Đang xử lý...' : tabs.find(item => item.id === tab)?.label}</button>
        </section>
        <p className="mt-4 text-center text-xs leading-5 text-zinc-500">Mật khẩu và proxy chỉ được chuyển tới API CapCut trong yêu cầu hiện tại, không lưu trên trình duyệt.</p>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block space-y-2"><span className="text-sm font-semibold text-zinc-700">{label}</span><input type={type} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} autoComplete="off" className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" /></label>;
}
function Area({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block space-y-2"><span className="text-sm font-semibold text-zinc-700">{label}</span><textarea rows={5} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="w-full resize-y rounded-xl border border-zinc-200 bg-white p-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" /></label>;
}
