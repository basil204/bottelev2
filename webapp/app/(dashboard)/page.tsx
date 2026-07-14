'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { Users, CreditCard, ShoppingCart, DollarSign, TrendingUp, Activity, Database, Server, Package, CalendarDays, Filter, Mail } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';

interface ProductRevenue {
  product_id: number;
  product_name: string;
  order_count: number;
  total_revenue: number;
}

interface DashboardStats {
  totalUsers: number;
  totalRevenue: number;
  totalDeposits: number;
  todayDeposits: number;
  monthDeposits: number;
  totalOrders: number;
  revenueChart: { date: string; total: number }[];
  productRevenue: ProductRevenue[];
}

interface Promotion {
  id: number;
  start_time: string;
  end_time: string;
  bonus_percentage: number;
  min_amount: number;
}

import { useLanguage } from '@/contexts/LanguageContext';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [ramUsage, setRamUsage] = useState<{ usagePercent: number; usedGB: string; totalGB: string; freeGB: string; botUsername?: string } | null>(null);
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();

  // Product Revenue Filter States
  const [revenueFilter, setRevenueFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filteredProductRevenue, setFilteredProductRevenue] = useState<ProductRevenue[]>([]);
  const [loadingRevenue, setLoadingRevenue] = useState(false);

  // Gmail EDU Revenue States
  interface GmailEduSale {
    id: number;
    email: string;
    sold_at: string;
    buyer_username: string;
    buyer_telegram_id: string;
    price: number;
  }
  const [gmailFilter, setGmailFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [gmailFromDate, setGmailFromDate] = useState('');
  const [gmailToDate, setGmailToDate] = useState('');
  const [gmailSales, setGmailSales] = useState<GmailEduSale[]>([]);
  const [gmailSummary, setGmailSummary] = useState<{ totalSold: number; totalRevenue: number; pricePerAccount: number } | null>(null);
  const [loadingGmail, setLoadingGmail] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, promoRes, sysInfoRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/promotions'),
          fetch('/api/system-info')
        ]);

        const statsData = await statsRes.json();
        setStats(statsData);

        const sysInfoData = await sysInfoRes.json();
        if (sysInfoData.usagePercent !== undefined) {
          setRamUsage(sysInfoData);
        }

        const promoData = await promoRes.json();
        if (Array.isArray(promoData)) {
          // Find active promotion
          const now = new Date();
          const active = promoData.find((p: any) => {
            const start = new Date(p.start_time);
            const end = new Date(p.end_time);
            return now >= start && now <= end && p.status === 'active';
          });
          setPromotion(active || null);
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch filtered product revenue
  const fetchProductRevenue = async () => {
    setLoadingRevenue(true);
    try {
      let url = `/api/product-revenue?filter=${revenueFilter}`;
      if (revenueFilter === 'custom') {
        if (fromDate) url += `&from=${fromDate}`;
        if (toDate) url += `&to=${toDate}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setFilteredProductRevenue(data.productRevenue || []);
    } catch (err) {
      console.error('Error fetching product revenue:', err);
    }
    setLoadingRevenue(false);
  };

  useEffect(() => {
    if (revenueFilter !== 'custom') {
      fetchProductRevenue();
    }
  }, [revenueFilter]);

  // Initialize with stats data
  useEffect(() => {
    if (stats?.productRevenue) {
      setFilteredProductRevenue(stats.productRevenue);
    }
  }, [stats]);

  // Fetch Gmail EDU revenue
  const fetchGmailRevenue = async () => {
    setLoadingGmail(true);
    try {
      let url = `/api/gmail-edu-revenue?filter=${gmailFilter}`;
      if (gmailFilter === 'custom') {
        if (gmailFromDate) url += `&from=${gmailFromDate}`;
        if (gmailToDate) url += `&to=${gmailToDate}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setGmailSales(data.data || []);
      setGmailSummary(data.summary || null);
    } catch (err) {
      console.error('Error fetching Gmail EDU revenue:', err);
    }
    setLoadingGmail(false);
  };

  useEffect(() => {
    if (gmailFilter !== 'custom') {
      fetchGmailRevenue();
    }
  }, [gmailFilter]);

  // Initialize Gmail EDU data on mount
  useEffect(() => {
    fetchGmailRevenue();
  }, []);

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  if (!stats) return (
    <div className="flex h-[50vh] items-center justify-center text-destructive">
      Failed to load stats
    </div>
  );

  const cards = [
    {
      title: t('dashboard.total_revenue'), // Appropriating this key or adding new one
      value: formatPrice(stats.todayDeposits),
      icon: DollarSign,
      desc: t('dashboard.today'),
      iconStartColor: 'from-green-500',
      iconEndColor: 'to-emerald-700',
    },
    {
      title: 'Total Project Revenue', // Hardcoded or add to lang
      value: formatPrice(stats.totalDeposits),
      icon: Database,
      desc: 'All time',
      iconStartColor: 'from-yellow-500',
      iconEndColor: 'to-orange-700',
    },
    {
      title: t('dashboard.month_revenue'),
      value: formatPrice(stats.monthDeposits),
      icon: CreditCard,
      desc: t('dashboard.this_month'),
      iconStartColor: 'from-blue-500', // Changed color to distinguish
      iconEndColor: 'to-indigo-700',
    },
    {
      title: t('dashboard.active_users'),
      value: stats.totalUsers,
      icon: Users,
      desc: '',
      iconStartColor: 'from-purple-500',
      iconEndColor: 'to-pink-700',
    },
    {
      title: t('dashboard.total_orders'),
      value: stats.totalOrders,
      icon: ShoppingCart,
      desc: '',
      iconStartColor: 'from-orange-500',
      iconEndColor: 'to-red-700',
    },
  ];

  const isDark = theme === 'dark';

  const botUsername = ramUsage?.botUsername || 'autobasilbot';

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t('sidebar.dashboard')}</h2>
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-3.5 py-1.5 rounded-full shadow-sm shadow-green-500/5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>Bot started: <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" className="hover:underline font-bold text-green-300">@{botUsername}</a></span>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-card border px-3.5 py-1.5 rounded-full shadow-sm">
            <Activity className="w-3.5 h-3.5 text-green-500" />
            <span>System Normal</span>
          </div>
        </div>
      </div>

      {promotion && (
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-6 text-white shadow-lg relative overflow-hidden animate-in zoom-in-95 duration-500">
          <div className="absolute top-0 right-0 p-4 opacity-20">
            <DollarSign className="w-24 h-24" />
          </div>
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-2">🎉 {t('dashboard.promotion_active')}</h3>
            <p className="text-lg opacity-90 mb-4">
              Get <span className="font-bold text-yellow-100">{promotion.bonus_percentage}% bonus</span> on deposits over {formatPrice(promotion.min_amount)}!
            </p>
            <div className="text-sm font-medium bg-white/20 inline-block px-3 py-1 rounded-full">
              Ends: {new Date(promotion.end_time).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, i) => (
          <Card key={i} className="glass-panel glass-panel-hover border border-white/5 shadow-lg shadow-black/30 rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-xl bg-gradient-to-br ${card.iconStartColor} ${card.iconEndColor} text-white shadow-lg shadow-indigo-500/10`}>
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold tracking-tight text-white">{card.value}</div>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {card.desc}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <Card className="col-span-1 lg:col-span-4 glass-panel border border-white/5 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-md font-semibold text-slate-200">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              {t('dashboard.total_revenue')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenueChart}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    padding={{ left: 10, right: 10 }}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}đ`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 15, 20, 0.9)',
                      borderColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(8px)',
                      color: '#f8fafc'
                    }}
                    formatter={(value) => [`${Number(value).toLocaleString('vi-VN')}đ`, t('dashboard.total_revenue')]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="url(#colorRevenue)"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#8b5cf6', stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-3 glass-panel border border-white/5 shadow-xl rounded-2xl">
          <CardHeader>
            <CardTitle className="text-md font-semibold text-slate-200">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-green-500/10 rounded-xl border border-green-500/15">
                    <Activity className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">API Status</p>
                    <p className="text-xs text-slate-400">Response time: 45ms</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 border border-green-500/20 px-2.5 py-1 text-xs font-semibold text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-glow" />
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/15">
                    <Database className="h-4 w-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Database</p>
                    <p className="text-xs text-slate-400">32 connections</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-cyan-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse-glow" />
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-violet-500/10 rounded-xl border border-violet-500/15">
                    <Server className="h-4 w-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Vercel Edge</p>
                    <p className="text-xs text-slate-400">Region: Sin1</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-xs font-semibold text-violet-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse-glow" />
                  Healthy
                </span>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-white/[0.01] border border-white/5 shadow-inner">
              <div className="flex justify-between text-xs font-semibold mb-2">
                <span className="text-slate-400">🖥️ RAM Usage</span>
                <span className="text-slate-200">
                  {ramUsage ? `${ramUsage.usedGB}GB / ${ramUsage.totalGB}GB (${ramUsage.usagePercent}%)` : 'Loading...'}
                </span>
              </div>
              <div className="w-full bg-white/[0.04] rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 shadow-md ${
                    ramUsage && ramUsage.usagePercent > 80 ? 'bg-red-500 shadow-red-500/20' :
                    ramUsage && ramUsage.usagePercent > 60 ? 'bg-yellow-500 shadow-yellow-500/20' : 
                    'bg-violet-500 shadow-violet-500/20'
                  }`}
                  style={{ width: `${ramUsage?.usagePercent || 0}%` }}
                />
              </div>
              {ramUsage && (
                <div className="text-[10px] font-medium text-slate-500 mt-1">
                  Free memory: {ramUsage.freeGB}GB
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Revenue Section */}
      <Card className="glass-panel border border-white/5 shadow-xl rounded-2xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-md font-semibold text-slate-200">
              <Package className="w-4.5 h-4.5 text-violet-400" />
              {t('dashboard.product_revenue')}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Filter Buttons */}
              <div className="flex gap-1 bg-white/[0.02] border border-white/5 rounded-xl p-1">
                {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={revenueFilter === filter ? 'default' : 'ghost'}
                    className="h-8 px-3 text-xs rounded-lg cursor-pointer"
                    onClick={() => setRevenueFilter(filter)}
                  >
                    {t(`dashboard.filter_${filter}`)}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={revenueFilter === 'custom' ? 'default' : 'ghost'}
                  className="h-8 px-3 text-xs rounded-lg cursor-pointer"
                  onClick={() => setRevenueFilter('custom')}
                >
                  <CalendarDays className="w-3.5 h-3.5 mr-1" />
                  {t('dashboard.filter_custom')}
                </Button>
              </div>
            </div>
          </div>

          {/* Custom Date Range */}
          {revenueFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-white/[0.01] border border-white/5 rounded-xl">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400">{t('dashboard.from_date')}:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium border border-white/5 rounded-xl bg-zinc-950/80 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400">{t('dashboard.to_date')}:</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium border border-white/5 rounded-xl bg-zinc-950/80 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <Button size="sm" className="rounded-xl cursor-pointer" onClick={fetchProductRevenue} disabled={loadingRevenue}>
                <Filter className="w-3.5 h-3.5 mr-1" />
                {loadingRevenue ? t('dashboard.filtering') : t('dashboard.filter_btn')}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loadingRevenue ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500"></div>
            </div>
          ) : filteredProductRevenue.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full premium-table">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400">
                    <th className="text-left py-3.5 px-4 font-semibold text-xs tracking-wider uppercase">{t('dashboard.product')}</th>
                    <th className="text-center py-3.5 px-4 font-semibold text-xs tracking-wider uppercase">{t('dashboard.orders_count')}</th>
                    <th className="text-right py-3.5 px-4 font-semibold text-xs tracking-wider uppercase">{t('dashboard.revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductRevenue.map((product) => (
                    <tr key={product.product_id} className="group/row transition-all duration-200">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 group-hover/row:scale-105 transition-transform">
                            <Package className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold text-slate-200 text-sm group-hover/row:text-white transition-colors">{product.product_name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-0.5 text-xs font-semibold text-violet-400">
                          {product.order_count}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-green-400">
                        {formatPrice(product.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-white/[0.02] font-bold text-slate-200">
                    <td className="py-4 px-4 rounded-l-xl text-sm">{t('dashboard.total')}</td>
                    <td className="py-4 px-4 text-center text-sm">
                      {filteredProductRevenue.reduce((sum, p) => sum + Number(p.order_count), 0)}
                    </td>
                    <td className="py-4 px-4 text-right text-green-400 rounded-r-xl text-sm">
                      {formatPrice(filteredProductRevenue.reduce((sum, p) => sum + Number(p.total_revenue), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm font-medium">
              {t('dashboard.no_data')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gmail EDU Revenue Section */}
      <Card className="glass-panel border border-white/5 shadow-xl rounded-2xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-md font-semibold text-slate-200">
              <Mail className="w-4.5 h-4.5 text-violet-400" />
              Gmail EDU Revenue
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 bg-white/[0.02] border border-white/5 rounded-xl p-1">
                {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={gmailFilter === filter ? 'default' : 'ghost'}
                    className="h-8 px-3 text-xs rounded-lg cursor-pointer"
                    onClick={() => setGmailFilter(filter)}
                  >
                    {t(`dashboard.filter_${filter}`)}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={gmailFilter === 'custom' ? 'default' : 'ghost'}
                  className="h-8 px-3 text-xs rounded-lg cursor-pointer"
                  onClick={() => setGmailFilter(gmailFilter === 'custom' ? 'all' : 'custom')} // Toggle custom filter
                >
                  <CalendarDays className="w-3.5 h-3.5 mr-1" />
                  {t('dashboard.filter_custom')}
                </Button>
              </div>
            </div>
          </div>

          {gmailFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-4 mt-4 p-4 bg-white/[0.01] border border-white/5 rounded-xl">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400">{t('dashboard.from_date')}:</label>
                <input
                  type="date"
                  value={gmailFromDate}
                  onChange={(e) => setGmailFromDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium border border-white/5 rounded-xl bg-zinc-950/80 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400">{t('dashboard.to_date')}:</label>
                <input
                  type="date"
                  value={gmailToDate}
                  onChange={(e) => setGmailToDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-medium border border-white/5 rounded-xl bg-zinc-950/80 text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
              </div>
              <Button size="sm" className="rounded-xl cursor-pointer" onClick={fetchGmailRevenue} disabled={loadingGmail}>
                <Filter className="w-3.5 h-3.5 mr-1" />
                {loadingGmail ? t('dashboard.filtering') : t('dashboard.filter_btn')}
              </Button>
            </div>
          )}

          {/* Summary Cards */}
          {gmailSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="p-4 bg-white/[0.015] border border-blue-500/10 rounded-xl flex flex-col gap-1 shadow-inner">
                <div className="text-xs font-semibold text-slate-400">Tổng đã bán</div>
                <div className="text-2xl font-bold text-cyan-400">{gmailSummary.totalSold}</div>
              </div>
              <div className="p-4 bg-white/[0.015] border border-green-500/10 rounded-xl flex flex-col gap-1 shadow-inner">
                <div className="text-xs font-semibold text-slate-400">Tổng doanh thu</div>
                <div className="text-2xl font-bold text-green-400">{formatPrice(gmailSummary.totalRevenue)}</div>
              </div>
              <div className="p-4 bg-white/[0.015] border border-purple-500/10 rounded-xl flex flex-col gap-1 shadow-inner">
                <div className="text-xs font-semibold text-slate-400">Giá/tài khoản</div>
                <div className="text-2xl font-bold text-violet-400">{formatPrice(gmailSummary.pricePerAccount)}</div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loadingGmail ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-500"></div>
            </div>
          ) : gmailSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full premium-table">
                <thead>
                  <tr className="border-b border-white/5 text-slate-400">
                    <th className="text-left py-3.5 px-4 font-semibold text-xs tracking-wider uppercase">Email</th>
                    <th className="text-left py-3.5 px-4 font-semibold text-xs tracking-wider uppercase">Người mua</th>
                    <th className="text-center py-3.5 px-4 font-semibold text-xs tracking-wider uppercase">Ngày bán</th>
                    <th className="text-right py-3.5 px-4 font-semibold text-xs tracking-wider uppercase">Giá</th>
                  </tr>
                </thead>
                <tbody>
                  {gmailSales.slice(0, 20).map((sale) => (
                    <tr key={sale.id} className="group/row transition-all duration-200">
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-200 text-sm group-hover/row:text-white transition-colors">{sale.email}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-slate-200 text-sm group-hover/row:text-white transition-colors">{sale.buyer_username || 'N/A'}</span>
                          <span className="text-xs text-slate-500 font-mono">{sale.buyer_telegram_id || ''}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-sm font-medium text-slate-300">
                        {sale.sold_at ? new Date(sale.sold_at).toLocaleDateString('vi-VN') : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-green-400">
                        {formatPrice(sale.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gmailSales.length > 20 && (
                <div className="text-center py-3.5 text-xs font-semibold text-slate-500">
                  Hiển thị 20/{gmailSales.length} giao dịch gần nhất
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm font-medium">
              {t('dashboard.no_data')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
