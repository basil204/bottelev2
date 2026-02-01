'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, Globe, TrendingUp } from 'lucide-react';

interface Stats {
    totalUsers: number;
    totalEmails: number;
    totalDomains: number;
    activeEmails: number;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<Stats>({
        totalUsers: 0,
        totalEmails: 0,
        totalDomains: 0,
        activeEmails: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const statCards = [
        {
            title: 'Tổng Users',
            value: stats.totalUsers,
            icon: Users,
            color: 'text-blue-500',
            bgColor: 'bg-blue-500/10'
        },
        {
            title: 'Tổng Emails',
            value: stats.totalEmails,
            icon: Mail,
            color: 'text-green-500',
            bgColor: 'bg-green-500/10'
        },
        {
            title: 'Domains Active',
            value: stats.totalDomains,
            icon: Globe,
            color: 'text-purple-500',
            bgColor: 'bg-purple-500/10'
        },
        {
            title: 'Emails Active',
            value: stats.activeEmails,
            icon: TrendingUp,
            color: 'text-orange-500',
            bgColor: 'bg-orange-500/10'
        }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold">Dashboard</h2>
                <p className="text-muted-foreground">Tổng quan hệ thống Email EDU</p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {stat.title}
                            </CardTitle>
                            <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Recent Activity */}
            <Card>
                <CardHeader>
                    <CardTitle>Hoạt động gần đây</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">
                        Chưa có hoạt động nào được ghi nhận.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
