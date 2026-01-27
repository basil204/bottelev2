'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Users, CreditCard, ShoppingCart, DollarSign, TrendingUp, Activity, Database, Server } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';

interface DashboardStats {
  totalUsers: number;
  totalRevenue: number;
  totalDeposits: number;
  todayDeposits: number;
  monthDeposits: number;
  totalOrders: number;
  revenueChart: { date: string; total: number }[];
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
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, promoRes] = await Promise.all([
          fetch('/api/stats'),
          fetch('/api/promotions')
        ]);

        const statsData = await statsRes.json();
        setStats(statsData);

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
      title: t('dashboard.total_revenue'), // Approx map or use specific keys
      value: formatCurrency(stats.todayDeposits),
      icon: DollarSign,
      desc: t('dashboard.today'),
      iconStartColor: 'from-green-500',
      iconEndColor: 'to-emerald-700',
    },
    {
      title: t('dashboard.month_revenue'),
      value: formatCurrency(stats.monthDeposits),
      icon: CreditCard,
      desc: t('dashboard.this_month'),
      iconStartColor: 'from-blue-500',
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      borderRadius: '8px',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
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
                <span className="text-muted-foreground">Storage Usage</span>
                <span className="font-medium">24%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div className="bg-primary h-2 rounded-full w-[24%]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
