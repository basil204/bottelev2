'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  RefreshCw, Download, DollarSign, Coins, TrendingUp, Percent,
  RotateCcw, UserCheck, Calendar, Filter, Users, ArrowUpRight,
  TrendingDown, Package, Sparkles, Wallet, UserPlus, CreditCard
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';

interface PnLData {
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  marginPercent: number;
  refunds: number;
  refundOrdersCount: number;
  realProfitAfterRefunds: number;
  totalBuyingCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  aov: number;
  avgOrdersPerCustomer: number;
  frequencyDistribution: {
    freq1: { count: number; percent: number };
    freq2to3: { count: number; percent: number };
    freq4to5: { count: number; percent: number };
    freq6plus: { count: number; percent: number };
  };
}

interface GeneralStats {
  totalUsers: number;
  todayRegisteredUsers: number;
  totalWalletBalance: number;
  totalDeposits: number;
  todayDeposits: number;
  todayOrders: number;
}

interface ChartEntry {
  date: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
}

interface ProductProfitability {
  product_id: number;
  product_name: string;
  category_name: string;
  sold_count: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin_percent: number;
}

type Period = 'today' | '7days' | '30days' | 'this_month' | 'last_month' | 'custom';

export default function PnLAnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>('7days');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pnl, setPnl] = useState<PnLData | null>(null);
  const [generalStats, setGeneralStats] = useState<GeneralStats>({
    totalUsers: 0,
    todayRegisteredUsers: 0,
    totalWalletBalance: 0,
    totalDeposits: 0,
    todayDeposits: 0,
    todayOrders: 0,
  });
  const [chartData, setChartData] = useState<ChartEntry[]>([]);
  const [products, setProducts] = useState<ProductProfitability[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState('');
  const { formatPrice } = useCurrency();

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      let url = `/api/stats?period=${period}`;
      if (period === 'custom' && fromDate && toDate) {
        url += `&fromDate=${fromDate}&toDate=${toDate}`;
      }
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        if (data.pnl) setPnl(data.pnl);
        if (data.chartData) setChartData(data.chartData);
        if (data.productProfitability) setProducts(data.productProfitability);
        setGeneralStats({
          totalUsers: Number(data.totalUsers || 0),
          todayRegisteredUsers: Number(data.todayRegisteredUsers || 0),
          totalWalletBalance: Number(data.totalWalletBalance || 0),
          totalDeposits: Number(data.totalDeposits || 0),
          todayDeposits: Number(data.todayDeposits || 0),
          todayOrders: Number(data.todayOrders || 0),
        });
      }
    } catch (e) {
      console.error('Error fetching P&L stats:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLastUpdatedTime(new Date().toLocaleTimeString('vi-VN'));
    }
  }, [period, fromDate, toDate]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleExportCSV = () => {
    if (!pnl) return;
    const csvRows = [
      ['Chỉ số Thống kê & P&L', 'Giá trị'],
      ['Tổng thành viên', generalStats.totalUsers],
      ['Đăng ký hôm nay', generalStats.todayRegisteredUsers],
      ['Tổng số dư ví thành viên', generalStats.totalWalletBalance],
      ['Tổng tiền nạp đã duyệt', generalStats.totalDeposits],
      ['Tiền nạp hôm nay', generalStats.todayDeposits],
      ['Đơn hàng hôm nay', generalStats.todayOrders],
      ['Doanh thu thuần', pnl.netRevenue],
      ['Giá vốn (COGS)', pnl.cogs],
      ['Lợi nhuận gộp', pnl.grossProfit],
      ['Biên độ margin (%)', pnl.marginPercent.toFixed(2)],
      ['Tiền hoàn lại', pnl.refunds],
      ['Lợi nhuận thực sau hoàn tiền', pnl.realProfitAfterRefunds],
      ['Tổng khách mua', pnl.totalBuyingCustomers],
      ['Khách quay lại', pnl.repeatCustomers],
      ['Tỉ lệ khách quay lại (%)', pnl.repeatRate.toFixed(2)],
      ['Giá trị TB đơn (AOV)', pnl.aov],
      ['Số đơn TB / khách', pnl.avgOrdersPerCustomer.toFixed(2)],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + csvRows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bao_cao_pnl_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const periodTabs: { key: Period; label: string }[] = [
    { key: 'today', label: 'HÔM NAY' },
    { key: '7days', label: '7 NGÀY QUA' },
    { key: '30days', label: '30 NGÀY QUA' },
    { key: 'this_month', label: 'THÁNG NÀY' },
    { key: 'last_month', label: 'THÁNG TRƯỚC' },
  ];

  return (
    <div className="space-y-6 pb-12 text-zinc-900">
      {/* 1. Header Section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-500 fill-orange-500" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-950 uppercase">
              BÁO CÁO TÀI CHÍNH & LỢI NHUẬN (P&L ANALYTICS)
            </h1>
          </div>
          <p className="mt-1 text-xs text-zinc-500 font-medium">
            Quản lý số dư ví, thành viên, giá vốn COGS, doanh thu thuần và lợi nhuận hệ thống
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>XUẤT EXCEL / CSV</span>
          </button>
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-bold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50 active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 text-zinc-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>LÀM MỚI</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        {/* Preset Tabs */}
        <div className="flex flex-wrap gap-2">
          {periodTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setPeriod(tab.key);
                setFromDate('');
                setToDate('');
              }}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all active:scale-95 ${
                period === tab.key
                  ? 'bg-orange-600 text-white shadow-md shadow-orange-500/20'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range Picker */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-zinc-700 outline-none"
            />
          </div>
          <span className="text-zinc-400 font-medium">đến</span>
          <div className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5">
            <Calendar className="h-3.5 w-3.5 text-zinc-400" />
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-zinc-700 outline-none"
            />
          </div>
          <button
            onClick={() => {
              if (fromDate && toDate) setPeriod('custom');
            }}
            className="flex items-center gap-1 rounded-xl border border-zinc-300 bg-zinc-100 px-3 py-1.5 font-bold text-zinc-800 transition-all hover:bg-zinc-200 active:scale-95"
          >
            <Filter className="h-3.5 w-3.5" />
            <span>LỌC</span>
          </button>
        </div>
      </div>

      {/* 2.5 Member & Wallet Overview Highlight Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Tổng số dư ví thành viên */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white p-5 shadow-xs transition-all hover:shadow-md hover:border-amber-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">TỔNG SỐ DƯ VÍ</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-zinc-950">
            {formatPrice(generalStats.totalWalletBalance)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
            <span>Đã nạp: {formatPrice(generalStats.totalDeposits)}</span>
            <Link href="/deposits" className="flex items-center gap-1 font-bold text-amber-700 hover:text-amber-800 hover:underline">
              Chi tiết ví <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Card 2: Tổng thành viên */}
        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/90 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-white p-5 shadow-xs transition-all hover:shadow-md hover:border-indigo-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-800">TỔNG THÀNH VIÊN</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/30">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-zinc-950">
            {generalStats.totalUsers.toLocaleString('vi-VN')} <span className="text-sm font-bold text-zinc-400">thành viên</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
            <span>Tài khoản bot & web</span>
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
              Toàn hệ thống
            </span>
          </div>
        </div>

        {/* Card 3: Đăng ký hôm nay */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200/90 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-white p-5 shadow-xs transition-all hover:shadow-md hover:border-emerald-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">ĐĂNG KÝ HÔM NAY</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30">
              <UserPlus className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2 text-2xl font-black tracking-tight text-emerald-600">
            +{generalStats.todayRegisteredUsers.toLocaleString('vi-VN')}
            <span className="text-xs font-bold text-zinc-400">người mới</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
            <span>Gia nhập trong 24h</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-[10px] font-black text-emerald-800">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              MỚI HÔM NAY
            </span>
          </div>
        </div>

        {/* Card 4: Nạp tiền hôm nay */}
        <div className="relative overflow-hidden rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-500/10 via-sky-500/5 to-white p-5 shadow-xs transition-all hover:shadow-md hover:border-sky-300">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-sky-800">NẠP TIỀN HÔM NAY</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm shadow-sky-500/30">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-zinc-950">
            {formatPrice(generalStats.todayDeposits)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-zinc-500">
            <span>Đơn hoàn tất hôm nay: {generalStats.todayOrders}</span>
            <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 font-bold text-sky-700">
              Hôm nay
            </span>
          </div>
        </div>
      </div>

      {/* 3. Top 6 Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {/* Card 1: Doanh thu thuần */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">DOANH THU THUẦN</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-lg font-extrabold text-zinc-950">
            {formatPrice(pnl?.netRevenue || 0)}
          </div>
          <p className="mt-1 text-[11px] font-medium text-zinc-400">
            Góp: {formatPrice(pnl?.netRevenue || 0)}
          </p>
        </div>

        {/* Card 2: Giá vốn (COGS) */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">GIÁ VỐN (COGS)</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Coins className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-lg font-extrabold text-amber-600">
            {formatPrice(pnl?.cogs || 0)}
          </div>
          <p className="mt-1 text-[11px] font-medium text-zinc-400">
            Giá vốn hàng đã bán ra
          </p>
        </div>

        {/* Card 3: Lợi nhuận gộp */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">LỢI NHUẬN GỘP</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-lg font-extrabold text-emerald-600">
            {formatPrice(pnl?.grossProfit || 0)}
          </div>
          <p className="mt-1 text-[11px] font-medium text-zinc-400">
            Doanh thu - Giá vốn
          </p>
        </div>

        {/* Card 4: Biên độ Margin */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">BIÊN ĐỘ MARGIN</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <Percent className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-lg font-extrabold text-purple-600">
            {(pnl?.marginPercent || 0).toFixed(1)}%
          </div>
          <p className="mt-1 text-[11px] font-medium text-zinc-400">
            Tỉ suất sinh lời gộp
          </p>
        </div>

        {/* Card 5: Tiền hoàn lại */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">TIỀN HOÀN LẠI</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-lg font-extrabold text-rose-500">
            {formatPrice(pnl?.refunds || 0)}
          </div>
          <p className="mt-1 text-[11px] font-medium text-zinc-400">
            {pnl?.refundOrdersCount || 0} đơn hoàn (0.0%)
          </p>
        </div>

        {/* Card 6: Khách quay lại */}
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">KHÁCH QUAY LẠI</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-lg font-extrabold text-teal-600">
            {(pnl?.repeatRate || 0).toFixed(1)}%
          </div>
          <p className="mt-1 text-[11px] font-medium text-zinc-400">
            {pnl?.repeatCustomers || 0}/{pnl?.totalBuyingCustomers || 0} khách hàng
          </p>
        </div>
      </div>

      {/* 4. Middle Section: Chart + Customer Retention Behavior */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Daily Trend Chart (8 Cols) */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm lg:col-span-8 flex flex-col justify-between">
          <div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-orange-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                  DIỄN BIẾN DOANH THU, GIÁ VỐN & LỢI NHUẬN THEO NGÀY
                </h3>
              </div>
              <span className="text-[11px] font-medium text-zinc-400">
                Cập nhật: {lastUpdatedTime || '--:--:--'}
              </span>
            </div>

            {/* Legend Pills */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span>Doanh thu thuần</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span>Giá vốn (COGS)</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span>Lợi nhuận gộp</span>
              </div>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-[280px] w-full">
            {chartData && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                    formatter={(value: any) => [formatPrice(Number(value)), '']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                  <Area type="monotone" dataKey="grossProfit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-xs text-zinc-400 font-medium">
                Chưa có dữ liệu biểu đồ cho khoảng thời gian này
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Customer Behavior & Frequency (4 Cols) */}
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-sm lg:col-span-4 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
                  HÀNH VI & TỈ LỆ KHÁCH QUAY LẠI
                </h3>
              </div>
              <span className="text-xs font-semibold text-zinc-400">
                {pnl?.totalBuyingCustomers || 0} khách mua
              </span>
            </div>

            {/* Split Metrics */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-3 border border-zinc-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">GIÁ TRỊ TB ĐƠN (AOV)</span>
                <p className="mt-1 text-sm font-extrabold text-zinc-900">
                  {formatPrice(pnl?.aov || 0)}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">SỐ ĐƠN TB / KHÁCH</span>
                <p className="mt-1 text-sm font-extrabold text-zinc-900">
                  {(pnl?.avgOrdersPerCustomer || 0).toFixed(1)} đơn/khách
                </p>
              </div>
            </div>

            {/* Buying Frequency List */}
            <div className="mt-5 space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                PHÂN BỐ TẦN SUẤT MUA HÀNG:
              </span>

              <div className="space-y-2 text-xs">
                {/* Khách mới */}
                <div className="flex items-center justify-between font-medium">
                  <span className="text-zinc-600">Khách mới (Mua 1 lần)</span>
                  <span className="font-bold text-zinc-900">
                    {pnl?.frequencyDistribution?.freq1?.count || 0} khách ({(pnl?.frequencyDistribution?.freq1?.percent || 0).toFixed(0)}%)
                  </span>
                </div>
                {/* Quay lại 2-3 đơn */}
                <div className="flex items-center justify-between font-medium">
                  <span className="text-zinc-600">Quay lại (2 - 3 đơn)</span>
                  <span className="font-bold text-zinc-900">
                    {pnl?.frequencyDistribution?.freq2to3?.count || 0} khách ({(pnl?.frequencyDistribution?.freq2to3?.percent || 0).toFixed(0)}%)
                  </span>
                </div>
                {/* Thường xuyên 4-5 đơn */}
                <div className="flex items-center justify-between font-medium">
                  <span className="text-zinc-600">Thường xuyên (4 - 5 đơn)</span>
                  <span className="font-bold text-zinc-900">
                    {pnl?.frequencyDistribution?.freq4to5?.count || 0} khách ({(pnl?.frequencyDistribution?.freq4to5?.percent || 0).toFixed(0)}%)
                  </span>
                </div>
                {/* Khách VIP 6+ đơn */}
                <div className="flex items-center justify-between font-medium">
                  <span className="text-zinc-600">Khách VIP (6+ đơn)</span>
                  <span className="font-bold text-zinc-900">
                    {pnl?.frequencyDistribution?.freq6plus?.count || 0} khách ({(pnl?.frequencyDistribution?.freq6plus?.percent || 0).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Highlight Box */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs font-bold text-emerald-950 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-emerald-700 block">LỢI NHUẬN THỰC SAU HOÀN TIỀN</span>
              <span className="text-lg font-extrabold text-emerald-700 block mt-0.5">
                {formatPrice(pnl?.realProfitAfterRefunds || 0)}
              </span>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
              <ArrowUpRight className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Bottom Table: Top Product Profitability Matrix */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
        {/* Table Header Title */}
        <div className="flex items-center justify-between border-b border-zinc-100 p-5">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900">
              MA TRẬN SINH LỜI SẢN PHẨM (TOP PRODUCT PROFITABILITY)
            </h3>
          </div>
          <span className="text-xs font-medium text-zinc-400">
            Sắp xếp theo Lợi nhuận gộp cao nhất
          </span>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-medium text-zinc-700">
            <thead className="border-b border-zinc-100 bg-zinc-50/80 text-[11px] uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-5 py-3.5">SẢN PHẨM</th>
                <th className="px-5 py-3.5">DANH MỤC</th>
                <th className="px-5 py-3.5 text-center">ĐÃ BÁN</th>
                <th className="px-5 py-3.5 text-right">DOANH THU</th>
                <th className="px-5 py-3.5 text-right">TỔNG GIÁ VỐN</th>
                <th className="px-5 py-3.5 text-right">LỢI NHUẬN GỘP</th>
                <th className="px-5 py-3.5 text-right">BIÊN ĐỘ MARGIN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products && products.length > 0 ? (
                products.map((prod) => (
                  <tr key={prod.product_id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="px-5 py-4 font-bold text-zinc-900">{prod.product_name}</td>
                    <td className="px-5 py-4 text-zinc-500">{prod.category_name}</td>
                    <td className="px-5 py-4 text-center font-bold text-zinc-800">{prod.sold_count}</td>
                    <td className="px-5 py-4 text-right font-bold text-zinc-900">{formatPrice(prod.revenue)}</td>
                    <td className="px-5 py-4 text-right font-medium text-amber-600">{formatPrice(prod.cogs)}</td>
                    <td className="px-5 py-4 text-right font-bold text-emerald-600">{formatPrice(prod.gross_profit)}</td>
                    <td className="px-5 py-4 text-right">
                      <span className="inline-block rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-700">
                        {prod.margin_percent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    CHƯA PHÁT SINH DOANH THU CHO SẢN PHẨM NÀO TRONG KỲ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
