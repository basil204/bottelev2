'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { clsx } from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Wallet, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';

interface Deposit {
    id: number;
    user_id: number;
    username: string;
    amount: number;
    tx_ref: string;
    status: 'pending' | 'approved' | 'rejected';
    type?: 'bank' | 'usdt';
    created_at: string;
}

import { useLanguage } from '@/contexts/LanguageContext';

export default function DepositsPage() {
    const { t } = useLanguage();
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [typeFilter, setTypeFilter] = useState<'all' | 'bank' | 'usdt'>('all');

    useEffect(() => {
        setLoading(true);
        const typeParam = typeFilter !== 'all' ? `&type=${typeFilter}` : '';
        fetch(`/api/deposits?page=${page}&limit=10${typeParam}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.error) {
                    console.error("API Error:", data.error);
                    setLoading(false);
                    return;
                }
                if (!data.data || !data.pagination) {
                    console.error("Invalid API response:", data);
                    setLoading(false);
                    return;
                }
                setDeposits(data.data);
                setTotalPages(data.pagination.totalPages);
                setLoading(false);
            })
            .catch(err => {
                console.error("Fetch error:", err);
                setLoading(false);
            });
    }, [page, typeFilter]);

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
            case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
            default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'approved': return t('deposits.approved');
            case 'pending': return t('deposits.pending');
            case 'rejected': return t('deposits.rejected');
            default: return status;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('deposits.title')}</h2>
                    <p className="text-muted-foreground">{t('deposits.subtitle')}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-primary" />
                        {t('deposits.transactions')}
                    </CardTitle>
                    <div className="flex gap-2 pt-2">
                        <Button variant={typeFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => { setTypeFilter('all'); setPage(1); }}>Tất cả</Button>
                        <Button variant={typeFilter === 'bank' ? 'default' : 'outline'} size="sm" onClick={() => { setTypeFilter('bank'); setPage(1); }}>🏦 Bank</Button>
                        <Button variant={typeFilter === 'usdt' ? 'default' : 'outline'} size="sm" onClick={() => { setTypeFilter('usdt'); setPage(1); }}>💲 USDT</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('deposits.id')}</TableHead>
                                    <TableHead>{t('deposits.user')}</TableHead>
                                    <TableHead>{t('deposits.tx_ref')}</TableHead>
                                    <TableHead>{t('deposits.amount')}</TableHead>
                                    <TableHead>{t('deposits.status')}</TableHead>
                                    <TableHead>{t('deposits.date')}</TableHead>
                                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">{t('common.loading')}</TableCell>
                                    </TableRow>
                                ) : (
                                    deposits.map((deposit) => (
                                        <TableRow key={deposit.id}>
                                            <TableCell>#{deposit.id}</TableCell>
                                            <TableCell className="font-medium">{deposit.username || `User #${deposit.user_id}`}</TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{deposit.tx_ref || '-'}</TableCell>
                                            <TableCell className="font-bold text-green-600 dark:text-green-400">
                                                {formatCurrency(deposit.amount)}
                                            </TableCell>
                                            <TableCell>
                                                <span className={clsx("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", getStatusStyles(deposit.status))}>
                                                    {getStatusLabel(deposit.status)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {new Date(deposit.created_at).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {deposit.status === 'pending' && (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="default" // Changed to default (usually primary color) or explicit green if possible, but default is fine.
                                                            className="bg-green-600 hover:bg-green-700 text-white h-8 px-2"
                                                            onClick={async () => {
                                                                if (!confirm('Bạn có chắc chắn muốn DUYỆT yêu cầu này?')) return;

                                                                let amount = deposit.amount;
                                                                // Always prompt for amount if it's 0 (pending usdt) or even if likely bank ref, just to be safe or allow correction?
                                                                // For now, if amount is 0, we MUST prompt.
                                                                // If amount > 0, we can prompt with default value.

                                                                const input = prompt('Nhập số tiền thực nhận (VNĐ):', deposit.amount.toString());
                                                                if (input === null) return; // Cancelled

                                                                const parsed = parseInt(input.replace(/\D/g, ''));
                                                                if (isNaN(parsed) || parsed <= 0) {
                                                                    alert('Số tiền không hợp lệ');
                                                                    return;
                                                                }
                                                                amount = parsed;

                                                                try {
                                                                    const res = await fetch('/api/deposits', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ depositId: deposit.id, action: 'approve', amount })
                                                                    });
                                                                    if (res.ok) {
                                                                        // Update local state with new status AND amount
                                                                        setDeposits(prev => prev.map(d => d.id === deposit.id ? { ...d, status: 'approved', amount: amount } : d));
                                                                    } else {
                                                                        const text = await res.text();
                                                                        alert('Failed to approve: ' + text);
                                                                    }
                                                                } catch (e) { console.error(e); alert('Error'); }
                                                            }}
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="h-8 px-2"
                                                            onClick={async () => {
                                                                if (!confirm('Bạn có chắc chắn muốn TỪ CHỐI yêu cầu này?')) return;
                                                                try {
                                                                    const res = await fetch('/api/deposits', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ depositId: deposit.id, action: 'reject' })
                                                                    });
                                                                    if (res.ok) {
                                                                        setDeposits(prev => prev.map(d => d.id === deposit.id ? { ...d, status: 'rejected' } : d));
                                                                    } else {
                                                                        alert('Failed to reject');
                                                                    }
                                                                } catch (e) { console.error(e); alert('Error'); }
                                                            }}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-end space-x-2 py-4">
                        <div className="text-sm text-muted-foreground">
                            Page {page} of {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || loading}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
