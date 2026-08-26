'use client';

import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    RefreshCw,
    ArrowUpCircle,
    ArrowDownCircle,
    Calendar,
    TrendingUp,
    DollarSign,
    Landmark,
    Search,
    Download,
    Copy,
    Check,
    X,
    Filter,
    Layers,
    Clock,
    Eye,
    SlidersHorizontal,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/hooks/useCurrency';

interface Transaction {
    msisdn?: string;
    clientCode?: string;
    clientId?: string;
    msgContent?: string;
    transDate: string;
    accountId?: string;
    amount: string;
    balance?: string | null;
    bankTransId: string;
    description: string;
    paymentType?: 'CREDIT' | 'DEBIT';
    bank?: string;
    rawDateMs?: number;
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

const BANK_INFO: Record<string, { label: string; bg: string; text: string; border: string; badge: string; icon: string }> = {
    VIETTEL: { label: 'ViettelPay', bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', badge: 'bg-red-50 text-red-700 border-red-200', icon: '🔴' },
    VCB: { label: 'Vietcombank', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: '🟢' },
    TPB: { label: 'TPBank', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-50 text-purple-700 border-purple-200', icon: '🟣' },
    MB: { label: 'MBBank', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-50 text-blue-700 border-blue-200', icon: '🔵' },
    ACB: { label: 'ACB', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', badge: 'bg-sky-50 text-sky-700 border-sky-200', icon: '🔷' },
    TCB: { label: 'Techcombank', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: '🔺' },
    VP: { label: 'VPBank', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', badge: 'bg-teal-50 text-teal-700 border-teal-200', icon: '🟩' },
    TIMO: { label: 'Timo', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: '⚡' },
};

export default function BankHistoryPage() {
    const { t } = useLanguage();
    const { formatPrice } = useCurrency();

    // Data states
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<{ text: string; success: boolean } | null>(null);

    // Filter states
    const [activeTab, setActiveTab] = useState<'all' | 'daily' | 'monthly'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBank, setSelectedBank] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<'all' | 'CREDIT' | 'DEBIT'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [quickDatePreset, setQuickDatePreset] = useState<'all' | 'today' | 'yesterday' | '7days' | 'this_month'>('all');

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Detail Modal
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const copyToClipboard = (text: string, keyName: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(keyName);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Sync transactions to database
    const syncToDatabase = async () => {
        setSyncing(true);
        setSyncMessage(null);
        try {
            const res = await fetch('/api/bank-transactions', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setSyncMessage({
                    text: `Đã lưu ${data.synced || 0} giao dịch mới vào Database (bỏ qua ${data.skipped || 0} đã tồn tại)`,
                    success: true
                });
            } else {
                setSyncMessage({ text: data.error || 'Lỗi khi đồng bộ', success: false });
            }
        } catch (err) {
            setSyncMessage({ text: 'Lỗi kết nối máy chủ khi đồng bộ', success: false });
        } finally {
            setSyncing(false);
            setTimeout(() => setSyncMessage(null), 6000);
        }
    };

    const fetchHistory = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/bank-history');
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Không thể tải lịch sử ngân hàng');
                setTransactions([]);
            } else {
                const rawTxs = data.transactions || data.content || data.trans || [];
                const txs: Transaction[] = rawTxs.map((rawTx: any) => {
                    const rawAmt = rawTx.amount || rawTx.transAmount || '0';
                    const parsedAmount = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt.toString().replace(/\./g, '').replace(/,/g, '')) || 0;
                    return {
                        ...rawTx,
                        bankTransId: rawTx.bankTransId || rawTx.id || rawTx.transactionId || rawTx.requestId || '',
                        amount: parsedAmount.toString(),
                        description: rawTx.msgContent || rawTx.description || rawTx.transDesc || '',
                        transDate: rawTx.transDate || rawTx.requestDate || '',
                        paymentType: rawTx.paymentType || (rawTx.spendMoneyTransaction === true ? 'DEBIT' : 'CREDIT'),
                        balance: rawTx.balance !== undefined && rawTx.balance !== null ? String(rawTx.balance) : null,
                        msgContent: rawTx.msgContent || rawTx.transDesc || rawTx.description || '',
                        bank: (rawTx.bank || 'UNKNOWN').toUpperCase()
                    };
                });
                setTransactions(txs);

                // Auto-sync in background
                syncToDatabase();
            }
        } catch (err) {
            setError('Lỗi kết nối máy chủ');
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    // Quick Date Preset handler
    const applyDatePreset = (preset: 'all' | 'today' | 'yesterday' | '7days' | 'this_month') => {
        setQuickDatePreset(preset);
        const now = new Date();
        const formatDateStr = (d: Date) => d.toISOString().split('T')[0];

        if (preset === 'all') {
            setDateFrom('');
            setDateTo('');
        } else if (preset === 'today') {
            const todayStr = formatDateStr(now);
            setDateFrom(todayStr);
            setDateTo(todayStr);
        } else if (preset === 'yesterday') {
            const yest = new Date(now);
            yest.setDate(yest.getDate() - 1);
            const yestStr = formatDateStr(yest);
            setDateFrom(yestStr);
            setDateTo(yestStr);
        } else if (preset === '7days') {
            const past7 = new Date(now);
            past7.setDate(past7.getDate() - 7);
            setDateFrom(formatDateStr(past7));
            setDateTo(formatDateStr(now));
        } else if (preset === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            setDateFrom(formatDateStr(firstDay));
            setDateTo(formatDateStr(now));
        }
        setPage(1);
    };

    // Calculate Bank Balance Summaries
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
            (BANK_INFO[a.bank]?.label || a.bank).localeCompare(BANK_INFO[b.bank]?.label || b.bank)
        );
    }, [transactions]);

    // Calculate Daily Summaries
    const dailySummaries = useMemo(() => {
        const summaryMap = new Map<string, DailySummary>();

        transactions.forEach(tx => {
            const date = tx.transDate ? tx.transDate.split(' ')[0] : 'N/A';
            const existing = summaryMap.get(date) || { date, totalCredit: 0, totalDebit: 0, count: 0 };

            if ((tx.paymentType || 'CREDIT') === 'CREDIT') {
                existing.totalCredit += Number(tx.amount) || 0;
            } else {
                existing.totalDebit += Number(tx.amount) || 0;
            }
            existing.count++;
            summaryMap.set(date, existing);
        });

        return Array.from(summaryMap.values()).sort((a, b) => b.date.localeCompare(a.date));
    }, [transactions]);

    // Calculate Monthly Summaries
    const monthlySummaries = useMemo(() => {
        const summaryMap = new Map<string, MonthlySummary>();

        transactions.forEach(tx => {
            const datePart = tx.transDate ? tx.transDate.split(' ')[0] : '';
            const parts = datePart.split('/');
            const month = parts.length === 3 ? `${parts[2]}-${parts[1]}` : (tx.transDate ? tx.transDate.slice(0, 7) : 'N/A');
            const existing = summaryMap.get(month) || { month, totalCredit: 0, totalDebit: 0, count: 0 };

            if ((tx.paymentType || 'CREDIT') === 'CREDIT') {
                existing.totalCredit += Number(tx.amount) || 0;
            } else {
                existing.totalDebit += Number(tx.amount) || 0;
            }
            existing.count++;
            summaryMap.set(month, existing);
        });

        return Array.from(summaryMap.values()).sort((a, b) => b.month.localeCompare(a.month));
    }, [transactions]);

    // Top Overview KPIs
    const todaySummary = useMemo(() => {
        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
        return dailySummaries.find(s => s.date === todayStr) || { date: todayStr, totalCredit: 0, totalDebit: 0, count: 0 };
    }, [dailySummaries]);

    const thisMonthSummary = useMemo(() => {
        const today = new Date();
        const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        return monthlySummaries.find(s => s.month === monthStr) || { month: monthStr, totalCredit: 0, totalDebit: 0, count: 0 };
    }, [monthlySummaries]);

    const totalNetBalance = useMemo(() => {
        return bankBalanceSummaries.reduce((sum, item) => sum + item.balance, 0);
    }, [bankBalanceSummaries]);

    // Filtered Transactions
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchMsg = (tx.msgContent || tx.description || '').toLowerCase().includes(q);
                const matchId = (tx.bankTransId || '').toLowerCase().includes(q);
                const matchAmt = (tx.amount || '').includes(q);
                const matchBank = (tx.bank || '').toLowerCase().includes(q);
                if (!matchMsg && !matchId && !matchAmt && !matchBank) return false;
            }

