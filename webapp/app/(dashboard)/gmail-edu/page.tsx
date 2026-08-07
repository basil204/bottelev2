'use client';

import { useEffect, useState } from 'react';
import { Mail, Trash2, RefreshCw, Clock, CheckCircle, XCircle, Minus, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface GmailAccount {
    id: number;
    email: string;
    password: string;
    type: string;
    domain: string;
    status: string;
    lastLoginTime: string | null;
    delete_at: string | null;
    created_at: string;
    sold_at: string | null;
}

interface GmailStats {
    total: number;
    available: number;
    sold: number;
    deleted: number;
}

interface GmailSettings {
    gmail_edu_price: number;
    gmail_edu_delete_hours: number;
    gmail_edu_enabled: boolean;
    gmail_edu_domain: string;
}

export default function GmailEduPage() {
    const { t } = useLanguage();
    const [accounts, setAccounts] = useState<GmailAccount[]>([]);
    const [stats, setStats] = useState<GmailStats>({ total: 0, available: 0, sold: 0, deleted: 0 });
    const [settings, setSettings] = useState<GmailSettings>({
        gmail_edu_price: 10000,
        gmail_edu_delete_hours: 1,
        gmail_edu_enabled: true,
        gmail_edu_domain: 'suafpoly.app'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [savingSold, setSavingSold] = useState(false);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                type: 'edu',
                page: page.toString(),
                limit: '20'
            });
            if (statusFilter) params.set('status', statusFilter);

            const res = await fetch(`/api/gmail-edu?${params}`);
            const data = await res.json();

            if (data.success) {
                setAccounts(data.data);
                setStats(data.stats);
                setTotalPages(data.pagination.totalPages);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/gmail-edu/price');
            const data = await res.json();
            setSettings(data);
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const updateSoldCount = async (nextValue: number) => {
        const soldCount = Math.max(0, Math.trunc(nextValue));
        setStats(current => ({ ...current, sold: soldCount }));
        setSavingSold(true);
        try {
            const response = await fetch('/api/gmail-edu', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sold_count: soldCount }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Không thể cập nhật số Gmail EDU đã bán');
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không thể cập nhật số đã bán');
            fetchAccounts();
        } finally {
            setSavingSold(false);
        }
    };

    const saveSettings = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/gmail-edu/price', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (data.success) {
                alert(t('gmail_edu.saved_success'));
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            alert(t('gmail_edu.save_error'));
        } finally {
            setSaving(false);
        }
    };

    const deleteAccount = async (id: number) => {
        if (!confirm(t('gmail_edu.confirm_delete'))) return;

        try {
            const res = await fetch('/api/gmail-edu', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                fetchAccounts();
            }
        } catch (error) {
            console.error('Error deleting account:', error);
        }
    };

    useEffect(() => {
        fetchAccounts();
        fetchSettings();
    }, [page, statusFilter]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'available':
                return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> {t('gmail_edu.status_available')}</span>;
            case 'sold':
                return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"><Clock className="w-3 h-3 mr-1" /> {t('gmail_edu.status_sold')}</span>;
            case 'deleted':
                return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" /> {t('gmail_edu.status_deleted')}</span>;
            default:
                return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">{t('gmail_edu.title')}</h1>
                <Button onClick={fetchAccounts} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t('gmail_edu.refresh')}
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('gmail_edu.total')}</CardTitle>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('gmail_edu.available')}</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.available}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('gmail_edu.sold')}</CardTitle>
                        <Clock className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                            <button type="button" onClick={() => updateSoldCount(stats.sold - 1)} disabled={savingSold || stats.sold <= 0} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white disabled:opacity-35" aria-label="Giảm số Gmail EDU đã bán"><Minus className="h-4 w-4" /></button>
                            <input type="number" min="0" value={stats.sold} onChange={(event) => setStats(current => ({ ...current, sold: Math.max(0, Number(event.target.value)) }))} onBlur={(event) => updateSoldCount(Number(event.target.value))} className="h-8 min-w-0 flex-1 border-0 bg-transparent p-0 text-center text-xl font-bold text-emerald-700 shadow-none focus:ring-0" aria-label="Số Gmail EDU đã bán" />
                            <button type="button" onClick={() => updateSoldCount(stats.sold + 1)} disabled={savingSold} className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-white hover:text-emerald-700 disabled:opacity-35" aria-label="Tăng số Gmail EDU đã bán"><Plus className="h-4 w-4" /></button>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{t('gmail_edu.deleted')}</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.deleted}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Settings Card */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('gmail_edu.settings_title')}</CardTitle>
                    <CardDescription>{t('gmail_edu.settings_desc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                            <Label htmlFor="price">{t('gmail_edu.price_label')}</Label>
                            <Input
                                id="price"
                                type="number"
                                value={settings.gmail_edu_price}
                                onChange={(e) => setSettings({ ...settings, gmail_edu_price: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="hours">{t('gmail_edu.delete_hours')}</Label>
                            <Input
                                id="hours"
                                type="number"
                                min="1"
                                value={settings.gmail_edu_delete_hours}
                                onChange={(e) => setSettings({ ...settings, gmail_edu_delete_hours: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="domain">{t('gmail_edu.default_domain')}</Label>
                            <Input
                                id="domain"
                                value={settings.gmail_edu_domain}
                                onChange={(e) => setSettings({ ...settings, gmail_edu_domain: e.target.value })}
                            />
                        </div>
                        <div className="flex items-end space-x-2">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="enabled"
                                    checked={settings.gmail_edu_enabled}
                                    onCheckedChange={(checked) => setSettings({ ...settings, gmail_edu_enabled: checked })}
                                />
                                <Label htmlFor="enabled">{t('gmail_edu.enable_selling')}</Label>
                            </div>
                        </div>
                    </div>
                    <Button onClick={saveSettings} disabled={saving}>
                        {saving ? t('gmail_edu.saving') : t('gmail_edu.save_settings')}
                    </Button>
                </CardContent>
            </Card>

            {/* Accounts Table */}
            <Card>
                <CardHeader>
                    <CardTitle>{t('gmail_edu.list_title')}</CardTitle>
                    <div className="flex gap-2 mt-2">
                        <Button
                            variant={statusFilter === '' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('')}
                        >
                            {t('gmail_edu.filter_all')}
                        </Button>
                        <Button
                            variant={statusFilter === 'available' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('available')}
                        >
                            {t('gmail_edu.status_available')}
                        </Button>
                        <Button
                            variant={statusFilter === 'sold' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('sold')}
                        >
                            {t('gmail_edu.status_sold')}
                        </Button>
                        <Button
                            variant={statusFilter === 'deleted' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('deleted')}
                        >
                            {t('gmail_edu.status_deleted')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">{t('gmail_edu.loading')}</div>
                    ) : accounts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            {t('gmail_edu.no_accounts')}
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>{t('gmail_edu.email')}</TableHead>
                                        <TableHead>{t('gmail_edu.password')}</TableHead>
                                        <TableHead>{t('gmail_edu.status')}</TableHead>
                                        <TableHead>{t('gmail_edu.login_time')}</TableHead>
                                        <TableHead>{t('gmail_edu.delete_at')}</TableHead>
                                        <TableHead>{t('gmail_edu.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {accounts.map((account) => (
                                        <TableRow key={account.id}>
                                            <TableCell>{account.id}</TableCell>
                                            <TableCell className="font-mono text-sm">{account.email}</TableCell>
                                            <TableCell className="font-mono text-sm">{account.password}</TableCell>
                                            <TableCell>{getStatusBadge(account.status)}</TableCell>
                                            <TableCell>
                                                {account.lastLoginTime
                                                    ? formatDate(account.lastLoginTime)
                                                    : <span className="text-muted-foreground">{t('gmail_edu.not_logged_in')}</span>}
                                            </TableCell>
                                            <TableCell>
                                                {account.delete_at
                                                    ? formatDate(account.delete_at)
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {account.status !== 'deleted' && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => deleteAccount(account.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                    >
                                        {t('gmail_edu.prev_page')}
                                    </Button>
                                    <span className="flex items-center px-3">
                                        {t('gmail_edu.page_info').replace('{current}', String(page)).replace('{total}', String(totalPages))}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                    >
                                        {t('gmail_edu.next_page')}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
