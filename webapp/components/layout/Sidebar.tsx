'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  Archive, Landmark as Bank, Bell, ChartNoAxesColumn as ChartBar, CheckCircle,
  Mail as Envelope, Folders, Settings as GearSix, Globe, Menu as List, Package,
  ShieldCheck, ShoppingCart, LogOut as SignOut, LayoutDashboard as SquaresFour,
  UserCog as UserGear, Users as UsersThree, Wallet,
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
      label: 'Tổng quan',
      items: [
        { name: t('sidebar.dashboard'), href: '/', icon: SquaresFour },
        { name: t('sidebar.users'), href: '/users', icon: UsersThree },
        { name: t('sidebar.notifications'), href: '/notifications', icon: Bell },
      ],
    },
    {
      label: 'Kinh doanh',
      items: [
        { name: t('sidebar.products'), href: '/products', icon: Package },
        { name: t('sidebar.categories'), href: '/categories', icon: Folders },
        { name: t('sidebar.orders'), href: '/orders', icon: ShoppingCart },
        { name: t('sidebar.deposits'), href: '/deposits', icon: Wallet },
        { name: 'Lịch sử ngân hàng', href: '/bank-history', icon: Bank },
      ],
    },
    {
      label: 'Dịch vụ',
      items: [
        { name: 'Gmail EDU', href: '/gmail-edu', icon: Envelope },
        { name: 'Kiểm tra Gmail', href: '/check-gmail', icon: CheckCircle },
        { name: t('sidebar.stored-accounts'), href: '/stored-accounts', icon: Archive },
      ],
    },
    {
      label: 'Quản trị',
      items: [
        { name: 'Thống kê Admin', href: '/admin-stats', icon: ChartBar },
        { name: 'Quản lý Admin', href: '/admin-accounts', icon: UserGear, superAdminOnly: true },
        { name: t('sidebar.settings'), href: '/settings', icon: GearSix },
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
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <Button variant="outline" size="icon" onClick={() => setIsOpen((open) => !open)} aria-label="Mở điều hướng" className="border-zinc-200 bg-white/90 text-zinc-800 backdrop-blur-xl hover:bg-zinc-200/70">
          <List size={18} />
        </Button>
      </div>

      <aside className={clsx('fixed inset-y-0 left-0 z-40 w-[17rem] border-r border-zinc-200/80 bg-white/95 backdrop-blur-xl transition-transform duration-300 ease-out md:translate-x-0', isOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-full flex-col">
          <div className="flex h-[4.5rem] items-center gap-3 border-b border-zinc-200/80 px-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-[#07100b] shadow-[inset_0_1px_0_rgba(255,255,255,.3)]"><ShieldCheck size={19} /></div>
            <div><p className="text-[15px] font-bold tracking-tight text-zinc-900">Bot Tele</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">Operations console</p></div>
          </div>

          <div className="custom-scrollbar flex-1 overflow-y-auto px-3 py-4">
            <nav className="space-y-5">
              {navigation.map((section) => (
                <div key={section.label}>
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-700">{section.label}</p>
                  <div className="space-y-0.5">
                    {section.items.filter((item) => !item.superAdminOnly || adminRole === 'super_admin').map((item) => {
                      const active = pathname === item.href;
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)} className={clsx('group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 active:scale-[0.99]', active ? 'bg-emerald-400/[0.10] text-emerald-700 shadow-[inset_0_0_0_1px_rgba(52,211,153,.07)]' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800')}>
                          <item.icon size={17} className={clsx('shrink-0 transition-transform group-hover:translate-x-0.5', active ? 'text-emerald-700' : 'text-zinc-600 group-hover:text-zinc-400')} />
                          <span className="truncate">{item.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="space-y-1 border-t border-zinc-200/80 bg-black/10 p-3">
            <Button variant="ghost" className="w-full justify-start gap-3 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800" onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}><Globe size={17} className="text-emerald-700" />{language === 'vi' ? 'Tiếng Việt' : 'English'}</Button>
            <Button variant="ghost" className="w-full justify-start gap-3 text-red-400 hover:bg-red-400/[0.08] hover:text-red-300" onClick={handleLogout} disabled={loggingOut}><SignOut size={17} />{loggingOut ? 'Đang đăng xuất...' : t('sidebar.logout')}</Button>
          </div>
        </div>
      </aside>

      {isOpen && <button className="fixed inset-0 z-30 bg-zinc-950/35 backdrop-blur-sm md:hidden" onClick={() => setIsOpen(false)} aria-label="Đóng điều hướng" />}
    </>
  );
}
