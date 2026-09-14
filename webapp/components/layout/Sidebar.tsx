'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  BarChart2, FileText, Package, Folders, ShoppingCart, Clock,
  Wallet, CreditCard, CheckSquare, Zap, Ticket, HelpCircle, MessageSquare,
  Bell, Target, Settings, Code2, Layers, Globe, Languages, Link as LinkIcon,
  Plug, Key, Handshake, UserCog, ShieldCheck, LogOut, Menu, X, Video, Film, Palette,
  Users, ArrowDownCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [adminRole, setAdminRole] = useState('admin');
  const { t, language, setLanguage } = useLanguage();

  useEffect(() => {
    const roleCookie = document.cookie.split(';').find((cookie) => cookie.trim().startsWith('admin_role='));
    if (roleCookie) setAdminRole(roleCookie.trim().split('=')[1]);
  }, []);

  const navigation = [
    {
      label: 'TỔNG QUAN & BÁO CÁO',
      items: [
        { name: 'BÁO CÁO THÁNG', href: '/', icon: BarChart2 },
        { name: 'NHẬT KÝ', href: '/admin-logs', icon: FileText },
      ],
    },
    {
      label: 'QUẢN LÝ BÁN HÀNG & KHÁCH HÀNG',
      items: [
        { name: 'NGƯỜI DÙNG', href: '/users', icon: Users },
        { name: 'QUẢN LÝ VÍ', href: '/wallets', icon: Wallet },
        { name: 'LỊCH SỬ NẠP TIỀN', href: '/deposits', icon: ArrowDownCircle },
        { name: 'LỊCH SỬ BANK', href: '/bank-history', icon: CreditCard },
        { name: 'ĐIỂM DANH HÀNG NGÀY', href: '/checkin', icon: CheckSquare },
        { name: 'SẢN PHẨM', href: '/products', icon: Package },
        { name: 'DANH MỤC SẢN PHẨM', href: '/categories', icon: Folders },
        { name: 'ĐƠN HÀNG', href: '/orders', icon: ShoppingCart },
        { name: 'ĐẶT TRƯỚC', href: '/preorders', icon: Clock },
        { name: 'FLASH SALE', href: '/promotions', icon: Zap },
        { name: 'MÃ GIẢM GIÁ', href: '/promotions', icon: Ticket },
        { name: 'HỖ TRỢ / BẢO HÀNH', href: '/notifications', icon: HelpCircle },
        { name: 'TRÒ CHUYỆN / CHAT', href: '/notifications', icon: MessageSquare },
        { name: 'THÔNG BÁO', href: '/notifications', icon: Bell },
        { name: 'CHIẾN DỊCH RE-TARGETING', href: '/notifications', icon: Target },
      ],
    },
    {
      label: 'CẤU HÌNH & TÙY BIẾN',
      items: [
        { name: 'CẤU HÌNH BOT', href: '/settings', icon: Settings },
        { name: 'NÚT BẤM & NỘI DUNG BOT', href: '/start-menu', icon: MessageSquare },
        { name: 'API KEY USER', href: '/user-api-keys', icon: Key },
      ],
    },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen((open) => !open)}
          aria-label="Mở điều hướng"
          className="border-zinc-200 bg-white/90 text-zinc-800 backdrop-blur-xl hover:bg-zinc-200/70"
        >
          {isOpen ? <X size={18} /> : <Menu size={18} />}
        </Button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-[17.5rem] border-r border-zinc-200/80 bg-white shadow-2xl transition-transform duration-300 ease-out md:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header Brand */}
          <div className="flex h-[4.5rem] items-center gap-3 border-b border-zinc-200/80 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md shadow-orange-500/20">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-base text-zinc-900 tracking-tight">BOT</span>
                <span className="font-extrabold text-base text-orange-600 tracking-tight">BÁN HÀNG</span>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Quản trị ứng dụng</p>
            </div>
          </div>

          {/* Nav List */}
          <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-5">
            <nav className="space-y-6">
              {navigation.map((section) => (
                <div key={section.label} className="space-y-2">
                  <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-amber-900/60">
                    {section.label}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => {
                        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={clsx(
                              'group relative flex items-center gap-3 rounded-r-xl px-3 py-2.5 text-xs font-extrabold transition-all duration-200 active:scale-[0.99]',
                              active
                                ? 'border-l-4 border-zinc-900 bg-zinc-100 text-zinc-900 shadow-2xs font-black'
                                : 'text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-900'
                            )}
                          >
                            <item.icon
                              size={16}
                              className={clsx(
                                'shrink-0 transition-transform group-hover:scale-110',
                                active ? 'text-zinc-900 font-bold' : 'text-zinc-400 group-hover:text-zinc-700'
                              )}
                            />
                            <span className="truncate uppercase tracking-tight">{item.name}</span>
                          </Link>
                        );
                      })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          {/* Footer Actions */}
          <div className="space-y-1 border-t border-zinc-200/80 bg-zinc-50/60 p-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
            >
              <Globe size={16} className="text-orange-600" />
              {language === 'vi' ? 'Tiếng Việt (VN)' : 'English (EN)'}
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut size={16} />
              {loggingOut ? 'Đang đăng xuất...' : t('sidebar.logout') || 'Đăng xuất'}
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay Backdrop for Mobile */}
      {isOpen && (
        <button
          className="fixed inset-0 z-40 bg-zinc-950/40 backdrop-blur-xs md:hidden"
          onClick={() => setIsOpen(false)}
          aria-label="Đóng điều hướng"
        />
      )}
    </>
  );
}
