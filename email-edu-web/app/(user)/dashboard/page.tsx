'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, CheckCircle, Calendar, Key } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface UserStats {
    totalEmails: number;
    activeEmails: number;
    todayCreated: number;
    twoFaCount: number;
}

export default function UserDashboard() {
    const [stats, setStats] = useState<UserStats>({
        totalEmails: 0,
        activeEmails: 0,
        todayCreated: 0,
        twoFaCount: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/user/stats');
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
                <h2 className="text-3xl font-bold">Tổng quan</h2>
                <p className="text-muted-foreground">Chào mừng bạn đến với Email EDU</p>
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng Emails</CardTitle>
                        <Mail className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalEmails}</div>
                        <p className="text-xs text-muted-foreground">đã tạo</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Emails Active</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.activeEmails}</div>
                        <p className="text-xs text-muted-foreground">đang hoạt động</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tạo hôm nay</CardTitle>
                        <Calendar className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.todayCreated}</div>
                        <p className="text-xs text-muted-foreground">email vĩnh viễn (max 10)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Mã 2FA</CardTitle>
                        <Key className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.twoFaCount}</div>
                        <p className="text-xs text-muted-foreground">đã lưu</p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Hành động nhanh</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                    <Link href="/dashboard/create-email">
                        <Button size="lg">
                            <Mail className="w-4 h-4 mr-2" />
                            Tạo Email EDU
                        </Button>
                    </Link>
                    <Link href="/dashboard/my-emails">
                        <Button variant="outline" size="lg">
                            Xem Emails của tôi
                        </Button>
                    </Link>
                    <Link href="/dashboard/2fa">
                        <Button variant="outline" size="lg">
                            <Key className="w-4 h-4 mr-2" />
                            Quản lý 2FA
                        </Button>
                    </Link>
                </CardContent>
            </Card>
        </div>
    );
}
