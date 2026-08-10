'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw as ArrowClockwise, ArrowRight, ChartNoAxesCombined as ChartLineUp,
  CheckCircle, Cpu, Database, Mail as EnvelopeSimple, Server as HardDrives,
  Package, Receipt, ShoppingCart, TrendingUp as TrendUp, Users, Wallet,
  CircleAlert as WarningCircle,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';

interface ProductRevenue { product_id: number; product_name: string; order_count: number; total_revenue: number }
interface InventoryAlert { id: number; name: string; stock: number; low_stock_threshold: number; stock_status: 'low' | 'out' }
interface DashboardStats {
  totalUsers: number; totalRevenue: number; totalDeposits: number; todayDeposits: number;
  monthDeposits: number; totalOrders: number; revenueChart: { date: string; total: number }[];
  productRevenue: ProductRevenue[];
  inventoryAlerts: InventoryAlert[];
  pendingDeposits: number; pendingDepositAmount: number;
}
interface SystemInfo { usagePercent: number; usedGB: string; totalGB: string; freeGB: string; botUsername?: string }
interface GmailSale { id: number; email: string; sold_at: string; buyer_username: string; buyer_telegram_id: string; price: number }
interface GmailSummary { totalSold: number; totalRevenue: number; pricePerAccount: number }
type Period = 'all' | 'today' | 'week' | 'month';

const periodOptions: { value: Period; label: string }[] = [
  { value: 'today', label: 'Hôm nay' }, { value: 'week', label: '7 ngày' },
  { value: 'month', label: 'Tháng này' }, { value: 'all', label: 'Tất cả' },
];

