'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Users, CreditCard, ShoppingCart, DollarSign, TrendingUp, Activity, Database, Server, Package, CalendarDays, Filter } from 'lucide-react';
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
  const [ramUsage, setRamUsage] = useState<{ usagePercent: number; usedGB: string; totalGB: string; freeGB: string } | null>(null);
  const { theme } = useTheme();
  const { t } = useLanguage();

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
      value: formatCurrency(stats.todayDeposits),
      icon: DollarSign,
      desc: t('dashboard.today'),
      iconStartColor: 'from-green-500',
      iconEndColor: 'to-emerald-700',
    },
    {
      title: 'Total Project Revenue', // Hardcoded or add to lang
      value: formatCurrency(stats.totalDeposits),
      icon: Database,
      desc: 'All time',
      iconStartColor: 'from-yellow-500',
      iconEndColor: 'to-orange-700',
    },
    {
      title: t('dashboard.month_revenue'),
      value: formatCurrency(stats.monthDeposits),
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

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">{t('sidebar.dashboard')}</h2>
        <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground bg-card border px-3 py-1 rounded-full shadow-sm">
          <Activity className="w-4 h-4 text-green-500" />
          <span>System Normal</span>
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
              Get <span className="font-bold text-yellow-100">{promotion.bonus_percentage}% bonus</span> on deposits over {formatCurrency(promotion.min_amount)}!
            </p>
            <div className="text-sm font-medium bg-white/20 inline-block px-3 py-1 rounded-full">
              Ends: {new Date(promotion.end_time).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${card.iconStartColor} ${card.iconEndColor} text-white shadow-md`}>
                <card.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.desc}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <Card className="col-span-1 lg:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t('dashboard.total_revenue')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#e2e8f0"} />
                  <XAxis
                    dataKey="date"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    padding={{ left: 10, right: 10 }}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}đ`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      borderRadius: '8px',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
                    formatter={(value) => [`${Number(value).toLocaleString('vi-VN')}đ`, t('dashboard.total_revenue')]}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2, fill: '#2563eb', stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 lg:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-full">
                    <Activity className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">API Status</p>
                    <p className="text-xs text-muted-foreground">Response time: 45ms</p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/20 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                  Operational
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-full">
                    <Database className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Database</p>
                    <p className="text-xs text-muted-foreground">32 connections</p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/20 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                  Connected
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-full">
                    <Server className="h-4 w-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Vercel Edge</p>
                    <p className="text-xs text-muted-foreground">Region: Sin1</p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/20 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                  Healthy
                </span>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-dashed">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">🖥️ RAM Usage</span>
                <span className="font-medium">
                  {ramUsage ? `${ramUsage.usedGB}GB / ${ramUsage.totalGB}GB (${ramUsage.usagePercent}%)` : 'Loading...'}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${ramUsage && ramUsage.usagePercent > 80 ? 'bg-red-500' :
                    ramUsage && ramUsage.usagePercent > 60 ? 'bg-yellow-500' : 'bg-primary'
                    }`}
                  style={{ width: `${ramUsage?.usagePercent || 0}%` }}
                />
              </div>
              {ramUsage && (
                <div className="text-xs text-muted-foreground mt-1">
                  Free: {ramUsage.freeGB}GB
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Product Revenue Section */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {t('dashboard.product_revenue')}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Filter Buttons */}
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={revenueFilter === filter ? 'default' : 'ghost'}
                    className="h-7 px-3 text-xs"
                    onClick={() => setRevenueFilter(filter)}
                  >
                    {t(`dashboard.filter_${filter}`)}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={revenueFilter === 'custom' ? 'default' : 'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={() => setRevenueFilter('custom')}
                >
                  <CalendarDays className="w-3 h-3 mr-1" />
                  {t('dashboard.filter_custom')}
                </Button>
              </div>
            </div>
          </div>

          {/* Custom Date Range */}
          {revenueFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">{t('dashboard.from_date')}:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">{t('dashboard.to_date')}:</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded-md bg-background"
                />
              </div>
              <Button size="sm" onClick={fetchProductRevenue} disabled={loadingRevenue}>
                <Filter className="w-3 h-3 mr-1" />
                {loadingRevenue ? t('dashboard.filtering') : t('dashboard.filter_btn')}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loadingRevenue ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : filteredProductRevenue.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">{t('dashboard.product')}</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">{t('dashboard.orders_count')}</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">{t('dashboard.revenue')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductRevenue.map((product, index) => (
                    <tr key={product.product_id} className={`border-b last:border-0 ${index % 2 === 0 ? 'bg-muted/30' : ''}`}>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                            <Package className="h-3 w-3" />
                          </div>
                          <span className="font-medium">{product.product_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                          {product.order_count}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(product.total_revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="py-3 px-4">{t('dashboard.total')}</td>
                    <td className="py-3 px-4 text-center">
                      {filteredProductRevenue.reduce((sum, p) => sum + Number(p.order_count), 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">
                      {formatCurrency(filteredProductRevenue.reduce((sum, p) => sum + Number(p.total_revenue), 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('dashboard.no_data')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gmail EDU Revenue Section */}
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Gmail EDU Revenue
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                {(['all', 'today', 'week', 'month'] as const).map((filter) => (
                  <Button
                    key={filter}
                    size="sm"
                    variant={gmailFilter === filter ? 'default' : 'ghost'}
                    className="h-7 px-3 text-xs"
                    onClick={() => setGmailFilter(filter)}
                  >
                    {t(`dashboard.filter_${filter}`)}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={gmailFilter === 'custom' ? 'default' : 'ghost'}
                  className="h-7 px-3 text-xs"
                  onClick={() => setGmailFilter('custom')}
                >
                  <CalendarDays className="w-3 h-3 mr-1" />
                  {t('dashboard.filter_custom')}
                </Button>
              </div>
            </div>
          </div>

          {gmailFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">{t('dashboard.from_date')}:</label>
                <input
                  type="date"
                  value={gmailFromDate}
                  onChange={(e) => setGmailFromDate(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded-md bg-background"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">{t('dashboard.to_date')}:</label>
                <input
                  type="date"
                  value={gmailToDate}
                  onChange={(e) => setGmailToDate(e.target.value)}
                  className="px-3 py-1.5 text-sm border rounded-md bg-background"
                />
              </div>
              <Button size="sm" onClick={fetchGmailRevenue} disabled={loadingGmail}>
                <Filter className="w-3 h-3 mr-1" />
                {loadingGmail ? t('dashboard.filtering') : t('dashboard.filter_btn')}
              </Button>
            </div>
          )}

          {/* Summary Cards */}
          {gmailSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-sm text-muted-foreground">Tổng đã bán</div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{gmailSummary.totalSold}</div>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-sm text-muted-foreground">Tổng doanh thu</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(gmailSummary.totalRevenue)}</div>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="text-sm text-muted-foreground">Giá/tài khoản</div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(gmailSummary.pricePerAccount)}</div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loadingGmail ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : gmailSales.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Người mua</th>
                    <th className="text-center py-3 px-4 font-medium text-muted-foreground">Ngày bán</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Giá</th>
                  </tr>
                </thead>
                <tbody>
                  {gmailSales.slice(0, 20).map((sale, index) => (
                    <tr key={sale.id} className={`border-b last:border-0 ${index % 2 === 0 ? 'bg-muted/30' : ''}`}>
                      <td className="py-3 px-4">
                        <span className="font-medium text-sm">{sale.email}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{sale.buyer_username || 'N/A'}</span>
                          <span className="text-xs text-muted-foreground">{sale.buyer_telegram_id || ''}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {sale.sold_at ? new Date(sale.sold_at).toLocaleDateString('vi-VN') : 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(sale.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {gmailSales.length > 20 && (
                <div className="text-center py-2 text-sm text-muted-foreground">
                  Hiển thị 20/{gmailSales.length} giao dịch gần nhất
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t('dashboard.no_data')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
