'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BarChart3, Download, Search, UserCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface AdminStat {
    admin_id: number;
    admin_name: string;
    username: string;
    telegram_id: string;
    total_orders: number;
    total_spent: number;
}

export default function AdminStatsPage() {
    const { formatPrice } = useCurrency();
    const [stats, setStats] = useState<AdminStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState<string>(new Date().getMonth() + 1 + '');
    const [year, setYear] = useState<string>(new Date().getFullYear() + '');

    const months = [
        { value: 'all', label: 'Tất cả tháng' },
        ...Array.from({ length: 12 }, (_, i) => ({
            value: (i + 1).toString(),
            label: `Tháng ${i + 1}`,
        })),
    ];

    const years = Array.from({ length: 3 }, (_, i) => (new Date().getFullYear() - i).toString());

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin-stats?month=${month}&year=${year}`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (error) {
            console.error('Error fetching admin stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [month, year]);

    const totalSpent = stats.reduce((acc, curr) => acc + Number(curr.total_spent), 0);
    const totalOrders = stats.reduce((acc, curr) => acc + Number(curr.total_orders), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Thống kê mua hàng Admin</h2>
                    <p className="text-muted-foreground">Theo dõi chi tiêu của các tài khoản Admin trên hệ thống Bot</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={month} onValueChange={setMonth}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Chọn tháng" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map((m) => (
                                <SelectItem key={m.value} value={m.value}>
                                    {m.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={year} onValueChange={setYear}>
                        <SelectTrigger className="w-28">
                            <SelectValue placeholder="Chọn năm" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((y) => (
                                <SelectItem key={y} value={y}>
                                    {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={fetchStats}>
                        <Search className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng chi tiêu</CardTitle>
                        <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{formatPrice(totalSpent)}</div>
                        <p className="text-xs text-muted-foreground">+{stats.length} admin tham gia</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng đơn hàng</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalOrders}</div>
                        <p className="text-xs text-muted-foreground">Đơn hàng hoàn tất</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bảng xếp hạng chi tiêu</CardTitle>
                    <CardDescription>Chi tiết chi tiêu của từng admin trong {month === 'all' ? 'năm ' + year : `tháng ${month}/${year}`}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 text-center">Hạng</TableHead>
                                    <TableHead>Admin</TableHead>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Telegram ID</TableHead>
                                    <TableHead className="text-right">Số đơn</TableHead>
                                    <TableHead className="text-right">Tổng chi tiêu</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">Đang tải...</TableCell>
                                    </TableRow>
                                ) : stats.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            Không có dữ liệu chi tiêu trong khoảng thời gian này
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    stats.map((stat, index) => (
                                        <TableRow key={stat.admin_id}>
                                            <TableCell className="text-center font-bold">
                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                            </TableCell>
                                            <TableCell className="font-medium">{stat.admin_name || 'N/A'}</TableCell>
                                            <TableCell>{stat.username}</TableCell>
                                            <TableCell className="font-mono text-sm">{stat.telegram_id}</TableCell>
                                            <TableCell className="text-right">{stat.total_orders}</TableCell>
                                            <TableCell className="text-right font-bold text-green-600">
                                                {formatPrice(stat.total_spent)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