            // Bank filter
            if (selectedBank !== 'all' && (tx.bank || '').toUpperCase() !== selectedBank.toUpperCase()) {
                return false;
            }

            // Type filter
            if (selectedType !== 'all') {
                const pType = tx.paymentType || 'CREDIT';
                if (pType !== selectedType) return false;
            }

            // Date Range
            if (dateFrom || dateTo) {
                let txDate: Date | null = null;
                if (tx.transDate.includes('/')) {
                    const [dPart, tPart] = tx.transDate.split(' ');
                    const [d, m, y] = dPart.split('/');
                    txDate = new Date(`${y}-${m}-${d}T${tPart || '00:00:00'}`);
                } else {
                    txDate = new Date(tx.transDate);
                }

                if (isNaN(txDate.getTime())) return true;

                if (dateFrom) {
                    const fDate = new Date(dateFrom);
                    fDate.setHours(0, 0, 0, 0);
                    if (txDate < fDate) return false;
                }
                if (dateTo) {
                    const tDate = new Date(dateTo);
                    tDate.setHours(23, 59, 59, 999);
                    if (txDate > tDate) return false;
                }
            }

            return true;
        });
    }, [transactions, searchQuery, selectedBank, selectedType, dateFrom, dateTo]);

    // Paginated items
    const totalPages = Math.ceil(filteredTransactions.length / pageSize) || 1;
    const paginatedTransactions = useMemo(() => {
        const start = (page - 1) * pageSize;
        return filteredTransactions.slice(start, start + pageSize);
    }, [filteredTransactions, page, pageSize]);

    // Summary of filtered
    const filteredStats = useMemo(() => {
        let totalCredit = 0;
        let totalDebit = 0;
        filteredTransactions.forEach(tx => {
            const amt = Number(tx.amount) || 0;
            if ((tx.paymentType || 'CREDIT') === 'CREDIT') {
                totalCredit += amt;
            } else {
                totalDebit += amt;
            }
        });
        return {
            totalCredit,
            totalDebit,
            net: totalCredit - totalDebit,
            count: filteredTransactions.length
        };
    }, [filteredTransactions]);

    // Export CSV
    const exportCSV = () => {
        if (filteredTransactions.length === 0) {
            alert('Không có dữ liệu giao dịch để xuất file!');
            return;
        }

        const headers = ['Mã Giao Dịch', 'Ngân Hàng', 'Loại', 'Số Tiền (VNĐ)', 'Số Dư Sau GD', 'Thời Gian', 'Nội Dung'];
        const rows = filteredTransactions.map(tx => [
            `"${tx.bankTransId}"`,
            `"${BANK_INFO[tx.bank || '']?.label || tx.bank || 'Khác'}"`,
            `"${(tx.paymentType || 'CREDIT') === 'CREDIT' ? 'Tiền vào (+)' : 'Tiền chi (-)'}"`,
            `"${tx.amount}"`,
            `"${tx.balance || ''}"`,
            `"${tx.transDate}"`,
            `"${(tx.msgContent || tx.description || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `lich_su_bank_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearFilters = () => {
        setSearchQuery('');
        setSelectedBank('all');
        setSelectedType('all');
        setDateFrom('');
        setDateTo('');
        setQuickDatePreset('all');
        setPage(1);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
            {/* Header Title & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 font-black border border-orange-200 shadow-2xs">
                        <Landmark className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
                            LỊCH SỬ BIẾN ĐỘNG SỐ DƯ BANK
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">
                            Giám sát biến động số dư thực tế từ Vietcombank, MBBank, TPBank, Techcombank, ACB, VPBank, Timo, ViettelPay
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={syncToDatabase}
                        disabled={syncing}
                        className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                        title="Lưu các giao dịch mới từ API Bank vào Database máy chủ"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 text-blue-600 ${syncing ? 'animate-spin' : ''}`} />
                        <span>{syncing ? 'ĐANG LƯU...' : 'ĐỒNG BỘ DB'}</span>
                    </button>

                    <button
                        onClick={exportCSV}
                        className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-50 transition active:scale-95 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                        <Download className="h-3.5 w-3.5 text-emerald-600" />
                        <span>XUẤT CSV</span>
                    </button>

                    <button
                        onClick={fetchHistory}
                        disabled={loading}
                        title="Tải lại lịch sử ngân hàng"
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 active:scale-95 transition shadow-2xs cursor-pointer"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-orange-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Sync Notification Banner */}
            {syncMessage && (
                <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
                    syncMessage.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                    {syncMessage.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
                    <span>{syncMessage.text}</span>
                </div>
            )}

            {/* Top 4 KPI Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">HÔM NAY NHẬN (+)</span>
                        <div className="h-7 w-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                            <ArrowDownCircle className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-emerald-600 mt-2">
                        +{formatPrice(todaySummary.totalCredit)}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-medium mt-1">
                        <span className="font-bold text-zinc-700">{todaySummary.count}</span> giao dịch trong ngày
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">HÔM NAY CHI (-)</span>
                        <div className="h-7 w-7 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-200">
                            <ArrowUpCircle className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-red-600 mt-2">
                        -{formatPrice(todaySummary.totalDebit)}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-medium mt-1">
                        Tổng tiền chi / hoàn tiền
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">THÁNG NÀY NHẬN (+)</span>
                        <div className="h-7 w-7 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="text-lg sm:text-xl font-black text-zinc-900 mt-2">
                        +{formatPrice(thisMonthSummary.totalCredit)}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-zinc-500 font-medium mt-1">
                        <span className="font-bold text-zinc-700">{thisMonthSummary.count}</span> GD nhận tháng này
                    </div>
                </div>

                <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">TỔNG SỐ DƯ TÍCH LŨY</span>
                        <div className="h-7 w-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
                            <DollarSign className="h-4 w-4" />
                        </div>
                    </div>
                    <div className={`text-lg sm:text-xl font-black mt-2 ${totalNetBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {totalNetBalance < 0 ? '-' : ''}{formatPrice(Math.abs(totalNetBalance))}
                    </div>
                    <div className="text-[11px] text-zinc-500 font-medium mt-1">
                        Tổng tiền vào trừ tiền chi
                    </div>
                </div>
            </div>

            {/* Bank Balance Cards Grid */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-zinc-700">TỔNG TIỀN THEO NGÂN HÀNG</span>
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">
                            {bankBalanceSummaries.length} Ngân hàng
                        </span>
                    </div>
                    <span className="text-[11px] text-zinc-400 font-medium">Bấm vào ngân hàng để lọc nhanh</span>
                </div>

                {bankBalanceSummaries.length === 0 && !loading ? (
                    <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-center text-xs text-zinc-400">
                        Chưa có giao dịch ngân hàng nào để thống kê số dư.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {bankBalanceSummaries.map((summary) => {
                            const info = BANK_INFO[summary.bank] || {
                                label: summary.bank,
                                bg: 'bg-zinc-50',
                                text: 'text-zinc-700',
                                border: 'border-zinc-200',
                                badge: 'bg-zinc-100 text-zinc-700 border-zinc-200',
                                icon: '🏦'
                            };
                            const isSelected = selectedBank.toUpperCase() === summary.bank.toUpperCase();

                            return (
                                <div
                                    key={summary.bank}
                                    onClick={() => {
                                        if (isSelected) {
                                            setSelectedBank('all');
                                        } else {
                                            setSelectedBank(summary.bank);
                                            setActiveTab('all');
                                        }
                                        setPage(1);
                                    }}
                                    className={`rounded-2xl border bg-white p-3.5 shadow-2xs transition-all cursor-pointer select-none relative ${
                                        isSelected ? 'ring-2 ring-orange-500 border-orange-500 bg-orange-50/20' : 'border-zinc-200/80 hover:border-zinc-300 hover:shadow-xs'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs">{info.icon}</span>
                                            <span className="font-black text-xs uppercase tracking-tight text-zinc-900">
                                                {info.label}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-zinc-400 font-bold">
                                            {summary.transactionCount} GD
                                        </span>
                                    </div>

                                    <div className={`text-base font-black mt-2 ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {summary.balance < 0 ? '-' : ''}{formatPrice(Math.abs(summary.balance))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-1 border-t border-zinc-100 mt-2.5 pt-2 text-[10px]">
                                        <div>
                                            <span className="text-zinc-400">Vào: </span>
                                            <span className="font-extrabold text-emerald-600">+{formatPrice(summary.totalCredit)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-zinc-400">Chi: </span>
                                            <span className="font-extrabold text-red-600">-{formatPrice(summary.totalDebit)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                        activeTab === 'all'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                >
                    <Layers className="h-3.5 w-3.5" />
                    <span>TẤT CẢ GIAO DỊCH ({transactions.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('daily')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                        activeTab === 'daily'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                >
                    <Calendar className="h-3.5 w-3.5" />
                    <span>THỐNG KÊ THEO NGÀY ({dailySummaries.length})</span>
                </button>

                <button
                    onClick={() => setActiveTab('monthly')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                        activeTab === 'monthly'
                            ? 'bg-orange-600 text-white shadow-xs'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>THỐNG KÊ THEO THÁNG ({monthlySummaries.length})</span>
                </button>
            </div>

            {/* TAB 1: ALL TRANSACTIONS */}
            {activeTab === 'all' && (
                <div className="space-y-4">
                    {/* Filter & Search Bar */}
                    <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 space-y-3 shadow-2xs">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            {/* Search box */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <input
                                    type="text"
                                    placeholder="Tìm theo nội dung chuyển khoản, mã GD, số tiền, ngân hàng..."
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-200 bg-zinc-50/50 text-xs font-medium text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-orange-500 focus:outline-hidden transition"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Bank Select */}
                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedBank}
                                    onChange={(e) => {
                                        setSelectedBank(e.target.value);
                                        setPage(1);
                                    }}
                                    className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs font-bold text-zinc-700 focus:bg-white focus:border-orange-500 focus:outline-hidden transition"
                                >
                                    <option value="all">Tất cả ngân hàng ({transactions.length})</option>
                                    {bankBalanceSummaries.map(b => (
                                        <option key={b.bank} value={b.bank}>
                                            {BANK_INFO[b.bank]?.label || b.bank} ({b.transactionCount})
                                        </option>
                                    ))}
                                </select>

                                {/* Type Select */}
                                <select
                                    value={selectedType}
                                    onChange={(e) => {
                                        setSelectedType(e.target.value as any);
                                        setPage(1);
                                    }}
                                    className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs font-bold text-zinc-700 focus:bg-white focus:border-orange-500 focus:outline-hidden transition"
                                >
                                    <option value="all">Tất cả loại (+ / -)</option>
                                    <option value="CREDIT">🟢 Tiền vào (+)</option>
                                    <option value="DEBIT">🔴 Tiền chi (-)</option>
                                </select>
                            </div>
                        </div>

                        {/* Date Range & Presets */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-zinc-100 pt-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1">Lọc nhanh:</span>
                                {[
                                    { id: 'all', label: 'Tất cả' },
                                    { id: 'today', label: 'Hôm nay' },
                                    { id: 'yesterday', label: 'Hôm qua' },
                                    { id: '7days', label: '7 ngày qua' },
                                    { id: 'this_month', label: 'Tháng này' },
                                ].map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => applyDatePreset(p.id as any)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                                            quickDatePreset === p.id
                                                ? 'bg-zinc-900 text-white shadow-2xs'
                                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1 text-xs">
                                    <span className="text-zinc-400 font-medium">Từ</span>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => {
                                            setDateFrom(e.target.value);
                                            setQuickDatePreset('all');
                                            setPage(1);
                                        }}
                                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-bold text-zinc-700 focus:bg-white focus:outline-hidden"
                                    />
                                    <span className="text-zinc-400 font-medium">Đến</span>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => {
                                            setDateTo(e.target.value);
                                            setQuickDatePreset('all');
                                            setPage(1);
                                        }}
                                        className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-bold text-zinc-700 focus:bg-white focus:outline-hidden"
                                    />
                                </div>

                                {(searchQuery || selectedBank !== 'all' || selectedType !== 'all' || dateFrom || dateTo) && (
                                    <button
                                        onClick={clearFilters}
                                        className="px-2.5 py-1 rounded-lg border border-zinc-200 bg-white text-[11px] font-bold text-zinc-600 hover:bg-zinc-50 transition cursor-pointer"
                                    >
                                        Xóa lọc
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Filtered stats indicator */}
                        <div className="flex items-center justify-between text-xs bg-zinc-50/80 rounded-xl p-2.5 border border-zinc-200/50">
                            <div className="flex items-center gap-3">
                                <span>Tìm thấy <strong className="text-zinc-900 font-black">{filteredStats.count}</strong> giao dịch</span>
                                <span className="text-zinc-300">|</span>
                                <span>Vào: <strong className="text-emerald-600 font-black">+{formatPrice(filteredStats.totalCredit)}</strong></span>
                                <span className="text-zinc-300">|</span>
                                <span>Chi: <strong className="text-red-600 font-black">-{formatPrice(filteredStats.totalDebit)}</strong></span>
                            </div>
                            <div className="font-bold text-zinc-700">
                                Chênh lệch: <span className={filteredStats.net >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                    {filteredStats.net < 0 ? '-' : ''}{formatPrice(Math.abs(filteredStats.net))}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xs">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                        <th className="px-4 py-3.5 font-extrabold">LOẠI</th>
                                        <th className="px-4 py-3.5 font-extrabold">NGÂN HÀNG</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">SỐ TIỀN</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">SỐ DƯ SAU GD</th>
                                        <th className="px-4 py-3.5 font-extrabold">MÃ GIAO DỊCH</th>
                                        <th className="px-4 py-3.5 font-extrabold">NỘI DUNG</th>
                                        <th className="px-4 py-3.5 font-extrabold">THỜI GIAN</th>
                                        <th className="px-4 py-3.5 font-extrabold text-center">CHI TIẾT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                <div className="flex items-center justify-center gap-2">
                                                    <RefreshCw className="h-4 w-4 animate-spin text-orange-600" />
                                                    <span>Đang tải lịch sử giao dịch ngân hàng...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginatedTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                Không có giao dịch ngân hàng nào phù hợp với bộ lọc.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedTransactions.map((tx, idx) => {
                                            const isCredit = (tx.paymentType || 'CREDIT') === 'CREDIT';
                                            const bankMeta = BANK_INFO[tx.bank || ''] || {
                                                label: tx.bank || 'Khác',
                                                badge: 'bg-zinc-100 text-zinc-700 border-zinc-200',
                                                icon: '🏦'
                                            };

                                            return (
                                                <tr key={tx.clientId || tx.bankTransId || idx} className="hover:bg-zinc-50/80 transition-colors">
                                                    <td className="px-4 py-3.5">
                                                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase border ${
                                                            isCredit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                                                        }`}>
                                                            {isCredit ? <ArrowDownCircle className="h-3 w-3 text-emerald-600" /> : <ArrowUpCircle className="h-3 w-3 text-red-500" />}
                                                            <span>{isCredit ? 'TIỀN VÀO' : 'TIỀN CHI'}</span>
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-3.5">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${bankMeta.badge}`}>
                                                            <span>{bankMeta.icon}</span>
                                                            <span>{bankMeta.label}</span>
                                                        </span>
                                                    </td>

                                                    <td className={`px-4 py-3.5 text-right font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {isCredit ? '+' : '-'}{formatPrice(Number(tx.amount))}
                                                    </td>

                                                    <td className="px-4 py-3.5 text-right font-mono font-extrabold text-zinc-900 text-xs">
                                                        {tx.balance !== null && tx.balance !== undefined && tx.balance !== '' ? formatPrice(Number(tx.balance)) : '-'}
                                                    </td>

                                                    <td className="px-4 py-3.5">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-[11px] font-bold text-zinc-800">
                                                                {tx.bankTransId || '-'}
                                                            </span>
                                                            {tx.bankTransId && (
                                                                <button
                                                                    onClick={() => copyToClipboard(tx.bankTransId, `id_${idx}`)}
                                                                    title="Sao chép mã giao dịch"
                                                                    className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition cursor-pointer"
                                                                >
                                                                    {copiedKey === `id_${idx}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-3.5 max-w-[280px]">
                                                        <div className="font-medium text-xs text-zinc-700 truncate" title={tx.msgContent || tx.description}>
                                                            {tx.msgContent || tx.description || '-'}
                                                        </div>
                                                    </td>

                                                    <td className="px-4 py-3.5 font-mono text-[10px] text-zinc-500 whitespace-nowrap">
                                                        {tx.transDate || '-'}
                                                    </td>

                                                    <td className="px-4 py-3.5 text-center">
                                                        <button
                                                            onClick={() => setSelectedTx(tx)}
                                                            className="p-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition active:scale-95 shadow-2xs cursor-pointer"
                                                            title="Xem chi tiết giao dịch"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-t border-zinc-100 bg-zinc-50/50">
                            <div className="text-xs text-zinc-500 font-medium flex items-center gap-2">
                                <span>
                                    Trang <strong className="text-zinc-900 font-bold">{page}</strong> / {totalPages} (Tổng {filteredTransactions.length} giao dịch)
                                </span>
                                <span className="text-zinc-300">|</span>
                                <div className="flex items-center gap-1">
                                    <span>Hiển thị:</span>
                                    <select
                                        value={pageSize}
                                        onChange={(e) => {
                                            setPageSize(Number(e.target.value));
                                            setPage(1);
                                        }}
                                        className="rounded-lg border border-zinc-200 bg-white px-2 py-0.5 text-xs font-bold text-zinc-700"
                                    >
                                        <option value={15}>15</option>
                                        <option value={20}>20</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page <= 1 || loading}
                                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-extrabold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition active:scale-95 shadow-2xs flex items-center gap-1 cursor-pointer"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    <span>Trang trước</span>
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page >= totalPages || loading}
                                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-extrabold text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 transition active:scale-95 shadow-2xs flex items-center gap-1 cursor-pointer"
                                >
                                    <span>Trang sau</span>
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: DAILY SUMMARY */}
            {activeTab === 'daily' && (
                <div className="space-y-4">
                    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xs">
                        <div className="p-4 border-b border-zinc-100 bg-zinc-50/40 flex items-center justify-between">
                            <div className="font-black text-xs uppercase tracking-wider text-zinc-800 flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-orange-500" />
                                <span>BẢNG KÊ DOANH THU BIẾN ĐỘNG THEO NGÀY</span>
                            </div>
                            <span className="text-xs text-zinc-500 font-medium">
                                Tổng cộng {dailySummaries.length} ngày phát sinh giao dịch
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                        <th className="px-4 py-3.5 font-extrabold">NGÀY</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">TỔNG TIỀN VÀO (+)</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">TỔNG TIỀN CHI (-)</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">CHÊNH LỆCH RÒNG</th>
                                        <th className="px-4 py-3.5 font-extrabold text-center">SỐ GIAO DỊCH</th>
                                        <th className="px-4 py-3.5 font-extrabold text-center">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {dailySummaries.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                Chưa có dữ liệu biến động số dư theo ngày.
                                            </td>
                                        </tr>
                                    ) : (
                                        dailySummaries.map((summary) => {
                                            const net = summary.totalCredit - summary.totalDebit;
                                            return (
                                                <tr key={summary.date} className="hover:bg-zinc-50/80 transition-colors">
                                                    <td className="px-4 py-3.5 font-bold font-mono text-zinc-900">
                                                        {summary.date}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-black text-emerald-600">
                                                        +{formatPrice(summary.totalCredit)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-black text-red-600">
                                                        -{formatPrice(summary.totalDebit)}
                                                    </td>
                                                    <td className={`px-4 py-3.5 text-right font-black ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {net < 0 ? '-' : ''}{formatPrice(Math.abs(net))}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center font-bold text-zinc-700">
                                                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs">
                                                            {summary.count}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <button
                                                            onClick={() => {
                                                                if (summary.date.includes('/')) {
                                                                    const [d, m, y] = summary.date.split('/');
                                                                    const dStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                                                                    setDateFrom(dStr);
                                                                    setDateTo(dStr);
                                                                }
                                                                setActiveTab('all');
                                                                setPage(1);
                                                            }}
                                                            className="rounded-xl border border-zinc-200 bg-white px-3 py-1 text-[11px] font-extrabold text-zinc-700 hover:bg-zinc-100 active:scale-95 transition shadow-2xs cursor-pointer"
                                                        >
                                                            Xem các GD
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: MONTHLY SUMMARY */}
            {activeTab === 'monthly' && (
                <div className="space-y-4">
                    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-2xs">
                        <div className="p-4 border-b border-zinc-100 bg-zinc-50/40 flex items-center justify-between">
                            <div className="font-black text-xs uppercase tracking-wider text-zinc-800 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-orange-500" />
                                <span>BẢNG KÊ DOANH THU BIẾN ĐỘNG THEO THÁNG</span>
                            </div>
                            <span className="text-xs text-zinc-500 font-medium">
                                Tổng cộng {monthlySummaries.length} tháng phát sinh giao dịch
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-100 bg-zinc-50/60 text-[11px] font-black uppercase tracking-wider text-zinc-500">
                                        <th className="px-4 py-3.5 font-extrabold">THÁNG</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">TỔNG TIỀN VÀO (+)</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">TỔNG TIỀN CHI (-)</th>
                                        <th className="px-4 py-3.5 font-extrabold text-right">CHÊNH LỆCH RÒNG</th>
                                        <th className="px-4 py-3.5 font-extrabold text-center">SỐ GIAO DỊCH</th>
                                        <th className="px-4 py-3.5 font-extrabold text-center">THAO TÁC</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {monthlySummaries.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-xs font-medium text-zinc-400">
                                                Chưa có dữ liệu biến động số dư theo tháng.
                                            </td>
                                        </tr>
                                    ) : (
                                        monthlySummaries.map((summary) => {
                                            const net = summary.totalCredit - summary.totalDebit;
                                            return (
                                                <tr key={summary.month} className="hover:bg-zinc-50/80 transition-colors">
                                                    <td className="px-4 py-3.5 font-bold font-mono text-zinc-900">
                                                        Tháng {summary.month}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-black text-emerald-600">
                                                        +{formatPrice(summary.totalCredit)}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right font-black text-red-600">
                                                        -{formatPrice(summary.totalDebit)}
                                                    </td>
                                                    <td className={`px-4 py-3.5 text-right font-black ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {net < 0 ? '-' : ''}{formatPrice(Math.abs(net))}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center font-bold text-zinc-700">
                                                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-xs">
                                                            {summary.count}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 text-center">
                                                        <button
                                                            onClick={() => {
                                                                if (summary.month.includes('-')) {
                                                                    const [y, m] = summary.month.split('-');
                                                                    const first = `${y}-${m}-01`;
                                                                    const last = new Date(Number(y), Number(m), 0).toISOString().split('T')[0];
                                                                    setDateFrom(first);
                                                                    setDateTo(last);
                                                                }
                                                                setActiveTab('all');
                                                                setPage(1);
                                                            }}
                                                            className="rounded-xl border border-zinc-200 bg-white px-3 py-1 text-[11px] font-extrabold text-zinc-700 hover:bg-zinc-100 active:scale-95 transition shadow-2xs cursor-pointer"
                                                        >
                                                            Xem các GD
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL MODAL (PORTAL) */}
            {selectedTx && mounted && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
                    <div className="w-full max-w-lg my-auto flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-zinc-200 animate-in zoom-in-95 duration-200">
                        <div className="h-1.5 w-full bg-orange-600 shrink-0" />

                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-100 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200">
                                    <Landmark className="h-4 w-4" />
                                </div>
                                <div>
                                    <h2 className="font-extrabold text-sm uppercase text-zinc-900 tracking-wide">
                                        CHI TIẾT GIAO DỊCH NGÂN HÀNG
                                    </h2>
                                    <p className="text-[11px] font-mono text-zinc-400">
                                        {BANK_INFO[selectedTx.bank || '']?.label || selectedTx.bank || 'Bank'} - {selectedTx.transDate}
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedTx(null)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 transition"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[calc(80vh-6rem)]">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-zinc-50 border border-zinc-200/80">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-zinc-400">SỐ TIỀN GIAO DỊCH</span>
                                    <div className={`text-xl font-black ${(selectedTx.paymentType || 'CREDIT') === 'CREDIT' ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {(selectedTx.paymentType || 'CREDIT') === 'CREDIT' ? '+' : '-'}{formatPrice(Number(selectedTx.amount))}
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-black uppercase border ${
                                    (selectedTx.paymentType || 'CREDIT') === 'CREDIT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                                }`}>
                                    {(selectedTx.paymentType || 'CREDIT') === 'CREDIT' ? '🟢 TIỀN VÀO (+)' : '🔴 TIỀN CHI (-)'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl border border-zinc-100 bg-white space-y-1">
                                    <span className="text-[10px] text-zinc-400 uppercase font-bold">Ngân hàng</span>
                                    <div className="font-extrabold text-zinc-900">
                                        {BANK_INFO[selectedTx.bank || '']?.label || selectedTx.bank || 'Khác'}
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl border border-zinc-100 bg-white space-y-1">
                                    <span className="text-[10px] text-zinc-400 uppercase font-bold">Số dư sau GD</span>
                                    <div className="font-extrabold text-zinc-900 font-mono">
                                        {selectedTx.balance ? formatPrice(Number(selectedTx.balance)) : 'Chưa cập nhật'}
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl border border-zinc-100 bg-white space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-400 uppercase font-bold">Mã giao dịch ngân hàng</span>
                                    <button
                                        onClick={() => copyToClipboard(selectedTx.bankTransId, 'modal_id')}
                                        className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                        {copiedKey === 'modal_id' ? 'Đã sao chép' : 'Sao chép'}
                                    </button>
                                </div>
                                <div className="font-mono font-bold text-zinc-800 select-all">
                                    {selectedTx.bankTransId || '-'}
                                </div>
                            </div>

                            <div className="p-3 rounded-xl border border-zinc-100 bg-white space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-zinc-400 uppercase font-bold">Nội dung chuyển khoản (Description)</span>
                                    <button
                                        onClick={() => copyToClipboard(selectedTx.msgContent || selectedTx.description, 'modal_desc')}
                                        className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1"
                                    >
                                        {copiedKey === 'modal_desc' ? 'Đã sao chép' : 'Sao chép'}
                                    </button>
                                </div>
                                <div className="font-mono text-zinc-800 select-all bg-zinc-50 p-2.5 rounded-lg border border-zinc-200/60 break-words">
                                    {selectedTx.msgContent || selectedTx.description || 'Không có nội dung'}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end p-4 border-t border-zinc-100 bg-zinc-50/50 shrink-0">
                            <button
                                onClick={() => setSelectedTx(null)}
                                className="rounded-xl border border-zinc-200 bg-white px-5 py-2 text-xs font-extrabold uppercase text-zinc-700 hover:bg-zinc-100 transition active:scale-95 shadow-2xs cursor-pointer"
                            >
                                ĐÓNG
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
