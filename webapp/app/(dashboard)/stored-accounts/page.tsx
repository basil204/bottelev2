'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Dialog } from '@/components/ui/dialog';
import { RefreshCw, Plus, Trash2, Package, Copy, Check, Edit2, Save, X, User, ChevronLeft, ChevronRight, KeyRound, Loader2, Settings2, FolderOpen, Search, Sparkles, Filter, ShieldAlert, CheckCircle2, ArrowRightLeft, Download, Eye, ExternalLink } from 'lucide-react';

interface AccountType {
    id: number;
    name: string;
    account_count: number;
    in_stock_count?: number;
    sold_count?: number;
}

interface StoredAccount {
    id: number;
    account_type_id: number;
    type_name: string;
    data: string;
    code: string | null;
    payment_status: 'pending' | 'paid' | 'invalid' | 'package_error' | 'wrong_info';
    sale_status: 'in_stock' | 'sold';
    bot_status: 'not_uploaded' | 'uploaded';
    paid_at: string | null;
    sold_at: string | null;
    sold_to_user_id: number | null;
    buyer_username: string | null;
    note: string | null;
    created_at: string;
}

function formatDate(dateString: string): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function parseAccountData(data: string): { tk: string; mk: string; extra: string; twofa: string } {
    if (!data) return { tk: '', mk: '', extra: '', twofa: '' };
    let parts: string[] = [];

    if (data.includes('\t')) {
        parts = data.split('\t');
    } else if (data.includes('|')) {
        parts = data.split('|');
    } else if (data.includes(':')) {
        parts = data.split(':');
    } else {
        parts = [data];
    }

    if (parts.length === 1) {
        return { tk: parts[0], mk: '', extra: '', twofa: '' };
    } else if (parts.length === 2) {
        return { tk: parts[0], mk: parts[1], extra: '', twofa: '' };
    } else if (parts.length === 3) {
        return { tk: parts[0], mk: parts[1], extra: '', twofa: parts[2] };
    } else if (parts.length >= 4) {
        return { tk: parts[0], mk: parts[1], extra: parts[2], twofa: parts[3] };
    }

    return { tk: parts[0] || '', mk: parts[1] || '', extra: parts[2] || '', twofa: parts[3] || '' };
}

