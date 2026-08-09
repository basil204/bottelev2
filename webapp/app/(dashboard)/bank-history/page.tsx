'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { RefreshCw, ArrowUpCircle, ArrowDownCircle, Filter, Calendar, TrendingUp, DollarSign } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Transaction {
    msisdn?: string;
    clientCode?: string;
    clientId?: string;
    msgContent?: string;
    transDate: string;
    accountId?: string;
    amount: string;
    balance?: string;
    bankTransId: string;
    description: string;
    paymentType?: 'CREDIT' | 'DEBIT';
    bank?: string;
}

interface DailySummary {
    date: string;
    totalCredit: number;
    totalDebit: number;
    count: number;
}

interface MonthlySummary {
    month: string;
    totalCredit: number;
    totalDebit: number;
    count: number;
}

interface BankBalanceSummary {
    bank: string;
    totalCredit: number;
    totalDebit: number;
    balance: number;
    transactionCount: number;
}

const BANK_LABELS: Record<string, string> = {
    VIETTEL: 'ViettelPay',
    VCB: 'Vietcombank',
    TPB: 'TPBank',
    MB: 'MBBank',
    ACB: 'ACB',
    TCB: 'Techcombank',
    VP: 'VPBank',
    TIMO: 'Timo',
};

export default function BankHistoryPage() {
    const { t } = useLanguage();
    const { formatPrice } = useCurrency();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [viewMode, setViewMode] = useState<'all' | 'daily' | 'monthly'>('all');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');

    // Sync transactions to database
    const syncToDatabase = async () => {
        setSyncing(true);
        setSyncMessage('');
        try {
            const res = await fetch('/api/bank-transactions', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSyncMessage(`✅ Đã lưu ${data.synced} giao dịch mới (bỏ qua ${data.skipped} đã có)`);
            } else {
                setSyncMessage(`❌ Lỗi: ${data.error}`);
            }
        } catch (err) {
            setSyncMessage('❌ Lỗi kết nối server');
        } finally {
            setSyncing(false);
        }
    };

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
                const rawTxs = data.transactions || data.content || data.trans || [];
                const txs = rawTxs.map((rawTx: any) => {
                    const rawAmt = rawTx.amount || rawTx.transAmount || '0';
                    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/\./g, '').replace(/,/g, '')) || 0;
                    return {
                        ...rawTx,
                        bankTransId: rawTx.bankTransId || rawTx.id || rawTx.transactionId || rawTx.requestId || '',
                        amount: parsedAmount.toString(),
                        description: rawTx.msgContent || rawTx.description || rawTx.transDesc || '',
                        transDate: rawTx.transDate || rawTx.requestDate || '',
                        paymentType: rawTx.paymentType || (rawTx.spendMoneyTransaction === true ? 'DEBIT' : 'CREDIT'),
                        balance: rawTx.balance || null,
                        msgContent: rawTx.msgContent || rawTx.transDesc || ''
                    };
                });
                setTransactions(txs);
                setFilteredTransactions(txs);

                // Auto sync to database when fetching
                syncToDatabase();
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
        // Set default selected date to today
        const today = new Date();
        setSelectedDate(today.toISOString().split('T')[0]);
        setSelectedMonth(today.toISOString().slice(0, 7));
    }, []);

    // Calculate daily summaries
    const dailySummaries = useMemo(() => {
        const summaryMap = new Map<string, DailySummary>();

        transactions.forEach(tx => {
            const date = tx.transDate.split(' ')[0]; // Get date part only
            const existing = summaryMap.get(date) || { date, totalCredit: 0, totalDebit: 0, count: 0 };

            if ((tx.paymentType || 'CREDIT') === 'CREDIT') {
                existing.totalCredit += Number(tx.amount);
            } else {
                existing.totalDebit += Number(tx.amount);
            }
            existing.count++;
            summaryMap.set(date, existing);
        });

        return Array.from(summaryMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions]);

    // Calculate monthly summaries
    const monthlySummaries = useMemo(() => {
        const summaryMap = new Map<string, MonthlySummary>();

        transactions.forEach(tx => {
            const dateParts = tx.transDate.split(' ')[0].split('/');
            // Format: DD/MM/YYYY -> YYYY-MM
            const month = dateParts.length === 3 ? `${dateParts[2]}-${dateParts[1]}` : tx.transDate.slice(0, 7);
            const existing = summaryMap.get(month) || { month, totalCredit: 0, totalDebit: 0, count: 0 };

            if ((tx.paymentType || 'CREDIT') === 'CREDIT') {
                existing.totalCredit += Number(tx.amount);
            } else {
                existing.totalDebit += Number(tx.amount);
            }
            existing.count++;
            summaryMap.set(month, existing);
        });

        return Array.from(summaryMap.values()).sort((a, b) => b.month.localeCompare(a.month));
    }, [transactions]);

    // Get today's summary
    const todaySummary = useMemo(() => {
        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        return dailySummaries.find(s => s.date === todayStr) || { date: todayStr, totalCredit: 0, totalDebit: 0, count: 0 };
    }, [dailySummaries]);

    // Get this month's summary
    const thisMonthSummary = useMemo(() => {
        const today = new Date();
        const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        return monthlySummaries.find(s => s.month === monthStr) || { month: monthStr, totalCredit: 0, totalDebit: 0, count: 0 };
    }, [monthlySummaries]);

    // Filter by specific date
    const filterByDate = (date: string) => {
        if (!date) {
            setFilteredTransactions(transactions);
            return;
        }
        const [year, month, day] = date.split('-');
        const dateStr = `${day}/${month}/${year}`;
        const filtered = transactions.filter(tx => tx.transDate.startsWith(dateStr));
        setFilteredTransactions(filtered);
        setViewMode('daily');
    };

    // Filter by specific month
    const filterByMonth = (month: string) => {
        if (!month) {
            setFilteredTransactions(transactions);
            return;
        }
        const [year, mon] = month.split('-');
        const monthStr = `/${mon}/${year}`;
        const filtered = transactions.filter(tx => tx.transDate.includes(monthStr));
        setFilteredTransactions(filtered);
        setViewMode('monthly');
    };

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
        setSelectedDate('');
        setSelectedMonth('');
        setViewMode('all');
        setFilteredTransactions(transactions);
    };

    // Calculate filtered summary
    const filteredSummary = useMemo(() => {
        let totalCredit = 0;
        let totalDebit = 0;
        filteredTransactions.forEach(tx => {
            if ((tx.paymentType || 'CREDIT') === 'CREDIT') {
                totalCredit += Number(tx.amount);
            } else {
                totalDebit += Number(tx.amount);
            }
        });
        return { totalCredit, totalDebit, count: filteredTransactions.length };
    }, [filteredTransactions]);

    // Calculate the net balance of every bank from all loaded transactions.
    // A bank is shown automatically as soon as it has at least one transaction.
    const bankBalanceSummaries = useMemo(() => {
        const summaryMap = new Map<string, BankBalanceSummary>();

        transactions.forEach(tx => {
            const bank = (tx.bank || 'UNKNOWN').toUpperCase();
            const amount = Number(tx.amount) || 0;
            const existing = summaryMap.get(bank) || {
                bank,
                totalCredit: 0,
                totalDebit: 0,
                balance: 0,
                transactionCount: 0,
            };

            if ((tx.paymentType || 'CREDIT') === 'CREDIT') {
                existing.totalCredit += amount;
            } else {
                existing.totalDebit += amount;
            }

            existing.balance = existing.totalCredit - existing.totalDebit;
            existing.transactionCount++;
            summaryMap.set(bank, existing);
        });

        return Array.from(summaryMap.values()).sort((a, b) =>
            (BANK_LABELS[a.bank] || a.bank).localeCompare(BANK_LABELS[b.bank] || b.bank)
        );
    }, [transactions]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('bank_history.title')}</h2>
                    <p className="text-muted-foreground">{t('bank_history.subtitle')}</p>
                    {syncMessage && (
                        <p className="text-sm mt-1">{syncMessage}</p>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button onClick={syncToDatabase} disabled={syncing} variant="outline">
                        <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Đang lưu...' : 'Lưu vào DB'}
                    </Button>
                    <Button onClick={fetchHistory} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        {t('bank_history.refresh')}
                    </Button>
                </div>
            </div>

            {/* Balance by bank */}
            <section className="space-y-3" aria-labelledby="bank-balances-title">
                <div>
                    <h3 id="bank-balances-title" className="text-lg font-semibold">Tổng tiền theo ngân hàng</h3>
                    <p className="text-sm text-muted-foreground">Số dư = tổng tiền vào - tổng tiền chi</p>
                </div>

                {!loading && bankBalanceSummaries.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        Chưa có giao dịch ngân hàng để tính số dư.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {bankBalanceSummaries.map(summary => (
                            <Card key={summary.bank}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">
                                        {BANK_LABELS[summary.bank] || summary.bank}
                                    </CardTitle>
                                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <div className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {summary.balance < 0 ? '-' : ''}{formatPrice(Math.abs(summary.balance))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
                                        <div>
                                            <p className="text-muted-foreground">Tiền vào</p>
                                            <p className="mt-1 font-semibold text-emerald-600">+{formatPrice(summary.totalCredit)}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Tiền chi</p>
                                            <p className="mt-1 font-semibold text-red-600">-{formatPrice(summary.totalDebit)}</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{summary.transactionCount} giao dịch</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </section>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Hôm nay</CardTitle>
                        <Calendar className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-500">+{formatPrice(todaySummary.totalCredit)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {todaySummary.count} giao dịch nhận
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tháng này</CardTitle>
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">+{formatPrice(thisMonthSummary.totalCredit)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {thisMonthSummary.count} giao dịch nhận
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Chi hôm nay</CardTitle>
                        <ArrowUpCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">-{formatPrice(todaySummary.totalDebit)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Tổng chi tiêu hôm nay
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Đang lọc</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">+{formatPrice(filteredSummary.totalCredit)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {filteredSummary.count} giao dịch
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Filter Buttons */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5" />
                        Lọc nhanh
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-4">
                        {/* View Mode Buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant={viewMode === 'all' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => {
                                    setViewMode('all');
                                    setFilteredTransactions(transactions);
                                }}
                            >
                                Tất cả
                            </Button>
                            <Button
                                variant={viewMode === 'daily' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setViewMode('daily')}
                            >
                                Theo ngày
                            </Button>
                            <Button
                                variant={viewMode === 'monthly' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setViewMode('monthly')}
                            >
                                Theo tháng
                            </Button>
                        </div>

                        {/* Date Picker */}
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => {
                                    setSelectedDate(e.target.value);
                                    filterByDate(e.target.value);
                                }}
                                className="w-40"
                            />
                            <span className="text-muted-foreground">hoặc</span>
                            <Input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => {
                                    setSelectedMonth(e.target.value);
                                    filterByMonth(e.target.value);
                                }}
                                className="w-40"
                            />
                        </div>

                        <Button variant="outline" size="sm" onClick={clearFilter}>
                            Xóa lọc
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Daily Summary Table */}
            {viewMode === 'daily' && (
                <Card>
                    <CardHeader>
                        <CardTitle>📅 Thống kê theo ngày</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-auto max-h-[400px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ngày</TableHead>
                                        <TableHead className="text-green-500">Tổng nhận (+)</TableHead>
                                        <TableHead className="text-red-500">Tổng chi (-)</TableHead>
                                        <TableHead>Số GD</TableHead>
                                        <TableHead>Thao tác</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dailySummaries.map((summary) => (
                                        <TableRow key={summary.date}>
                                            <TableCell className="font-medium">{summary.date}</TableCell>
                                            <TableCell className="text-green-500 font-bold">+{formatPrice(summary.totalCredit)}</TableCell>
                                            <TableCell className="text-red-500 font-bold">-{formatPrice(summary.totalDebit)}</TableCell>
                                            <TableCell>{summary.count}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        const [d, m, y] = summary.date.split('/');
                                                        setSelectedDate(`${y}-${m}-${d}`);
                                                        filterByDate(`${y}-${m}-${d}`);
                                                    }}
                                                >
                                                    Xem chi tiết
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Monthly Summary Table */}
            {viewMode === 'monthly' && (
                <Card>
                    <CardHeader>
                        <CardTitle>📊 Thống kê theo tháng</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-auto max-h-[400px]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tháng</TableHead>
                                        <TableHead className="text-green-500">Tổng nhận (+)</TableHead>
                                        <TableHead className="text-red-500">Tổng chi (-)</TableHead>
                                        <TableHead>Số GD</TableHead>
                                        <TableHead>Thao tác</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {monthlySummaries.map((summary) => (
                                        <TableRow key={summary.month}>
                                            <TableCell className="font-medium">{summary.month}</TableCell>
                                            <TableCell className="text-green-500 font-bold">+{formatPrice(summary.totalCredit)}</TableCell>
                                            <TableCell className="text-red-500 font-bold">-{formatPrice(summary.totalDebit)}</TableCell>
                                            <TableCell>{summary.count}</TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedMonth(summary.month);
                                                        filterByMonth(summary.month);
                                                    }}
                                                >
                                                    Xem chi tiết
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Original Date Range Filter */}
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
                                        <TableHead>Ngân hàng</TableHead>
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
                                             <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                                 {t('bank_history.no_transactions')}
                                             </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredTransactions.map((tx, index) => (
                                            <TableRow key={tx.clientId || index}>
                                                <TableCell>
                                                    {(tx.paymentType || 'CREDIT') === 'CREDIT' ? (
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
                                                <TableCell>
                                                    {(() => {
                                                        const bankBadges: Record<string, { label: string; style: string }> = {
                                                            VIETTEL: { label: 'ViettelPay', style: 'bg-red-500/10 text-red-400 border border-red-500/20' },
                                                            VCB: { label: 'Vietcombank', style: 'bg-green-500/10 text-green-400 border border-green-500/20' },
                                                            TPB: { label: 'TPBank', style: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' },
                                                            MB: { label: 'MBBank', style: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' },
                                                            ACB: { label: 'ACB', style: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20' },
                                                            TCB: { label: 'Techcombank', style: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' },
                                                            VP: { label: 'VPBank', style: 'bg-teal-500/10 text-teal-400 border border-teal-500/20' },
                                                            TIMO: { label: 'Timo', style: 'bg-orange-500/10 text-orange-400 border border-orange-500/20' }
                                                        };
                                                        const badge = bankBadges[tx.bank || ''] || { label: tx.bank || 'Unknown', style: 'bg-slate-500/10 text-zinc-500 border border-slate-500/20' };
                                                        return (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.style}`}>
                                                                {badge.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {tx.transDate}
                                                </TableCell>
                                                <TableCell className={`font-bold ${(tx.paymentType || 'CREDIT') === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {(tx.paymentType || 'CREDIT') === 'CREDIT' ? '+' : '-'}{formatPrice(Number(tx.amount))}
                                                </TableCell>
                                                <TableCell>
                                                    {tx.balance !== null && tx.balance !== undefined ? formatPrice(Number(tx.balance)) : '-'}
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
