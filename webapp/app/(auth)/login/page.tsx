'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle, Eye, EyeOff as EyeSlash, KeyRound as LockKey, ShieldCheck, User } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LoginPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.get('username'), password: formData.get('password') }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Thông tin đăng nhập không chính xác');
      window.location.href = '/';
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Không thể đăng nhập');
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-[100dvh] bg-[#f5f4ee] lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)]">
      <section className="relative hidden overflow-hidden border-r border-zinc-200/80 bg-[#173c2b] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full border border-white/10" />
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#173c2b]"><ShieldCheck size={21} /></div><div><p className="text-sm font-semibold">Bot Tele</p><p className="text-[10px] uppercase tracking-[0.18em] text-white/50">Operations workspace</p></div></div>
        <div className="relative max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200/70">Quản trị tập trung</p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.045em] xl:text-5xl">Mọi hoạt động kinh doanh, trong một không gian rõ ràng.</h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-white/55">Theo dõi doanh thu, quản lý sản phẩm và vận hành các dịch vụ Telegram với dữ liệu cập nhật liên tục.</p>
        </div>
        <div className="relative flex gap-8 text-xs text-white/55"><span className="flex items-center gap-2"><CheckCircle size={15} className="text-emerald-300" />Dữ liệu trực tiếp</span><span className="flex items-center gap-2"><CheckCircle size={15} className="text-emerald-300" />Truy cập bảo mật</span></div>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173c2b] text-white"><ShieldCheck size={21} /></div><p className="font-semibold text-zinc-900">Bot Tele</p></div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Tài khoản quản trị</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-zinc-950">{t('auth.login_title')}</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500">{t('auth.login_subtitle')}</p>

          {error && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block space-y-2"><span className="text-xs font-semibold text-zinc-700">Tên đăng nhập</span><div className="relative"><User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" /><input name="username" required autoComplete="username" placeholder={t('auth.username_placeholder')} className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-11 pr-4 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-700/40 focus:ring-4 focus:ring-emerald-700/[0.07]" /></div></label>
            <label className="block space-y-2"><span className="text-xs font-semibold text-zinc-700">Mật khẩu</span><div className="relative"><LockKey size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" /><input name="password" required autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder={t('auth.password_placeholder')} className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-11 pr-12 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-emerald-700/40 focus:ring-4 focus:ring-emerald-700/[0.07]" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>{showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}</button></div></label>
            <button type="submit" disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173c2b] px-4 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(23,60,43,.8)] transition hover:bg-[#204d39] active:scale-[0.99] disabled:opacity-60">{loading ? t('auth.signing_in') : t('auth.sign_in')}<ArrowRight size={17} /></button>
          </form>
          <p className="mt-8 text-center text-xs text-zinc-400">Chỉ dành cho nhân sự được cấp quyền truy cập.</p>
        </div>
      </section>
    </main>
  );
}
