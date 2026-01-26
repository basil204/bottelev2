'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { clsx } from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from 'lucide-react'; // Wait, standard lucide Badge? No, I need a UI Badge. I'll simulate it with span.
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Wallet, ChevronLeft, ChevronRight } from 'lucide-react';

interface Deposit {
    id: number;
    user_id: number;
    username: string;
    amount: number;
    tx_ref: string;
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
}

import { useLanguage } from '@/contexts/LanguageContext';

export default function DepositsPage() {
    const { t } = useLanguage();
    const [deposits, setDeposits] = useState<Deposit[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/deposits?page=${page}&limit=10`)
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
    }, [page]);

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
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">{t('common.loading')}</TableCell>
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