function DashboardSkeleton() {
  return <div className="space-y-8" aria-label="Đang tải dữ liệu"><div className="h-72 animate-pulse rounded-[28px] bg-zinc-200/70" /><div className="grid gap-6 xl:grid-cols-[1fr_340px]"><div className="h-[440px] animate-pulse rounded-3xl bg-zinc-100" /><div className="h-[440px] animate-pulse rounded-3xl bg-zinc-100" /></div></div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="flex min-h-36 flex-col items-center justify-center gap-3 border border-dashed border-zinc-200 bg-zinc-50 px-6 text-center"><ChartLineUp size={19} className="text-zinc-400" /><p className="text-xs text-zinc-500">{label}</p></div>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [system, setSystem] = useState<SystemInfo | null>(null);
  const [gmailSales, setGmailSales] = useState<GmailSale[]>([]);
  const [gmailSummary, setGmailSummary] = useState<GmailSummary | null>(null);
  const [products, setProducts] = useState<ProductRevenue[]>([]);
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { formatPrice } = useCurrency();

  const loadDashboard = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const [statsResponse, systemResponse] = await Promise.all([fetch('/api/stats', { cache: 'no-store' }), fetch('/api/system-info', { cache: 'no-store' })]);
      if (!statsResponse.ok) throw new Error('Không thể tải dữ liệu tổng quan');
      const statsData: DashboardStats = await statsResponse.json();
      setStats(statsData); setProducts(statsData.productRevenue || []);
      if (systemResponse.ok) setSystem(await systemResponse.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Đã xảy ra lỗi không xác định');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  const loadFilteredData = useCallback(async (selectedPeriod: Period) => {
    setSectionLoading(true);
    try {
      const [productResponse, gmailResponse] = await Promise.all([fetch(`/api/product-revenue?filter=${selectedPeriod}`, { cache: 'no-store' }), fetch(`/api/gmail-edu-revenue?filter=${selectedPeriod}`, { cache: 'no-store' })]);
      if (productResponse.ok) { const data = await productResponse.json(); setProducts(data.productRevenue || []); }
      if (gmailResponse.ok) { const data = await gmailResponse.json(); setGmailSales(data.data || []); setGmailSummary(data.summary || null); }
    } finally { setSectionLoading(false); }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);
  useEffect(() => { loadFilteredData(period); }, [loadFilteredData, period]);

  const todayLabel = useMemo(() => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date()), []);
  const maxProductRevenue = Math.max(...products.map((item) => Number(item.total_revenue)), 1);
  const botUsername = system?.botUsername || 'autobasilbot';

  if (loading) return <DashboardSkeleton />;
  if (error || !stats) return <div className="flex min-h-[55dvh] items-center justify-center"><div className="max-w-md border border-red-200 bg-red-50 p-8 text-center"><WarningCircle size={30} className="mx-auto text-red-500" /><h1 className="mt-4 text-lg font-semibold text-zinc-900">Không thể mở Dashboard</h1><p className="mt-2 text-sm text-zinc-500">{error}</p><button onClick={() => loadDashboard()} className="mt-6 inline-flex h-9 items-center gap-2 rounded-full bg-emerald-800 px-4 text-sm font-semibold text-white active:scale-[0.98]"><ArrowClockwise size={16} /> Thử lại</button></div></div>;

  const metrics = [
    { label: 'Doanh thu hôm nay', value: formatPrice(stats.todayDeposits), note: 'Dòng tiền trong ngày', icon: Wallet },
    { label: 'Doanh thu tháng', value: formatPrice(stats.monthDeposits), note: 'Tổng tiền đã ghi nhận', icon: TrendUp },
    { label: 'Đơn hàng', value: stats.totalOrders.toLocaleString('vi-VN'), note: 'Toàn bộ thời gian', icon: ShoppingCart },
    { label: 'Người dùng', value: stats.totalUsers.toLocaleString('vi-VN'), note: 'Tài khoản đã đăng ký', icon: Users },
  ];

  return <div className="pb-8">
    <section className="relative overflow-hidden rounded-[28px] bg-[#17231d] px-5 py-6 text-white shadow-[0_30px_80px_-48px_rgba(23,35,29,.8)] sm:px-8 sm:py-8 lg:px-10">
      <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border border-white/[0.06]" /><div className="pointer-events-none absolute -right-6 -top-16 h-52 w-52 rounded-full border border-white/[0.06]" />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)] lg:items-end">
        <div><div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80"><span className="h-px w-7 bg-emerald-300/70" /> Trung tâm vận hành</div><h1 className="mt-5 max-w-2xl text-3xl font-semibold tracking-[-0.055em] text-white md:text-[2.7rem] md:leading-[1.05]">Nắm toàn bộ hoạt động kinh doanh trong một nhịp nhìn.</h1><p className="mt-4 text-sm capitalize text-zinc-400">{todayLabel} · Dữ liệu cập nhật theo thời gian thực</p></div>
        <div className="flex flex-col gap-3 lg:items-end"><div className="flex items-center gap-2 text-xs text-zinc-400"><span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-emerald-300/50" /><span className="relative h-2 w-2 rounded-full bg-emerald-300" /></span> Các dịch vụ đang trực tuyến</div><div className="flex flex-wrap gap-2"><a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full border border-white/10 bg-white/[0.06] px-4 text-xs font-medium text-zinc-200 transition hover:bg-white/10 active:scale-[0.98]">@{botUsername}</a><button onClick={() => loadDashboard(true)} disabled={refreshing} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#b8e5c8] px-4 text-xs font-semibold text-[#17231d] transition hover:bg-[#c8efd5] disabled:opacity-60 active:scale-[0.98]"><ArrowClockwise size={15} className={refreshing ? 'animate-spin' : ''} /> Cập nhật dữ liệu</button></div></div>
      </div>
      <div className="relative mt-9 grid border-t border-white/10 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((metric) => <article key={metric.label} className="group border-b border-white/10 py-5 sm:px-5 sm:first:pl-0 lg:border-b-0 lg:border-r lg:last:border-r-0"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-medium text-zinc-400">{metric.label}</p><metric.icon size={17} className="text-emerald-300/70 transition-transform group-hover:-translate-y-0.5" /></div><p className="mt-4 font-mono text-2xl font-medium tracking-[-0.04em] text-white">{metric.value}</p><p className="mt-2 text-[10px] text-zinc-500">{metric.note}</p></article>)}</div>
    </section>

    {stats.pendingDeposits > 0 && (
      <Link href="/deposits" className="mt-6 flex flex-col gap-3 rounded-[20px] border border-sky-200 bg-sky-50 px-5 py-4 transition hover:border-sky-300 hover:bg-sky-100/70 active:scale-[0.995] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><Wallet size={19} className="text-sky-700" /><div><h2 className="text-sm font-semibold text-sky-950">{stats.pendingDeposits} yêu cầu nạp đang chờ</h2><p className="mt-0.5 text-xs text-sky-800/75">Tổng giá trị khai báo {formatPrice(stats.pendingDepositAmount)}</p></div></div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-900">Kiểm tra ngay <ArrowRight size={13} /></span>
      </Link>
    )}

    {stats.inventoryAlerts?.length > 0 && (
      <section aria-label="Cảnh báo tồn kho" className="mt-6 overflow-hidden rounded-[20px] border border-amber-200 bg-amber-50/80">
        <div className="flex flex-col gap-3 border-b border-amber-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><WarningCircle size={19} className="text-amber-700" /><div><h2 className="text-sm font-semibold text-amber-950">Tồn kho cần xử lý</h2><p className="mt-0.5 text-xs text-amber-800/80">Bấm vào sản phẩm để cập nhật ngay.</p></div></div>
          <Link href="/products" className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:underline">Xem tất cả <ArrowRight size={13} /></Link>
        </div>
        <div className="divide-y divide-amber-200/70">{stats.inventoryAlerts.map(item => <Link key={item.id} href={`/products?edit=${item.id}`} className="flex items-center justify-between gap-4 px-5 py-3 text-sm transition hover:bg-amber-100/70 active:scale-[0.995]"><span className="truncate font-medium text-amber-950">{item.name}</span><span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.stock_status === 'out' ? 'bg-red-100 text-red-700' : 'bg-amber-200/70 text-amber-900'}`}>{item.stock_status === 'out' ? 'Hết hàng' : `Còn ${item.stock}`}</span></Link>)}</div>
      </section>
    )}

    <section className="mt-8 grid overflow-hidden rounded-[24px] border border-zinc-200 bg-white xl:grid-cols-[minmax(0,1fr)_340px]">
      <article className="min-w-0 border-b border-zinc-200 xl:border-b-0 xl:border-r"><div className="flex flex-col gap-5 px-5 pb-2 pt-6 sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:pt-8"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Dòng tiền</p><h2 className="mt-2 text-xl font-semibold text-zinc-900">Nhịp doanh thu</h2><p className="mt-1 text-xs text-zinc-500">Biến động trong 7 ngày gần nhất</p></div><div className="sm:text-right"><p className="font-mono text-2xl font-medium tracking-tight text-zinc-900">{formatPrice(stats.totalDeposits)}</p><p className="mt-1 text-[11px] text-zinc-500">Tổng doanh thu đã ghi nhận</p></div></div><div className="h-[350px] px-1 pb-5 pt-7 sm:px-5">{stats.revenueChart?.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={stats.revenueChart} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#287a50" stopOpacity={0.2} /><stop offset="100%" stopColor="#287a50" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="3 5" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#71717a', fontSize: 10 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#a1a1aa', fontSize: 10 }} tickFormatter={(value) => `${Math.round(value / 1000)}k`} /><Tooltip contentStyle={{ background: '#17231d', border: 0, borderRadius: 12, color: '#fff', fontSize: 12 }} formatter={(value) => [formatPrice(Number(value)), 'Doanh thu']} /><Area type="monotone" dataKey="total" stroke="#287a50" strokeWidth={2.5} fill="url(#revenueFill)" activeDot={{ r: 4, fill: '#287a50', stroke: '#fff', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer> : <EmptyState label="Chưa có dữ liệu doanh thu để hiển thị" />}</div></article>
      <aside className="bg-[#f7f8f5] p-5 sm:p-8"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Hạ tầng</p><h2 className="mt-2 text-xl font-semibold text-zinc-900">Sức khỏe hệ thống</h2></div><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-700/10 bg-emerald-700/[0.06] px-2.5 py-1 text-[10px] font-semibold text-emerald-800"><CheckCircle size={12} /> Ổn định</span></div><div className="mt-8 divide-y divide-zinc-200">{[{ icon: HardDrives, label: 'Bot service', value: 'Đang hoạt động' }, { icon: Database, label: 'Database', value: 'Đã kết nối' }, { icon: Cpu, label: 'API server', value: 'Phản hồi tốt' }].map((item) => <div key={item.label} className="flex items-center justify-between gap-4 py-4 first:pt-0"><div className="flex items-center gap-3"><item.icon size={17} className="text-zinc-500" /><span className="text-xs font-medium text-zinc-700">{item.label}</span></div><span className="flex items-center gap-2 text-[11px] text-zinc-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{item.value}</span></div>)}</div><div className="mt-6 border-t border-zinc-900 pt-5"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] uppercase tracking-wider text-zinc-500">Bộ nhớ RAM</p><p className="mt-2 font-mono text-lg font-medium text-zinc-900">{system ? `${system.usedGB} / ${system.totalGB} GB` : 'Đang đọc...'}</p></div><p className="font-mono text-2xl font-medium text-zinc-900">{system?.usagePercent || 0}%</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200"><div className="h-full origin-left rounded-full bg-[#287a50] transition-transform duration-700" style={{ transform: `scaleX(${(system?.usagePercent || 0) / 100})` }} /></div><p className="mt-2 text-[10px] text-zinc-500">Còn trống {system?.freeGB || '—'} GB</p></div><Link href="/settings" className="mt-7 flex items-center justify-between border-b border-zinc-300 pb-2 text-xs font-semibold text-zinc-700 transition hover:border-emerald-700 hover:text-emerald-700">Mở cấu hình hệ thống <ArrowRight size={14} /></Link></aside>
    </section>

    <section className="mt-10"><div className="flex flex-col gap-5 border-b border-zinc-300 pb-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Thương mại</p><h2 className="mt-2 text-2xl font-semibold text-zinc-900">Hiệu suất bán hàng</h2><p className="mt-1 text-xs text-zinc-500">Sản phẩm và tài khoản được giao gần đây</p></div><div className="flex w-full overflow-x-auto sm:w-auto">{periodOptions.map((option) => <button key={option.value} onClick={() => setPeriod(option.value)} className={`whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition active:scale-[0.98] ${period === option.value ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}>{option.label}</button>)}</div></div>
      <div className={`mt-6 grid gap-8 transition-opacity xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.75fr)] ${sectionLoading ? 'opacity-45' : 'opacity-100'}`}>
        <article><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Package size={17} className="text-emerald-700" /><h3 className="text-sm font-semibold text-zinc-900">Doanh thu theo sản phẩm</h3></div><span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Top {Math.min(products.length, 6)}</span></div><div className="mt-4 border-y border-zinc-200">{products.length ? products.slice(0, 6).map((product, index) => <div key={product.product_id || index} className="group grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-200 py-4 last:border-b-0 sm:grid-cols-[42px_minmax(0,1fr)_100px_130px]"><span className="font-mono text-xs text-zinc-400">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800">{product.product_name}</p><div className="mt-2 h-1 max-w-md overflow-hidden rounded-full bg-zinc-100"><div className="h-full origin-left rounded-full bg-emerald-700/70 transition-transform duration-700" style={{ transform: `scaleX(${Number(product.total_revenue) / maxProductRevenue})` }} /></div></div><p className="hidden text-right text-xs text-zinc-500 sm:block">{product.order_count} đơn hàng</p><p className="font-mono text-xs font-medium text-zinc-800 sm:text-right">{formatPrice(Number(product.total_revenue))}</p></div>) : <div className="py-6"><EmptyState label="Chưa có sản phẩm phát sinh doanh thu" /></div>}</div></article>
        <article className="border-l-0 border-zinc-200 xl:border-l xl:pl-8"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-2"><EnvelopeSimple size={17} className="text-emerald-700" /><div><h3 className="text-sm font-semibold text-zinc-900">Gmail EDU gần đây</h3><p className="mt-1 text-[10px] text-zinc-500">{gmailSummary?.totalSold || 0} tài khoản đã bán</p></div></div><div className="text-right"><p className="font-mono text-sm font-medium text-zinc-900">{formatPrice(gmailSummary?.totalRevenue || 0)}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-zinc-400">Doanh thu</p></div></div><div className="mt-4 divide-y divide-zinc-200 border-y border-zinc-200">{gmailSales.length ? gmailSales.slice(0, 6).map((sale) => <div key={sale.id} className="group flex items-center justify-between gap-4 py-3.5"><div className="flex min-w-0 items-center gap-3"><Receipt size={15} className="shrink-0 text-zinc-400 group-hover:text-emerald-700" /><div className="min-w-0"><p className="truncate text-xs font-medium text-zinc-700">{sale.email}</p><p className="mt-1 truncate text-[10px] text-zinc-500">{sale.buyer_username || 'Khách Telegram'} · {sale.sold_at ? new Date(sale.sold_at).toLocaleDateString('vi-VN') : '—'}</p></div></div><span className="shrink-0 font-mono text-[11px] font-medium text-zinc-700">{formatPrice(Number(sale.price))}</span></div>) : <div className="py-6"><EmptyState label="Chưa có giao dịch Gmail EDU trong kỳ này" /></div>}</div></article>
      </div>
    </section>
  </div>;
}