export default function StoredAccountsPage() {
    const [accounts, setAccounts] = useState<StoredAccount[]>([]);
    const [types, setTypes] = useState<AccountType[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);

    // Single Edit Modal State
    const [editingAccount, setEditingAccount] = useState<StoredAccount | null>(null);
    const [editDataStr, setEditDataStr] = useState<string>('');
    const [editTypeId, setEditTypeId] = useState<number>(0);
    const [editCode, setEditCode] = useState<string>('');
    const [editNote, setEditNote] = useState<string>('');
    const [editSaleStatus, setEditSaleStatus] = useState<string>('in_stock');
    const [editPaymentStatus, setEditPaymentStatus] = useState<string>('pending');
    const [editBotStatus, setEditBotStatus] = useState<string>('not_uploaded');

    // 2FA token state
    const [twoFaTokens, setTwoFaTokens] = useState<Record<string, string>>({});
    const [loadingTwoFa, setLoadingTwoFa] = useState<Record<string, boolean>>({});

    // Form state for creating accounts
    const [selectedType, setSelectedType] = useState<string>('');
    const [accountData, setAccountData] = useState('');
    const [note, setNote] = useState('');
    const [code, setCode] = useState('');

    // Filter & Search state
    const [filterType, setFilterType] = useState<string>('all');
    const [filterPayment, setFilterPayment] = useState<string>('all');
    const [filterSale, setFilterSale] = useState<string>('all');
    const [filterBot, setFilterBot] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Add/Manage type dialog
    const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [addingType, setAddingType] = useState(false);
    const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
    const [editingTypeName, setEditingTypeName] = useState('');
    const [reassignSourceId, setReassignSourceId] = useState<number | null>(null);
    const [reassignTargetId, setReassignTargetId] = useState<number | null>(null);
    const [typeError, setTypeError] = useState('');
    const [copiedAll, setCopiedAll] = useState(false);

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkTargetTypeId, setBulkTargetTypeId] = useState<string>('');

    // Tab state
    const [activeTab, setActiveTab] = useState<'all' | 'sold'>('all');
    const [soldPage, setSoldPage] = useState(1);
    const soldPageSize = 10;

    // Main list pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const paginatedData = useMemo(() => {
        const total = accounts.length;
        const totalPages = Math.ceil(total / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        const paginated = accounts.slice(startIndex, startIndex + pageSize);
        return { total, totalPages, paginated, startIndex };
    }, [accounts, currentPage, pageSize]);

    const soldAccountsData = useMemo(() => {
        const soldAccounts = accounts.filter(a => a.sale_status === 'sold');
        const totalSold = soldAccounts.length;
        const totalPages = Math.ceil(totalSold / soldPageSize);
        const startIndex = (soldPage - 1) * soldPageSize;
        const paginatedSold = soldAccounts.slice(startIndex, startIndex + soldPageSize);
        return { soldAccounts, totalSold, totalPages, paginatedSold };
    }, [accounts, soldPage, soldPageSize]);

    const fetchTypes = async () => {
        try {
            const res = await fetch('/api/account-types');
            const data = await res.json();
            if (data.success) {
                setTypes(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching account types:', error);
        }
    };

    const fetchAccounts = useCallback(async () => {
        try {
            setLoading(true);
            const url = '/api/stored-accounts?';
            const params = new URLSearchParams();

            if (filterType !== 'all') params.append('type', filterType);
            if (filterPayment !== 'all') params.append('payment_status', filterPayment);
            if (filterSale !== 'all') params.append('sale_status', filterSale);
            if (filterBot !== 'all') params.append('bot_status', filterBot);
            if (searchQuery.trim()) params.append('search', searchQuery.trim());

            const res = await fetch(url + params.toString());
            const data = await res.json();
            if (data.success) {
                const nextAccounts: StoredAccount[] = data.data || [];
                setAccounts(nextAccounts);
                const availableIds = new Set(nextAccounts.map(account => account.id));
                setSelectedIds(previous => new Set([...previous].filter(id => availableIds.has(id))));
            }
        } catch (error) {
            console.error('Error fetching stored accounts:', error);
        } finally {
            setLoading(false);
        }
    }, [filterType, filterPayment, filterSale, filterBot, searchQuery]);

    useEffect(() => {
        fetchTypes();
    }, []);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    const handleSeedPresets = async () => {
        try {
            setAddingType(true);
            const res = await fetch('/api/account-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ seed: true })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Đã khởi tạo các loại tài khoản mẫu!');
                await fetchTypes();
            } else {
                alert(data.error || 'Lỗi khởi tạo loại tài khoản');
            }
        } catch (err) {
            alert('Lỗi kết nối khi khởi tạo loại tài khoản mẫu.');
        } finally {
            setAddingType(false);
        }
    };

    const handleAddType = async () => {
        if (!newTypeName.trim()) return;

        try {
            setAddingType(true);
            setTypeError('');
            const res = await fetch('/api/account-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTypeName.trim() })
            });
            const data = await res.json();
            if (data.success) {
                await fetchTypes();
                setNewTypeName('');
            } else {
                setTypeError(data.error);
            }
        } catch (error) {
            console.error('Error adding type:', error);
            setTypeError('Không thể thêm loại tài khoản. Vui lòng thử lại.');
        } finally {
            setAddingType(false);
        }
    };

    const handleRenameType = async (id: number) => {
        if (!editingTypeName.trim()) return;
        try {
            setTypeError('');
            const res = await fetch('/api/account-types', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, name: editingTypeName.trim() })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            await fetchTypes();
            await fetchAccounts();
            setEditingTypeId(null);
            setEditingTypeName('');
        } catch (error: any) {
            setTypeError(error.message || 'Không thể đổi tên loại tài khoản.');
        }
    };

    const handleReassignTypeAccounts = async (sourceId: number, targetId: number) => {
        if (sourceId === targetId) {
            alert('Loại nguồn và loại đích phải khác nhau!');
            return;
        }
        if (!confirm('Bạn có chắc muốn CHUYỂN TOÀN BỘ tài khoản từ loại này sang loại mới chọn?')) return;

        try {
            const res = await fetch('/api/account-types', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reassign', id: sourceId, target_type_id: targetId })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message || 'Đã chuyển tài khoản thành công!');
                setReassignSourceId(null);
                setReassignTargetId(null);
                await fetchTypes();
                await fetchAccounts();
            } else {
                alert(data.error || 'Lỗi chuyển loại tài khoản');
            }
        } catch (err) {
            alert('Lỗi kết nối khi chuyển loại tài khoản');
        }
    };

    const handleDeleteType = async (type: AccountType) => {
        if (Number(type.account_count) > 0) {
            setTypeError(`“${type.name}” đang chứa ${type.account_count} tài khoản. Hãy chuyển các tài khoản sang loại khác trước khi xóa!`);
            return;
        }
        if (!window.confirm(`Xóa loại “${type.name}”? Thao tác này không thể hoàn tác.`)) return;

        try {
            setTypeError('');
            const res = await fetch('/api/account-types', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: type.id, reason: 'Xóa từ màn quản lý loại tài khoản' })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            if (selectedType === type.id.toString()) setSelectedType('');
            if (filterType === type.id.toString()) setFilterType('all');
            await fetchTypes();
        } catch (error: any) {
            setTypeError(error.message || 'Không thể xóa loại tài khoản.');
        }
    };

    const handleAdd = async () => {
        if (!selectedType) {
            alert('Vui lòng chọn loại tài khoản (ChatGPT, CapCut, Mail EDU...)');
            return;
        }
        if (!accountData.trim()) {
            alert('Vui lòng nhập thông tin tài khoản');
            return;
        }

        try {
            setSaving(true);
            const res = await fetch('/api/stored-accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_type_id: selectedType,
                    data: accountData,
                    note: note || null,
                    code: code || null
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setAccountData('');
                setNote('');
                setCode('');
                fetchAccounts();
                fetchTypes();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error adding account:', error);
        } finally {
            setSaving(false);
        }
    };

    const openEditModal = (account: StoredAccount) => {
        setEditingAccount(account);
        setEditDataStr(account.data || '');
        setEditTypeId(account.account_type_id);
        setEditCode(account.code || '');
        setEditNote(account.note || '');
        setEditSaleStatus(account.sale_status);
        setEditPaymentStatus(account.payment_status);
        setEditBotStatus(account.bot_status || 'not_uploaded');
    };

    const handleSaveSingleAccountModal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAccount) return;

        try {
            setSaving(true);
            const res = await fetch('/api/stored-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingAccount.id,
                    data: editDataStr,
                    account_type_id: editTypeId,
                    code: editCode || null,
                    note: editNote || null,
                    sale_status: editSaleStatus,
                    payment_status: editPaymentStatus,
                    bot_status: editBotStatus
                })
            });
            const data = await res.json();
            if (data.success) {
                alert('Đã cập nhật chi tiết tài khoản thành công!');
                setEditingAccount(null);
                fetchAccounts();
                fetchTypes();
            } else {
                alert(data.error || 'Lỗi cập nhật tài khoản');
            }
        } catch (err) {
            alert('Lỗi mạng khi cập nhật tài khoản');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateStatus = async (id: number, field: 'payment_status' | 'sale_status' | 'bot_status', value: string) => {
        try {
            const res = await fetch('/api/stored-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, [field]: value })
            });
            const data = await res.json();
            if (data.success) {
                fetchAccounts();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleDelete = async (id: number) => {
        const reason = window.prompt('Nhập lý do xóa tài khoản này (bắt buộc):');
        if (reason === null) return;
        if (!reason.trim()) {
            alert('Lý do xóa là bắt buộc!');
            return;
        }

        try {
            const res = await fetch('/api/stored-accounts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, reason })
            });
            const data = await res.json();
            if (data.success) {
                fetchAccounts();
                fetchTypes();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error deleting account:', error);
        }
    };

    const handleBulkUpdateStatus = async (field: 'sale_status' | 'bot_status', value: string) => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        try {
            const res = await fetch('/api/stored-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, [field]: value })
            });
            const data = await res.json();
            if (data.success) {
                setSelectedIds(new Set());
                fetchAccounts();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error bulk updating:', error);
        }
    };

    const handleBulkChangeType = async () => {
        if (selectedIds.size === 0 || !bulkTargetTypeId) return;
        const ids = Array.from(selectedIds);
        try {
            const res = await fetch('/api/stored-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, account_type_id: Number(bulkTargetTypeId) })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Đã chuyển ${ids.length} tài khoản đã chọn sang loại mới!`);
                setSelectedIds(new Set());
                setBulkTargetTypeId('');
                fetchAccounts();
                fetchTypes();
            } else {
                alert(data.error || 'Lỗi chuyển loại tài khoản');
            }
        } catch (err) {
            alert('Lỗi kết nối khi chuyển loại tài khoản');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        const reason = window.prompt(`Nhập lý do xóa ${selectedIds.size} tài khoản đã chọn (bắt buộc):`);
        if (reason === null) return;
        if (!reason.trim()) {
            alert('Lý do xóa là bắt buộc!');
            return;
        }
        const ids = Array.from(selectedIds);
        try {
            for (const id of ids) {
                await fetch('/api/stored-accounts', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, reason })
                });
            }
            setSelectedIds(new Set());
            fetchAccounts();
            fetchTypes();
        } catch (error) {
            console.error('Error bulk deleting:', error);
        }
    };

    const toggleSelectAll = () => {
        const pageIds = paginatedData.paginated.map(a => a.id);
        if (pageIds.every(id => selectedIds.has(id))) {
            setSelectedIds(prev => {
                const next = new Set(prev);
                pageIds.forEach(id => next.delete(id));
                return next;
            });
        } else {
            setSelectedIds(prev => {
                const next = new Set(prev);
                pageIds.forEach(id => next.add(id));
                return next;
            });
        }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const copyText = (text: string, fieldId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleDownloadTxt = () => {
        const targetAccs = selectedIds.size > 0 ? accounts.filter(a => selectedIds.has(a.id)) : accounts;
        const textContent = targetAccs.map(a => a.data).join('\n');
        if (!textContent) {
            alert('Chưa có dữ liệu để tải về.');
            return;
        }
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stored_accounts_${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Stats
    const stats = {
        total: accounts.length,
        pending: accounts.filter(a => a.payment_status === 'pending').length,
        paid: accounts.filter(a => a.payment_status === 'paid').length,
        inStock: accounts.filter(a => a.sale_status === 'in_stock').length,
        sold: accounts.filter(a => a.sale_status === 'sold').length,
        notUploaded: accounts.filter(a => a.bot_status === 'not_uploaded' || !a.bot_status).length,
        uploaded: accounts.filter(a => a.bot_status === 'uploaded').length,
    };

    const selectedAccounts = accounts.filter(account => selectedIds.has(account.id));
    const copyTargetCount = selectedAccounts.length > 0 ? selectedAccounts.length : accounts.length;

    const copySelectedOrFiltered = () => {
        const copySource = selectedAccounts.length > 0 ? selectedAccounts : accounts;
        const allData = copySource.map(account => account.data).join('\n');
        navigator.clipboard.writeText(allData);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    return (
        <div className="space-y-6 text-xs">
            {/* Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/30 border border-indigo-400/30 backdrop-blur-md text-indigo-400 shadow-inner">
                        <Package className="h-7 w-7 text-indigo-300" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2">
                            KHO QUẢN LÝ TÀI KHOẢN CHI TIẾT
                        </h1>
                        <p className="text-xs text-indigo-200/80 font-medium mt-0.5">
                            Quản lý tài khoản ChatGPT, CapCut, Gmail EDU, Canva, Netflix... Tình trạng Đã bán / Chưa bán, Mã Code, Ghi chú & Lên Bot
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={fetchAccounts} variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Account Type Chips Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <span className="font-extrabold text-zinc-500 uppercase text-[10px] shrink-0">LỌC NHANH DỊCH VỤ:</span>
                <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1.5 rounded-full font-bold text-xs transition cursor-pointer shrink-0 ${
                        filterType === 'all'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                >
                    Tất cả loại ({types.reduce((acc, t) => acc + Number(t.account_count || 0), 0)})
                </button>
                {types.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setFilterType(t.id.toString())}
                        className={`px-3 py-1.5 rounded-full font-bold text-xs transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                            filterType === t.id.toString()
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200/60'
                        }`}
                    >
                        <span>{t.name}</span>
                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold">{t.in_stock_count || 0} còn</span>
                    </button>
                ))}

                <button
                    onClick={() => {
                        setTypeError('');
                        setShowAddTypeDialog(true);
                    }}
                    className="px-3 py-1.5 rounded-full font-bold text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer shrink-0 flex items-center gap-1"
                >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Quản lý CRUD loại TK</span>
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-zinc-200 bg-white p-2 rounded-2xl border">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-5 py-3 rounded-xl font-extrabold text-xs uppercase transition cursor-pointer flex items-center gap-2 ${
                        activeTab === 'all'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                            : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                >
                    <Package className="w-4 h-4" />
                    <span>TẤT CẢ TÀI KHOẢN TRONG KHO ({stats.total})</span>
                </button>
                <button
                    onClick={() => setActiveTab('sold')}
                    className={`px-5 py-3 rounded-xl font-extrabold text-xs uppercase transition cursor-pointer flex items-center gap-2 ${
                        activeTab === 'sold'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                            : 'text-zinc-600 hover:bg-zinc-100'
                    }`}
                >
                    <User className="w-4 h-4" />
                    <span>TÀI KHOẢN ĐÃ BÁN KHÁCH MUA ({stats.sold})</span>
                </button>
            </div>

            {activeTab === 'all' && (
                <>
                    {/* Summary Stats Grid */}
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 md:grid-cols-7">
                        <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                            <CardContent className="pt-4 p-4">
                                <span className="text-[10px] font-black uppercase text-zinc-400 block">TỔNG TRONG KHO</span>
                                <div className="text-xl font-black text-zinc-900 mt-1">{stats.total}</div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                            <CardContent className="pt-4 p-4">
                                <span className="text-[10px] font-black uppercase text-emerald-600 block">CÒN HÀNG (SẴN SÀNG)</span>
                                <div className="text-xl font-black text-emerald-600 mt-1">{stats.inStock}</div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                            <CardContent className="pt-4 p-4">
                                <span className="text-[10px] font-black uppercase text-blue-600 block">ĐÃ BÁN BÁN</span>
                                <div className="text-xl font-black text-blue-600 mt-1">{stats.sold}</div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                            <CardContent className="pt-4 p-4">
                                <span className="text-[10px] font-black uppercase text-amber-600 block">CHƯA THANH TOÁN</span>
                                <div className="text-xl font-black text-amber-600 mt-1">{stats.pending}</div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                            <CardContent className="pt-4 p-4">
                                <span className="text-[10px] font-black uppercase text-green-600 block">ĐÃ PAY THÀNH CÔNG</span>
                                <div className="text-xl font-black text-green-600 mt-1">{stats.paid}</div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                            <CardContent className="pt-4 p-4">
                                <span className="text-[10px] font-black uppercase text-orange-600 block">CHƯA LÊN BOT</span>
                                <div className="text-xl font-black text-orange-600 mt-1">{stats.notUploaded}</div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                            <CardContent className="pt-4 p-4">
                                <span className="text-[10px] font-black uppercase text-teal-600 block">ĐÃ LÊN BOT</span>
                                <div className="text-xl font-black text-teal-600 mt-1">{stats.uploaded}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Add new account Form */}
                    <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                        <CardHeader className="pb-3 border-b border-zinc-100">
                            <CardTitle className="text-xs uppercase font-black text-zinc-800 tracking-wider flex items-center gap-2">
                                <Plus className="h-4 w-4 text-indigo-600" />
                                <span>THÊM TÀI KHOẢN MỚI VÀO KHO (NHẬP ĐƠN HOẶC HÀNG LOẠT TXT)</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <div>
                                    <label className="text-[11px] font-extrabold uppercase text-zinc-700 mb-1.5 block">1. LOẠI TÀI KHOẢN *</label>
                                    <div className="flex gap-2">
                                        <Select value={selectedType} onValueChange={setSelectedType}>
                                            <SelectTrigger className="flex-1 rounded-xl border-zinc-200 font-bold">
                                                <SelectValue placeholder="Chọn loại tài khoản (ChatGPT, CapCut...)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {types.map(type => (
                                                    <SelectItem key={type.id} value={type.id.toString()}>
                                                        {type.name} ({type.account_count || 0})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setTypeError('');
                                                setShowAddTypeDialog(true);
                                            }}
                                            className="rounded-xl border-zinc-200 h-10 px-3 cursor-pointer"
                                        >
                                            <Settings2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-extrabold uppercase text-zinc-700 mb-1.5 block">2. MÃ CODE / GÓI (TÙY CHỌN)</label>
                                    <Input
                                        placeholder="VD: CC_PRO_1M, GPT_TEAM..."
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                        className="rounded-xl border-zinc-200 font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-extrabold uppercase text-zinc-700 mb-1.5 block">3. GHI CHÚ NỘI BỘ (TÙY CHỌN)</label>
                                    <Input
                                        placeholder="Ghi chú nguồn hàng, ngày tạo, VIP Pro..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="rounded-xl border-zinc-200 text-xs"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[11px] font-extrabold uppercase text-zinc-700 mb-1 block">
                                    4. THÔNG TIN TÀI KHOẢN (MỖI DÒNG 1 TÀI KHOẢN / CÚ PHÁP PHÂN CÁCH | HOẶC TAB OR COLON) *
                                </label>
                                <p className="text-[11px] text-zinc-500 mb-2 font-mono">
                                    Cú pháp hỗ trợ: email|password | email|password|2fa | email|password|mail_kp|2fa | key_license
                                </p>
                                <Textarea
                                    placeholder="kendrick2026@hotmail.com|Password123|2FA_SECRET&#10;user2@gmail.com|Pass456|mailkp@gmail.com|2FA_KEY"
                                    value={accountData}
                                    onChange={(e) => setAccountData(e.target.value)}
                                    rows={4}
                                    className="rounded-xl border-zinc-200 font-mono text-xs"
                                />
                            </div>

                            <Button onClick={handleAdd} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs uppercase rounded-xl px-6 py-2.5 shadow-md transition active:scale-95 cursor-pointer">
                                <Plus className="w-4 h-4 mr-2" />
                                {saving ? 'Đang thêm tài khoản...' : 'THÊM TÀI KHOẢN VÀO KHO'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Filters & Search Section */}
                    <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                        <CardHeader className="pb-3 border-b border-zinc-100">
                            <CardTitle className="text-xs uppercase font-black text-zinc-800 tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-indigo-600" />
                                    <span>BỘ LỌC TÌM KIẾM NÂNG CAO</span>
                                </span>

                                <div className="relative min-w-[300px]">
                                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
                                    <Input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Tìm Email, Password, Note, Code, User mua..."
                                        className="pl-9 rounded-xl border-zinc-200 text-xs font-medium"
                                    />
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="flex flex-wrap gap-4 items-end">
                                <div className="w-44 space-y-1">
                                    <label className="text-[10px] font-black uppercase text-zinc-500">LOẠI TÀI KHOẢN</label>
                                    <Select value={filterType} onValueChange={setFilterType}>
                                        <SelectTrigger className="rounded-xl border-zinc-200 text-xs font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả loại ({types.reduce((acc, t) => acc + Number(t.account_count || 0), 0)})</SelectItem>
                                            {types.map(type => (
                                                <SelectItem key={type.id} value={type.id.toString()}>
                                                    {type.name} ({type.account_count || 0})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="w-40 space-y-1">
                                    <label className="text-[10px] font-black uppercase text-zinc-500">TRẠNG THÁI BÁN</label>
                                    <Select value={filterSale} onValueChange={setFilterSale}>
                                        <SelectTrigger className="rounded-xl border-zinc-200 text-xs font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả trạng thái</SelectItem>
                                            <SelectItem value="in_stock">🟢 Còn hàng (Chưa bán)</SelectItem>
                                            <SelectItem value="sold">🔵 Đã bán (Khách mua)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="w-40 space-y-1">
                                    <label className="text-[10px] font-black uppercase text-zinc-500">TÌNH TRẠNG PAY</label>
                                    <Select value={filterPayment} onValueChange={setFilterPayment}>
                                        <SelectTrigger className="rounded-xl border-zinc-200 text-xs font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả tình trạng</SelectItem>
                                            <SelectItem value="pending">🟡 Chưa pay</SelectItem>
                                            <SelectItem value="paid">🟢 Đã pay</SelectItem>
                                            <SelectItem value="invalid">🔴 Sai TT / Lỗi</SelectItem>
                                            <SelectItem value="package_error">⚠️ Lỗi gói</SelectItem>
                                            <SelectItem value="wrong_info">❌ Sai thông tin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="w-36 space-y-1">
                                    <label className="text-[10px] font-black uppercase text-zinc-500">LÊN BOT</label>
                                    <Select value={filterBot} onValueChange={setFilterBot}>
                                        <SelectTrigger className="rounded-xl border-zinc-200 text-xs font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả</SelectItem>
                                            <SelectItem value="not_uploaded">Chưa lên Bot</SelectItem>
                                            <SelectItem value="uploaded">Đã lên Bot</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={copySelectedOrFiltered}
                                        disabled={accounts.length === 0}
                                        className={`rounded-xl border-zinc-200 font-bold text-xs cursor-pointer ${copiedAll ? 'border-green-500 text-green-600 bg-green-50' : ''}`}
                                    >
                                        {copiedAll ? (
                                            <><Check className="w-4 h-4 mr-1 text-green-600" /> Đã copy {copyTargetCount} TK</>
                                        ) : selectedAccounts.length > 0 ? (
                                            <><Copy className="w-4 h-4 mr-1" /> Copy đã chọn ({selectedAccounts.length})</>
                                        ) : (
                                            <><Copy className="w-4 h-4 mr-1" /> Copy tất cả ({accounts.length})</>
                                        )}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={handleDownloadTxt}
                                        disabled={accounts.length === 0}
                                        className="rounded-xl border-zinc-200 font-bold text-xs cursor-pointer"
                                    >
                                        <Download className="w-4 h-4 mr-1" /> Tải File TXT
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Accounts Table */}
                    <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                        <CardHeader className="pb-3 border-b border-zinc-100">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-xs uppercase font-black text-zinc-800 tracking-wider">
                                    DANH SÁCH TÀI KHOẢN ({accounts.length} TÀI KHOẢN)
                                </CardTitle>
                                {selectedIds.size > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs text-zinc-600 font-bold bg-zinc-100 px-2.5 py-1 rounded-lg">
                                            Đã chọn {selectedIds.size}
                                        </span>

                                        {/* Bulk Reassign Account Type */}
                                        <div className="flex items-center gap-1">
                                            <Select value={bulkTargetTypeId} onValueChange={setBulkTargetTypeId}>
                                                <SelectTrigger className="w-[140px] h-7 text-xs font-bold rounded-lg bg-white border-indigo-200">
                                                    <SelectValue placeholder="Chuyển sang..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {types.map(t => (
                                                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                size="sm"
                                                disabled={!bulkTargetTypeId}
                                                onClick={handleBulkChangeType}
                                                className="h-7 text-xs rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                                            >
                                                <ArrowRightLeft className="w-3 h-3 mr-1" /> Chuyển
                                            </Button>
                                        </div>

                                        <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={() => handleBulkUpdateStatus('sale_status', 'sold')}>
                                            Đánh dấu Đã bán
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100" onClick={() => handleBulkUpdateStatus('sale_status', 'in_stock')}>
                                            Đánh dấu Còn hàng
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100" onClick={() => handleBulkUpdateStatus('bot_status', 'uploaded')}>
                                            Đã lên Bot
                                        </Button>
                                        <Button size="sm" variant="destructive" className="h-7 text-xs rounded-lg" onClick={handleBulkDelete}>
                                            <Trash2 className="w-3 h-3 mr-1" /> Xóa ({selectedIds.size})
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg" onClick={() => setSelectedIds(new Set())}>
                                            <X className="w-3 h-3 mr-1" /> Bỏ chọn
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="pt-3">
                            {loading ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                                    <p className="mt-2 text-zinc-500 font-bold text-xs">Đang tải danh sách tài khoản...</p>
                                </div>
                            ) : accounts.length === 0 ? (
                                <div className="text-center py-12 text-zinc-400 font-medium">
                                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-bold text-sm">Chưa có tài khoản nào trong kho với bộ lọc hiện tại.</p>
                                    <p className="text-xs mt-1">Hãy thêm tài khoản ở form phía trên hoặc xóa bớt từ khóa lọc!</p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <Table className="w-full text-left border-collapse">
                                            <TableHeader>
                                                <TableRow className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-black text-zinc-600">
                                                    <TableHead className="w-8 p-3">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-gray-400 cursor-pointer"
                                                            checked={paginatedData.paginated.length > 0 && paginatedData.paginated.every(a => selectedIds.has(a.id))}
                                                            onChange={toggleSelectAll}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="p-3">LOẠI TÀI KHOẢN</TableHead>
                                                    <TableHead className="p-3">CODE</TableHead>
                                                    <TableHead className="p-3">TÀI KHOẢN (TK)</TableHead>
                                                    <TableHead className="p-3">MẬT KHẨU (MK)</TableHead>
                                                    <TableHead className="p-3">MAIL KP / EXTRA</TableHead>
                                                    <TableHead className="p-3">2FA / OTP TOKEN</TableHead>
                                                    <TableHead className="p-3">TRẠNG THÁI BÁN</TableHead>
                                                    <TableHead className="p-3">TÌNH TRẠNG PAY</TableHead>
                                                    <TableHead className="p-3">NGƯỜI MUA</TableHead>
                                                    <TableHead className="p-3">NOTE GHI CHÚ</TableHead>
                                                    <TableHead className="p-3 text-center">THAO TÁC CRUD</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody className="divide-y divide-zinc-100">
                                                {paginatedData.paginated.map((account) => {
                                                    const parsed = parseAccountData(account.data);
                                                    return (
                                                        <TableRow key={account.id} className={`hover:bg-zinc-50 font-medium ${selectedIds.has(account.id) ? 'bg-indigo-50/50' : ''}`}>
                                                            <TableCell className="p-3">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-gray-400 cursor-pointer"
                                                                    checked={selectedIds.has(account.id)}
                                                                    onChange={() => toggleSelect(account.id)}
                                                                />
                                                            </TableCell>
                                                            <TableCell className="p-3">
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 uppercase">
                                                                    {account.type_name}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="p-3 font-mono text-zinc-500 font-bold text-[11px]">
                                                                {account.code || '-'}
                                                            </TableCell>
                                                            <TableCell className="p-3">
                                                                <code
                                                                    className="text-[11px] bg-zinc-100 px-2 py-1 rounded-lg cursor-pointer hover:bg-zinc-200 block font-mono text-zinc-900 font-bold"
                                                                    title={parsed.tk ? `Click để copy: ${parsed.tk}` : ''}
                                                                    onClick={() => parsed.tk && copyText(parsed.tk, `tk-${account.id}`)}
                                                                >
                                                                    {copiedField === `tk-${account.id}` ? '✓ Copied' : (parsed.tk || '-')}
                                                                </code>
                                                            </TableCell>
                                                            <TableCell className="p-3">
                                                                <code
                                                                    className="text-[11px] bg-zinc-100 px-2 py-1 rounded-lg cursor-pointer hover:bg-zinc-200 block font-mono text-indigo-600 font-bold"
                                                                    title={parsed.mk ? `Click để copy: ${parsed.mk}` : ''}
                                                                    onClick={() => parsed.mk && copyText(parsed.mk, `mk-${account.id}`)}
                                                                >
                                                                    {copiedField === `mk-${account.id}` ? '✓ Copied' : (parsed.mk || '-')}
                                                                </code>
                                                            </TableCell>
                                                            <TableCell className="p-3">
                                                                <code
                                                                    className="text-[11px] bg-zinc-100 px-2 py-1 rounded-lg cursor-pointer hover:bg-zinc-200 block font-mono text-zinc-600"
                                                                    title={parsed.extra ? `Click để copy: ${parsed.extra}` : ''}
                                                                    onClick={() => parsed.extra && copyText(parsed.extra, `extra-${account.id}`)}
                                                                >
                                                                    {copiedField === `extra-${account.id}` ? '✓ Copied' : (parsed.extra || '-')}
                                                                </code>
                                                            </TableCell>
                                                            <TableCell className="p-3">
                                                                <div className="flex items-center gap-1">
                                                                    <code
                                                                        className="text-[11px] bg-zinc-100 px-2 py-1 rounded-lg cursor-pointer hover:bg-zinc-200 block font-mono text-amber-600 font-bold"
                                                                        title={parsed.twofa ? `Click để copy: ${parsed.twofa}` : ''}
                                                                        onClick={() => parsed.twofa && copyText(parsed.twofa, `2fa-${account.id}`)}
                                                                    >
                                                                        {copiedField === `2fa-${account.id}` ? '✓ Copied' : (parsed.twofa || '-')}
                                                                    </code>
                                                                    {parsed.twofa && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0 cursor-pointer"
                                                                            title="Lấy mã OTP 2FA"
                                                                            disabled={loadingTwoFa[account.id]}
                                                                            onClick={async () => {
                                                                                const secret = parsed.twofa!.replace(/\s/g, '');
                                                                                setLoadingTwoFa(prev => ({ ...prev, [account.id]: true }));
                                                                                try {
                                                                                    const res = await fetch(`/api/2fa-token?secret=${secret}`);
                                                                                    const data = await res.json();
                                                                                    if (data.token) {
                                                                                        setTwoFaTokens(prev => ({ ...prev, [account.id]: data.token }));
                                                                                        navigator.clipboard.writeText(data.token);
                                                                                        setCopiedField(`2fa-token-${account.id}`);
                                                                                        setTimeout(() => {
                                                                                            setCopiedField(prev => prev === `2fa-token-${account.id}` ? null : prev);
                                                                                        }, 3000);
                                                                                    }
                                                                                } catch (e) {
                                                                                    console.error('2FA error:', e);
                                                                                } finally {
                                                                                    setLoadingTwoFa(prev => ({ ...prev, [account.id]: false }));
                                                                                }
                                                                            }}
                                                                        >
                                                                            {loadingTwoFa[account.id] ? (
                                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                            ) : (
                                                                                <KeyRound className="w-4 h-4 text-orange-500" />
                                                                            )}
                                                                        </Button>
                                                                    )}
                                                                    {twoFaTokens[account.id] && (
                                                                        <span
                                                                            className="text-[11px] font-mono font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded cursor-pointer"
                                                                            title="Click để copy mã OTP 2FA"
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(twoFaTokens[account.id]);
                                                                                setCopiedField(`2fa-token-${account.id}`);
                                                                            }}
                                                                        >
                                                                            {copiedField === `2fa-token-${account.id}` ? '✓ Copied' : twoFaTokens[account.id]}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </TableCell>

                                                            {/* Sale Status Select */}
                                                            <TableCell className="p-3">
                                                                <Select
                                                                    value={account.sale_status}
                                                                    onValueChange={(val: string) => handleUpdateStatus(account.id, 'sale_status', val)}
                                                                >
                                                                    <SelectTrigger className={`w-[90px] h-7 text-[11px] font-bold rounded-lg ${
                                                                        account.sale_status === 'sold'
                                                                            ? 'bg-blue-50 border-blue-300 text-blue-700'
                                                                            : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                                                    }`}>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="in_stock">🟢 Còn hàng</SelectItem>
                                                                        <SelectItem value="sold">🔵 Đã bán</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>

                                                            {/* Payment Status Select */}
                                                            <TableCell className="p-3">
                                                                <Select
                                                                    value={account.payment_status}
                                                                    onValueChange={(val: string) => handleUpdateStatus(account.id, 'payment_status', val)}
                                                                >
                                                                    <SelectTrigger className={`w-[90px] h-7 text-[11px] font-bold rounded-lg ${
                                                                        account.payment_status === 'paid' ? 'bg-green-50 border-green-300 text-green-700' :
                                                                        account.payment_status === 'invalid' ? 'bg-red-50 border-red-300 text-red-700' :
                                                                        'bg-amber-50 border-amber-300 text-amber-700'
                                                                    }`}>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="pending">🟡 Chưa pay</SelectItem>
                                                                        <SelectItem value="paid">🟢 Đã pay</SelectItem>
                                                                        <SelectItem value="invalid">🔴 Sai TT</SelectItem>
                                                                        <SelectItem value="package_error">⚠️ Lỗi gói</SelectItem>
                                                                        <SelectItem value="wrong_info">❌ Sai TT</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>

                                                            <TableCell className="p-3">
                                                                <span className="text-xs font-bold text-zinc-700">
                                                                    {account.buyer_username ? `@${account.buyer_username}` : '-'}
                                                                </span>
                                                            </TableCell>

                                                            <TableCell className="p-3 text-zinc-600">
                                                                <span className="text-xs truncate max-w-[120px] block" title={account.note || ''}>
                                                                    {account.note || '-'}
                                                                </span>
                                                            </TableCell>

                                                            <TableCell className="p-3 text-center">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 rounded-lg cursor-pointer text-indigo-600 hover:text-indigo-800"
                                                                        onClick={() => openEditModal(account)}
                                                                        title="Sửa chi tiết tài khoản"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </Button>

                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                                                                        onClick={() => {
                                                                            const copyData = [
                                                                                parsed.tk,
                                                                                parsed.mk,
                                                                                parsed.twofa
                                                                            ].filter(Boolean).join('|');
                                                                            copyText(copyData, `all-${account.id}`);
                                                                        }}
                                                                        title="Copy TK|MK|2FA"
                                                                    >
                                                                        {copiedField === `all-${account.id}` ? (
                                                                            <Check className="w-3.5 h-3.5 text-green-600" />
                                                                        ) : (
                                                                            <Copy className="w-3.5 h-3.5" />
                                                                        )}
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        className="h-7 w-7 p-0 rounded-lg cursor-pointer"
                                                                        onClick={() => handleDelete(account.id)}
                                                                        title="Xóa tài khoản"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Pagination */}
                                    {paginatedData.totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-4 px-2">
                                            <span className="text-xs text-zinc-500 font-medium">
                                                Hiển thị {paginatedData.startIndex + 1}-{Math.min(paginatedData.startIndex + pageSize, paginatedData.total)} / Tổng {paginatedData.total} tài khoản
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                    className="rounded-lg cursor-pointer"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </Button>
                                                <span className="text-xs font-extrabold text-zinc-700">
                                                    Trang {currentPage} / {paginatedData.totalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCurrentPage(p => Math.min(paginatedData.totalPages, p + 1))}
                                                    disabled={currentPage === paginatedData.totalPages}
                                                    className="rounded-lg cursor-pointer"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Sold Accounts Tab */}
            {activeTab === 'sold' && (
                <Card className="rounded-2xl border-zinc-200 shadow-2xs">
                    <CardHeader className="pb-3 border-b border-zinc-100">
                        <CardTitle className="text-xs uppercase font-black text-zinc-800 tracking-wider flex items-center gap-2">
                            <User className="w-4 h-4 text-emerald-600" />
                            LỊCH SỬ TÀI KHOẢN ĐÃ BÁN CHO KHÁCH HÀNG ({accounts.filter(a => a.sale_status === 'sold').length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-3">
                        {loading ? (
                            <div className="text-center py-12">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                                <p className="mt-2 text-zinc-500 font-bold text-xs">Đang tải danh sách đã bán...</p>
                            </div>
                        ) : accounts.filter(a => a.sale_status === 'sold').length === 0 ? (
                            <div className="text-center py-12 text-zinc-400 font-medium">
                                <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="font-bold text-sm">Chưa có tài khoản nào được bán.</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <Table className="w-full text-left border-collapse">
                                        <TableHeader>
                                            <TableRow className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-black text-zinc-600">
                                                <TableHead className="p-3">LOẠI TÀI KHOẢN</TableHead>
                                                <TableHead className="p-3">CODE</TableHead>
                                                <TableHead className="p-3">TK</TableHead>
                                                <TableHead className="p-3">MK</TableHead>
                                                <TableHead className="p-3">MAIL KP</TableHead>
                                                <TableHead className="p-3">2FA</TableHead>
                                                <TableHead className="p-3">KHÁCH HÀNG MUA</TableHead>
                                                <TableHead className="p-3">NGÀY BÁN</TableHead>
                                                <TableHead className="p-3">NOTE</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="divide-y divide-zinc-100">
                                            {soldAccountsData.paginatedSold.map((account) => {
                                                const parsed = parseAccountData(account.data);
                                                return (
                                                    <TableRow key={account.id} className="hover:bg-zinc-50 font-medium">
                                                        <TableCell className="p-3">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase">
                                                                {account.type_name}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="p-3 font-mono text-zinc-500 font-bold text-[11px]">
                                                            {account.code || '-'}
                                                        </TableCell>
                                                        <TableCell className="p-3">
                                                            <code className="text-[11px] bg-zinc-100 px-2 py-1 rounded-lg font-mono text-zinc-900 font-bold">
                                                                {parsed.tk || '-'}
                                                            </code>
                                                        </TableCell>
                                                        <TableCell className="p-3">
                                                            <code className="text-[11px] bg-zinc-100 px-2 py-1 rounded-lg font-mono text-indigo-600 font-bold">
                                                                {parsed.mk || '-'}
                                                            </code>
                                                        </TableCell>
                                                        <TableCell className="p-3">
                                                            <code className="text-[11px] bg-zinc-100 px-2 py-1 rounded-lg font-mono text-zinc-600">
                                                                {parsed.extra || '-'}
                                                            </code>
                                                        </TableCell>
                                                        <TableCell className="p-3">
                                                            <code className="text-[11px] bg-zinc-100 px-2 py-1 rounded-lg font-mono text-amber-600 font-bold">
                                                                {parsed.twofa || '-'}
                                                            </code>
                                                        </TableCell>
                                                        <TableCell className="p-3">
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">
                                                                <User className="w-3 h-3" />
                                                                {account.buyer_username ? `@${account.buyer_username}` : 'Khách vãng lai'}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="p-3 font-semibold text-zinc-600">
                                                            {formatDate(account.sold_at || '')}
                                                        </TableCell>
                                                        <TableCell className="p-3 text-zinc-500">
                                                            {account.note || '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                                {soldAccountsData.totalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4 px-2">
                                        <span className="text-xs text-zinc-500 font-medium">
                                            Trang {soldPage} / {soldAccountsData.totalPages} (Tổng: {soldAccountsData.totalSold})
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSoldPage(p => Math.max(1, p - 1))}
                                                disabled={soldPage <= 1}
                                                className="rounded-lg cursor-pointer"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setSoldPage(p => Math.min(soldAccountsData.totalPages, p + 1))}
                                                disabled={soldPage >= soldAccountsData.totalPages}
                                                className="rounded-lg cursor-pointer"
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* SINGLE ACCOUNT EDIT MODAL */}
            {editingAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
                    <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-5 border border-zinc-200 animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <h3 className="font-extrabold text-sm text-zinc-900 flex items-center gap-2">
                                <Edit2 size={16} className="text-indigo-600" />
                                Chỉnh Sửa Chi Tiết Tài Khoản #{editingAccount.id}
                            </h3>
                            <button
                                onClick={() => setEditingAccount(null)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveSingleAccountModal} className="space-y-4">
                            <div>
                                <label className="font-bold text-[11px] uppercase text-zinc-700 mb-1 block">Loại Tài Khoản *</label>
                                <Select value={editTypeId.toString()} onValueChange={(val) => setEditTypeId(Number(val))}>
                                    <SelectTrigger className="w-full rounded-xl border-zinc-200 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {types.map((t) => (
                                            <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="font-bold text-[11px] uppercase text-zinc-700 mb-1 block">Thông tin Tài Khoản Full (TK|MK|MailKP|2FA) *</label>
                                <Textarea
                                    rows={3}
                                    value={editDataStr}
                                    onChange={(e) => setEditDataStr(e.target.value)}
                                    className="rounded-xl border-zinc-200 font-mono text-xs"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[11px] uppercase text-zinc-700 mb-1 block">Mã Code / Gói</label>
                                    <Input
                                        value={editCode}
                                        onChange={(e) => setEditCode(e.target.value)}
                                        className="rounded-xl border-zinc-200 font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[11px] uppercase text-zinc-700 mb-1 block">Trạng Thái Bán</label>
                                    <Select value={editSaleStatus} onValueChange={setEditSaleStatus}>
                                        <SelectTrigger className="rounded-xl border-zinc-200 font-bold text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="in_stock">🟢 Còn hàng (Chưa bán)</SelectItem>
                                            <SelectItem value="sold">🔵 Đã bán (Khách mua)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[11px] uppercase text-zinc-700 mb-1 block">Tình Trạng Pay</label>
                                    <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                                        <SelectTrigger className="rounded-xl border-zinc-200 font-bold text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pending">🟡 Chưa pay</SelectItem>
                                            <SelectItem value="paid">🟢 Đã pay</SelectItem>
                                            <SelectItem value="invalid">🔴 Sai TT / Lỗi</SelectItem>
                                            <SelectItem value="package_error">⚠️ Lỗi gói</SelectItem>
                                            <SelectItem value="wrong_info">❌ Sai TT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <label className="font-bold text-[11px] uppercase text-zinc-700 mb-1 block">Trạng Thái Bot</label>
                                    <Select value={editBotStatus} onValueChange={setEditBotStatus}>
                                        <SelectTrigger className="rounded-xl border-zinc-200 font-bold text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="not_uploaded">Chưa lên Bot</SelectItem>
                                            <SelectItem value="uploaded">Đã lên Bot</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-[11px] uppercase text-zinc-700 mb-1 block">Note Ghi Chú Nội Bộ</label>
                                <Input
                                    value={editNote}
                                    onChange={(e) => setEditNote(e.target.value)}
                                    className="rounded-xl border-zinc-200 text-xs"
                                    placeholder="Thêm ghi chú..."
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setEditingAccount(null)} className="rounded-xl font-bold text-xs">
                                    Hủy
                                </Button>
                                <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-5">
                                    {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* FULL CRUD ACCOUNT TYPES DIALOG */}
            <Dialog
                open={showAddTypeDialog}
                onOpenChange={(open) => {
                    setShowAddTypeDialog(open);
                    if (!open) {
                        setEditingTypeId(null);
                        setTypeError('');
                    }
                }}
                title="Quản lý CRUD Các Loại Tài Khoản (ChatGPT, CapCut...)"
                description="Thêm mới, sửa tên, khởi tạo danh mục mẫu, và chuyển toàn bộ tài khoản giữa các nhóm."
                className="max-w-3xl"
            >
                <div className="space-y-5 pt-5 text-xs">
                    {/* Seed Presets Button */}
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 flex items-center justify-between gap-4">
                        <div>
                            <span className="font-extrabold text-indigo-950 uppercase text-xs block">⚡ KHỞI TẠO MẪU CÁC LOẠI TK PHỔ BIẾN</span>
                            <p className="text-[11px] text-indigo-700/80 mt-0.5">
                                Tự động tạo ChatGPT, CapCut Pro, Gmail EDU, Canva Pro, Netflix 4K, Spotify, Telegram Premium...
                            </p>
                        </div>
                        <Button
                            onClick={handleSeedPresets}
                            disabled={addingType}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-4 py-2 shrink-0 cursor-pointer"
                        >
                            <Sparkles className="w-4 h-4 mr-1" />
                            {addingType ? 'Đang tạo...' : 'Khởi Tạo Mẫu'}
                        </Button>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                        <label htmlFor="new-account-type" className="mb-2 block text-xs font-bold text-zinc-800 uppercase">
                            Thêm Loại Tài Khoản Mới
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Input
                                id="new-account-type"
                                placeholder="Ví dụ: ChatGPT Team, CapCut Pro Workspace..."
                                value={newTypeName}
                                onChange={(e) => setNewTypeName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddType();
                                }}
                                className="rounded-xl border-zinc-200 text-xs font-medium"
                                autoFocus
                            />
                            <Button onClick={handleAddType} disabled={addingType || !newTypeName.trim()} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer">
                                {addingType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                                {addingType ? 'Đang thêm' : 'Thêm Loại'}
                            </Button>
                        </div>
                    </div>

                    {typeError && (
                        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">
                            {typeError}
                        </div>
                    )}

                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase text-zinc-800">Danh sách các loại hiện có ({types.length})</h3>
                        </div>
                        {types.length === 0 ? (
                            <div className="flex flex-col items-center rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-center">
                                <FolderOpen className="mb-3 h-8 w-8 text-zinc-400" />
                                <p className="text-sm font-medium text-zinc-700">Chưa có loại tài khoản nào</p>
                            </div>
                        ) : (
                            <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-200">
                                <Table className="w-full text-left">
                                    <TableHeader>
                                        <TableRow className="bg-zinc-50 border-b text-[10px] uppercase font-black text-zinc-600">
                                            <TableHead className="p-3">TÊN LOẠI TÀI KHOẢN</TableHead>
                                            <TableHead className="p-3 text-center">CÒN HÀNG</TableHead>
                                            <TableHead className="p-3 text-center">ĐÃ BÁN</TableHead>
                                            <TableHead className="p-3 text-center">THAO TÁC CRUD</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody className="divide-y divide-zinc-100">
                                        {types.map((type) => (
                                            <TableRow key={type.id} className="hover:bg-zinc-50">
                                                <TableCell className="p-3">
                                                    {editingTypeId === type.id ? (
                                                        <Input
                                                            value={editingTypeName}
                                                            onChange={(e) => setEditingTypeName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleRenameType(type.id);
                                                                if (e.key === 'Escape') setEditingTypeId(null);
                                                            }}
                                                            className="h-8 text-xs rounded-lg"
                                                            autoFocus
                                                        />
                                                    ) : (
                                                        <span className="font-extrabold text-zinc-900 text-xs">{type.name}</span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="p-3 text-center">
                                                    <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                                                        {type.in_stock_count || 0}
                                                    </span>
                                                </TableCell>

                                                <TableCell className="p-3 text-center">
                                                    <span className="bg-blue-100 text-blue-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                                                        {type.sold_count || 0}
                                                    </span>
                                                </TableCell>

                                                <TableCell className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {editingTypeId === type.id ? (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs font-bold text-emerald-600"
                                                                    onClick={() => handleRenameType(type.id)}
                                                                >
                                                                    Lưu
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs font-bold text-zinc-400"
                                                                    onClick={() => setEditingTypeId(null)}
                                                                >
                                                                    Hủy
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 px-2 text-xs font-bold text-zinc-600 hover:text-zinc-900 cursor-pointer"
                                                                    onClick={() => {
                                                                        setEditingTypeId(type.id);
                                                                        setEditingTypeName(type.name);
                                                                    }}
                                                                    title="Sửa tên"
                                                                >
                                                                    <Edit2 className="h-3.5 w-3.5 mr-1" /> Sửa
                                                                </Button>

                                                                {Number(type.account_count || 0) > 0 && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-7 px-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                                                        onClick={() => {
                                                                            const target = prompt(`Nhập ID loại tài khoản mới bạn muốn chuyển toàn bộ ${type.account_count} tài khoản từ "${type.name}" sang:`);
                                                                            if (target && !isNaN(Number(target))) {
                                                                                handleReassignTypeAccounts(type.id, Number(target));
                                                                            }
                                                                        }}
                                                                        title="Chuyển toàn bộ tài khoản sang loại khác"
                                                                    >
                                                                        <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Chuyển
                                                                    </Button>
                                                                )}

                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 cursor-pointer"
                                                                    onClick={() => handleDeleteType(type)}
                                                                    title="Xóa loại"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
