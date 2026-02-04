'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Activity, Filter, CalendarDays, RefreshCw } from 'lucide-react';

interface AdminLog {
    id: number;
    admin_id: number | null;
    admin_name: string | null;
    action: string;
    target_type: string;
    target_id: string | null;
    details: string | null;
    ip_address: string | null;
    created_at: string;
}

interface Stats {
    byAction: { action: string; count: number }[];
    byTargetType: { target_type: string; count: number }[];
}

const ACTION_COLORS: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    UPDATE: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    VIEW: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    APPROVE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    REJECT: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    LOGIN: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    BROADCAST: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const ACTION_LABELS: Record<string, string> = {
    CREATE: 'Tạo mới',
    UPDATE: 'Cập nhật',
    DELETE: 'Xóa',
    VIEW: 'Xem',
    APPROVE: 'Duyệt',
    REJECT: 'Từ chối',
    LOGIN: 'Đăng nhập',
    LOGOUT: 'Đăng xuất',
    BROADCAST: 'Broadcast',
};

const TARGET_LABELS: Record<string, string> = {
    USER: 'Người dùng',
    PRODUCT: 'Sản phẩm',
    ORDER: 'Đơn hàng',
    DEPOSIT: 'Nạp tiền',
    SETTING: 'Cài đặt',
    PROMOTION: 'Khuyến mãi',
    ACCOUNT_TYPE: 'Loại TK',
    STORED_ACCOUNT: 'Kho TK',
    GMAIL_ACCOUNT: 'Gmail',
    BROADCAST: 'Broadcast',
    SYSTEM: 'Hệ thống',
};

export default function AdminLogsPage() {
    const { t } = useLanguage();
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [filterAction, setFilterAction] = useState('');
    const [filterTarget, setFilterTarget] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let url = `/api/admin-logs?page=${page}&limit=30`;
            if (filterAction) url += `&action=${filterAction}`;
            if (filterTarget) url += `&target_type=${filterTarget}`;
            if (fromDate) url += `&from=${fromDate}`;
            if (toDate) url += `&to=${toDate}`;

            const res = await fetch(url);
            const data = await res.json();

            if (data.success) {
                setLogs(data.data || []);
                setStats(data.stats || null);
                setTotalPages(data.pagination?.totalPages || 1);
            }
        } catch (err) {
            console.error('Error fetching logs:', err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, [page]);

    const handleFilter = () => {
        setPage(1);
        fetchLogs();
    };

    const clearFilters = () => {
        setFilterAction('');
        setFilterTarget('');
        setFromDate('');
        setToDate('');
        setPage(1);
        setTimeout(fetchLogs, 100);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('vi-VN');
    };

    const parseDetails = (details: string | null) => {
        if (!details) return null;
        try {
            return JSON.parse(details);
        } catch {
            return details;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Activity className="w-6 h-6" />
                    Nhật ký hoạt động Admin
                </h1>
                <Button onClick={fetchLogs} variant="outline" size="sm">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {stats.byAction.slice(0, 6).map((stat) => (
                        <Card key={stat.action} className="p-3">
                            <div className="text-sm text-muted-foreground">{ACTION_LABELS[stat.action] || stat.action}</div>
                            <div className="text-xl font-bold">{stat.count}</div>
                        </Card>
                    ))}
                </div>
            )}

            {/* Filters */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Bộ lọc
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        <select
                            className="px-3 py-2 text-sm border rounded-md bg-background"
                            value={filterAction}
                            onChange={(e) => setFilterAction(e.target.value)}
                        >
                            <option value="">Tất cả hành động</option>
                            {Object.entries(ACTION_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <select
                            className="px-3 py-2 text-sm border rounded-md bg-background"
                            value={filterTarget}
                            onChange={(e) => setFilterTarget(e.target.value)}
                        >
                            <option value="">Tất cả đối tượng</option>
                            {Object.entries(TARGET_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-muted-foreground" />
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                className="px-3 py-2 text-sm border rounded-md bg-background"
                            />
                            <span className="text-muted-foreground">-</span>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                className="px-3 py-2 text-sm border rounded-md bg-background"
                            />
                        </div>
                        <Button size="sm" onClick={handleFilter}>Lọc</Button>
                        <Button size="sm" variant="outline" onClick={clearFilters}>Xóa lọc</Button>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                    ) : logs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b bg-muted/50">
                                        <th className="text-left py-3 px-4 text-sm font-medium">Thời gian</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">Admin</th>
                                        <th className="text-center py-3 px-4 text-sm font-medium">Hành động</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">Đối tượng</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">Chi tiết</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium">IP</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log, idx) => {
                                        const details = parseDetails(log.details);
                                        return (
                                            <tr key={log.id} className={`border-b ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}>
                                                <td className="py-3 px-4 text-sm text-muted-foreground whitespace-nowrap">
                                                    {formatDate(log.created_at)}
                                                </td>
                                                <td className="py-3 px-4 text-sm font-medium">
                                                    {log.admin_name || 'System'}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100'}`}>
                                                        {ACTION_LABELS[log.action] || log.action}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    <span className="font-medium">{TARGET_LABELS[log.target_type] || log.target_type}</span>
                                                    {log.target_id && (
                                                        <span className="text-muted-foreground ml-1">#{log.target_id}</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs truncate">
                                                    {typeof details === 'object' && details !== null
                                                        ? Object.entries(details).map(([k, v]) => `${k}: ${v}`).join(', ')
                                                        : details || '-'}
                                                </td>
                                                <td className="py-3 px-4 text-xs text-muted-foreground">
                                                    {log.ip_address || '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            Không có dữ liệu
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                    >
                        Trước
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                        Trang {page} / {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => p + 1)}
                    >
                        Sau
                    </Button>
                </div>
            )}
        </div>
    );
}
