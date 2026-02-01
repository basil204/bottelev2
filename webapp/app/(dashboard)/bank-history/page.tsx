'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { RefreshCw, ArrowUpCircle, ArrowDownCircle, Filter } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Transaction {
    msisdn: string;
    clientCode: string;
    clientId: string;
    msgContent: string;
    transDate: string;
    accountId: string;
    amount: string;
    balance: string;
    bankTransId: string;
    description: string;
    paymentType: 'CREDIT' | 'DEBIT';
}

export default function BankHistoryPage() {
    const { t } = useLanguage();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/bank-history');
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || t('bank_history.load_error'));
                setTransactions([]);
                setFilteredTransactions([]);
            } else {
                const txs = data.content || [];
                setTransactions(txs);
                setFilteredTransactions(txs);
            }
        } catch (err) {
            setError(t('bank_history.server_error'));
            setTransactions([]);
            setFilteredTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleFilter = () => {
        let filtered = [...transactions];

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            filtered = filtered.filter(tx => {
                const txDate = new Date(tx.transDate.replace(' ', 'T'));
                return txDate >= fromDate;
            });
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(tx => {
                const txDate = new Date(tx.transDate.replace(' ', 'T'));
                return txDate <= toDate;
            });
        }

        setFilteredTransactions(filtered);
    };

    const clearFilter = () => {
        setDateFrom('');
        setDateTo('');
        setFilteredTransactions(transactions);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('bank_history.title')}</h2>
                    <p className="text-muted-foreground">{t('bank_history.subtitle')}</p>
                </div>
                <Button onClick={fetchHistory} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    {t('bank_history.refresh')}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        {t('bank_history.filter_by_date')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('bank_history.from_date')}</label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('bank_history.to_date')}</label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-40"
                            />
                        </div>
                        <Button onClick={handleFilter}>
                            <Filter className="w-4 h-4 mr-2" />
                            {t('bank_history.filter')}
                        </Button>
                        <Button variant="outline" onClick={clearFilter}>
                            {t('bank_history.clear_filter')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>
                        {t('bank_history.transactions')} ({filteredTransactions.length})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {error ? (
                        <div className="text-center py-8 text-destructive">
                            ❌ {error}
                        </div>
                    ) : loading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="rounded-md border overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('bank_history.type')}</TableHead>
                                        <TableHead>{t('bank_history.time')}</TableHead>
                                        <TableHead>{t('bank_history.amount')}</TableHead>
                                        <TableHead>{t('bank_history.balance')}</TableHead>
                                        <TableHead>{t('bank_history.trans_id')}</TableHead>
                                        <TableHead className="max-w-[300px]">{t('bank_history.content')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredTransactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                {t('bank_history.no_transactions')}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredTransactions.map((tx, index) => (
                                            <TableRow key={tx.clientId || index}>
                                                <TableCell>
                                                    {tx.paymentType === 'CREDIT' ? (
                                                        <span className="flex items-center gap-1 text-green-600">
                                                            <ArrowDownCircle className="w-4 h-4" />
                                                            {t('bank_history.credit')}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-red-600">
                                                            <ArrowUpCircle className="w-4 h-4" />
                                                            {t('bank_history.debit')}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {tx.transDate}
                                                </TableCell>
                                                <TableCell className={`font-bold ${tx.paymentType === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {tx.paymentType === 'CREDIT' ? '+' : '-'}{formatCurrency(Number(tx.amount))}
                                                </TableCell>
                                                <TableCell>
                                                    {formatCurrency(Number(tx.balance))}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {tx.bankTransId}
                                                </TableCell>
                                                <TableCell className="max-w-[300px] truncate" title={tx.msgContent}>
                                                    {tx.msgContent || tx.description}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
