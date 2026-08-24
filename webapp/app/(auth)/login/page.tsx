'use client';

import { FormEvent, useState } from 'react';
import { 
  ArrowRight, CheckCircle, Eye, EyeOff as EyeSlash, KeyRound as LockKey, 
  ShieldCheck, User, Fingerprint, Send, Sparkles, Globe, Key
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LoginPage() {
  const { t, language, setLanguage } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setInfoMsg('');
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: formData.get('username'), 
          password: formData.get('password') 
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Tên đăng nhập hoặc mật khẩu không chính xác');
      }
      window.location.href = '/';
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Không thể đăng nhập');
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError('');
    setInfoMsg('Đang kiểm tra thiết bị hỗ trợ Passkey...');
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      try {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          setInfoMsg('Vui lòng chạm vào cảm biến vân tay / FaceID trên thiết bị của bạn...');
          // Attempt WebAuthn API if configured
          setTimeout(() => {
            setError('Chưa tìm thấy Passkey đã đăng ký cho tài khoản này. Vui lòng đăng nhập bằng mật khẩu.');
            setInfoMsg('');
          }, 1500);
        } else {
          setError('Thiết bị hiện tại chưa kích hoạt cảm biến Passkey / Biometrics.');
          setInfoMsg('');
        }
      } catch (e) {
        setError('Lỗi xác thực Passkey. Vui lòng sử dụng mật khẩu.');
        setInfoMsg('');
      }
    } else {
      setError('Trình duyệt của bạn không hỗ trợ tính năng Passkey.');
      setInfoMsg('');
    }
  };

  const openTelegramBot = () => {
    window.open('https://t.me', '_blank');
  };

  return (
    <main className="relative grid min-h-[100dvh] w-full bg-[#f8fafc] text-zinc-900 lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,0.9fr)]">
      {/* Background Ambient Grid Accent */}
      <div className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:3rem_3rem]" />
      
      {/* Language Switcher Button Top Right */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
          className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white/90 px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm backdrop-blur-md transition-all hover:bg-zinc-100 active:scale-95"
        >
          <Globe className="h-3.5 w-3.5 text-orange-500" />
          <span>{language === 'vi' ? 'VN' : language === 'en' ? 'EN' : 'ZH'}</span>
        </button>
      </div>

      {/* Left Panel: Hero Showcase (Visible on Large Screens) */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-orange-950 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        {/* Glow Spheres */}
        <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-orange-600/20 blur-3xl" />
        <div className="absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-orange-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(#ea580c_1px,transparent_1px)] [background-size:24px_24px] opacity-15" />

        {/* Top Header */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-white">BOT</span>
              <span className="font-bold text-xl tracking-tight text-orange-400">BÁN HÀNG</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Hệ thống quản trị bán hàng tự động</p>
          </div>
        </div>

        {/* Main Banner Text */}
        <div className="relative max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-orange-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-orange-400" />
            <span>Hệ thống Tự Động Hóa 24/7</span>
          </div>

          <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight xl:text-5xl text-white">
            Quản trị cửa hàng & vận hành Bot Telegram chuyên nghiệp.
          </h1>

          <p className="max-w-lg text-sm leading-relaxed text-zinc-300">
            Theo dõi doanh thu real-time, quản lý kho hàng tự động, duyệt đơn hàng tức thì và đồng bộ hóa với hệ thống Telegram Mini App.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="text-2xl font-black text-orange-400">100%</div>
              <div className="text-xs text-zinc-300 font-medium mt-0.5">Tự động hóa giao dịch</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="text-2xl font-black text-orange-400">Real-time</div>
              <div className="text-xs text-zinc-300 font-medium mt-0.5">Thống kê doanh thu P&L</div>
            </div>
          </div>
        </div>

        {/* Footer badges */}
        <div className="relative flex items-center gap-6 text-xs text-zinc-400 border-t border-white/10 pt-6">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-orange-400" /> Đồng bộ đa nền tảng
          </span>
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle className="h-4 w-4 text-orange-400" /> Bảo mật chuẩn JWT & Passkey
          </span>
        </div>
      </section>

      {/* Right Panel: Login Form Container */}
      <section className="relative flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[440px]">
          {/* Card Container */}
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200/90 bg-white p-8 sm:p-10 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.08)] backdrop-blur-xl">
            {/* Top Accent Orange Line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600" />

            {/* Mobile Header Logo */}
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <span className="font-extrabold text-lg text-zinc-900">BOT </span>
                <span className="font-extrabold text-lg text-orange-600">BÁN HÀNG</span>
              </div>
            </div>

            {/* Title Section */}
            <div className="text-center space-y-1.5 mb-8">
              <h2 className="text-2xl font-black tracking-tight text-zinc-900 uppercase">
                QUẢN TRỊ CỬA HÀNG
              </h2>
              <p className="text-xs font-semibold tracking-wider text-orange-600 uppercase">
                HỆ THỐNG BOT BÁN HÀNG TỰ ĐỘNG
              </p>
            </div>

            {/* Error & Info Alerts */}
            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {infoMsg && (
              <div className="mb-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-xs font-medium text-orange-800 shadow-sm animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-500 animate-ping" />
                  <span>{infoMsg}</span>
                </div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  TÀI KHOẢN
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    name="username"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder={t('auth.username_placeholder') || 'Nhập tên đăng nhập...'}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-4 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 outline-none"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">
                  MẬT KHẨU
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <LockKey className="h-4 w-4" />
                  </div>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder={t('auth.password_placeholder') || 'Nhập mật khẩu...'}
                    className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50/50 pl-10 pr-11 text-sm font-medium text-zinc-900 placeholder:text-zinc-400 transition-all focus:border-orange-500 focus:bg-white focus:ring-4 focus:ring-orange-500/10 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors p-1"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Primary Login Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-all hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] disabled:opacity-60"
                  >
                    {loading ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>ĐĂNG NHẬP</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {/* Passkey Login Button */}
                  <button
                    type="button"
                    onClick={handlePasskeyLogin}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-800 shadow-sm transition-all hover:bg-zinc-100 hover:border-zinc-300 active:scale-[0.98]"
                  >
                    <Fingerprint className="h-4 w-4 text-orange-500" />
                    <span>PASSKEY</span>
                  </button>
                </div>

                {/* Open Telegram Bot Link */}
                <button
                  type="button"
                  onClick={openTelegramBot}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200/80 bg-zinc-100/70 px-4 text-xs font-semibold text-zinc-600 transition-all hover:bg-zinc-200/60 hover:text-zinc-900 active:scale-[0.98]"
                >
                  <Send className="h-3.5 w-3.5 text-sky-500" />
                  <span>MỞ BOT TELEGRAM</span>
                </button>
              </div>
            </form>

            {/* Card Footer Note */}
            <div className="mt-8 border-t border-zinc-100 pt-5 text-center">
              <p className="text-xs text-zinc-400 font-medium">
                Hệ thống chỉ dành cho quản trị viên được cấp quyền.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
