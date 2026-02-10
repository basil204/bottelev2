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
import { RefreshCw, Plus, Trash2, Package, Copy, Check, Edit2, Save, X, User, ChevronLeft, ChevronRight, KeyRound, Loader2 } from 'lucide-react';

interface AccountType {
    id: number;
    name: string;
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
    return new Date(dateString).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Parse data string to extract TK, MK, 2FA
// Supports formats:
// - username|password
// - username|password|2fa
// - username|password|mail_kp|2fa
// - username:password:2fa
// - username\tpassword\t2fa
// - key (single value)
// - email (single value)
function parseAccountData(data: string): { tk: string; mk: string; extra: string; twofa: string } {
    // Determine separator: tab, pipe, or colon
    let parts: string[] = [];

    if (data.includes('\t')) {
        parts = data.split('\t');
    } else if (data.includes('|')) {
        parts = data.split('|');
    } else if (data.includes(':')) {
        parts = data.split(':');
    } else {
        // Single value (key or email)
        parts = [data];
    }

    // Handle different formats
    if (parts.length === 1) {
        // Just key or email
        return { tk: parts[0], mk: '', extra: '', twofa: '' };
    } else if (parts.length === 2) {
        // username|password
        return { tk: parts[0], mk: parts[1], extra: '', twofa: '' };
    } else if (parts.length === 3) {
        // username|password|2fa
        return { tk: parts[0], mk: parts[1], extra: '', twofa: parts[2] };
    } else if (parts.length >= 4) {
        // username|password|mail_kp|2fa
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
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editNote, setEditNote] = useState('');

    // 2FA token state
    const [twoFaTokens, setTwoFaTokens] = useState<Record<string, string>>({});
    const [loadingTwoFa, setLoadingTwoFa] = useState<Record<string, boolean>>({});

    // Form state
    const [selectedType, setSelectedType] = useState<string>('');
    const [accountData, setAccountData] = useState('');
    const [note, setNote] = useState('');
    const [code, setCode] = useState('');

    // Filter state
    const [filterType, setFilterType] = useState<string>('all');
    const [filterPayment, setFilterPayment] = useState<string>('all');
    const [filterSale, setFilterSale] = useState<string>('all');
    const [filterBot, setFilterBot] = useState<string>('all');

    // Add type dialog
    const [showAddTypeDialog, setShowAddTypeDialog] = useState(false);
    const [newTypeName, setNewTypeName] = useState('');
    const [addingType, setAddingType] = useState(false);
    const [copiedAll, setCopiedAll] = useState(false);

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

    // Sold accounts pagination
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
            let url = '/api/stored-accounts?';
            const params = new URLSearchParams();

            if (filterType !== 'all') params.append('type', filterType);
            if (filterPayment !== 'all') params.append('payment_status', filterPayment);
            if (filterSale !== 'all') params.append('sale_status', filterSale);
            if (filterBot !== 'all') params.append('bot_status', filterBot);

            const res = await fetch(url + params.toString());
            const data = await res.json();
            if (data.success) {
                setAccounts(data.data || []);
            }
        } catch (error) {
            console.error('Error fetching stored accounts:', error);
        } finally {
            setLoading(false);
        }
    }, [filterType, filterPayment, filterSale, filterBot]);

    useEffect(() => {
        fetchTypes();
    }, []);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

    const handleAddType = async () => {
        if (!newTypeName.trim()) return;

        try {
            setAddingType(true);
            const res = await fetch('/api/account-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTypeName.trim() })
            });
            const data = await res.json();
            if (data.success) {
                fetchTypes();
                setNewTypeName('');
                setShowAddTypeDialog(false);
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error adding type:', error);
        } finally {
            setAddingType(false);
        }
    };

    const handleAdd = async () => {
        if (!selectedType) {
            alert('Vui lòng chọn loại tài khoản');
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
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error adding account:', error);
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

    const handleSaveNote = async (id: number) => {
        try {
            const res = await fetch('/api/stored-accounts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, note: editNote })
            });
            const data = await res.json();
            if (data.success) {
                setEditingId(null);
                fetchAccounts();
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error updating note:', error);
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
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Error deleting account:', error);
        }
    };


    const copyText = (text: string, fieldId: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const startEditNote = (account: StoredAccount) => {
        setEditingId(account.id);
        setEditNote(account.note || '');
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

    const copyAllFiltered = () => {
        const allData = accounts.map(account => account.data).join('\n');
        navigator.clipboard.writeText(allData);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Kho Tài Khoản</h2>
                    <p className="text-muted-foreground">Quản lý tài khoản lưu trữ</p>
                </div>
                <Button onClick={fetchAccounts} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Làm mới
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'all'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Package className="w-4 h-4 inline mr-2" />
                    Tất cả tài khoản
                </button>
                <button
                    onClick={() => setActiveTab('sold')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sold'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <User className="w-4 h-4 inline mr-2" />
                    Đã bán ({accounts.filter(a => a.sale_status === 'sold').length})
                </button>
            </div>

            {activeTab === 'all' && (
                <>
                    {/* Stats */}
                    <div className="grid gap-4 md:grid-cols-7">
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold">{stats.total}</div>
                                <p className="text-xs text-muted-foreground">Tổng</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                                <p className="text-xs text-muted-foreground">Chưa pay</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-green-600">{stats.paid}</div>
                                <p className="text-xs text-muted-foreground">Đã pay</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-blue-600">{stats.inStock}</div>
                                <p className="text-xs text-muted-foreground">Còn hàng</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-purple-600">{stats.sold}</div>
                                <p className="text-xs text-muted-foreground">Đã bán</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-orange-600">{stats.notUploaded}</div>
                                <p className="text-xs text-muted-foreground">Chưa lên Bot</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-4">
                                <div className="text-2xl font-bold text-teal-600">{stats.uploaded}</div>
                                <p className="text-xs text-muted-foreground">Đã lên Bot</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Add new account */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Thêm tài khoản mới</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Loại tài khoản</label>
                                    <div className="flex gap-2">
                                        <Select value={selectedType} onValueChange={setSelectedType}>
                                            <SelectTrigger className="flex-1">
                                                <SelectValue placeholder="Chọn loại tài khoản" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {types.map(type => (
                                                    <SelectItem key={type.id} value={type.id.toString()}>
                                                        {type.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setShowAddTypeDialog(true)}
                                            title="Thêm loại mới"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Ghi chú (tùy chọn)</label>
                                    <Input
                                        placeholder="Ghi chú..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Code (tùy chọn)</label>
                                    <Input
                                        placeholder="Mã code..."
                                        value={code}
                                        onChange={(e) => setCode(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block">
                                        Thông tin tài khoản (mỗi dòng 1 tài khoản)
                                    </label>
                                    <p className="text-xs text-muted-foreground mb-2">
                                        Hỗ trợ: user|pass, user|pass|2fa, user|pass|mail|2fa, key, email (phân cách bằng | hoặc : hoặc tab)
                                    </p>
                                    <Textarea
                                        placeholder="email:password:2fa hoặc dùng tab phân cách..."
                                        value={accountData}
                                        onChange={(e) => setAccountData(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                            </div>
                            <Button onClick={handleAdd} disabled={saving}>
                                <Plus className="w-4 h-4 mr-2" />
                                {saving ? 'Đang thêm...' : 'Thêm tài khoản'}
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Filters */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Bộ lọc</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-4">
                                <div className="w-40">
                                    <label className="text-sm font-medium mb-2 block">Loại tài khoản</label>
                                    <Select value={filterType} onValueChange={setFilterType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả</SelectItem>
                                            {types.map(type => (
                                                <SelectItem key={type.id} value={type.id.toString()}>
                                                    {type.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-36">
                                    <label className="text-sm font-medium mb-2 block">Tình trạng pay</label>
                                    <Select value={filterPayment} onValueChange={setFilterPayment}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả</SelectItem>
                                            <SelectItem value="pending">Chưa pay</SelectItem>
                                            <SelectItem value="paid">Đã pay</SelectItem>
                                            <SelectItem value="invalid">Sai TT</SelectItem>
                                            <SelectItem value="package_error">Lỗi gói</SelectItem>
                                            <SelectItem value="wrong_info">Sai thông tin</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-36">
                                    <label className="text-sm font-medium mb-2 block">Trạng thái bán</label>
                                    <Select value={filterSale} onValueChange={setFilterSale}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả</SelectItem>
                                            <SelectItem value="in_stock">Còn hàng</SelectItem>
                                            <SelectItem value="sold">Đã bán</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="w-36">
                                    <label className="text-sm font-medium mb-2 block">Lên Bot</label>
                                    <Select value={filterBot} onValueChange={setFilterBot}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tất cả</SelectItem>
                                            <SelectItem value="not_uploaded">Chưa lên</SelectItem>
                                            <SelectItem value="uploaded">Đã lên</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end">
                                    <Button
                                        variant="outline"
                                        onClick={copyAllFiltered}
                                        disabled={accounts.length === 0}
                                        className={copiedAll ? 'border-green-500 text-green-500' : ''}
                                    >
                                        {copiedAll ? (
                                            <><Check className="w-4 h-4 mr-2" /> Đã copy {accounts.length} tài khoản</>
                                        ) : (
                                            <><Copy className="w-4 h-4 mr-2" /> Copy tất cả ({accounts.length})</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Accounts Table */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">
                                Danh sách ({accounts.length} tài khoản)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                    <p className="mt-2 text-muted-foreground">Đang tải...</p>
                                </div>
                            ) : accounts.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Không có tài khoản nào</p>
                                </div>
                            ) : (
                                <>
                                    <div className="max-h-[600px] overflow-y-auto">
                                        <Table className="[&_th]:px-1.5 [&_th]:py-2 [&_td]:px-1.5 [&_td]:py-1.5 text-xs">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Loại</TableHead>
                                                    <TableHead>Code</TableHead>
                                                    <TableHead>TK</TableHead>
                                                    <TableHead>MK</TableHead>
                                                    <TableHead>2FA</TableHead>
                                                    <TableHead>Pay</TableHead>
                                                    <TableHead>Ngày pay</TableHead>
                                                    <TableHead>Ngày thêm</TableHead>
                                                    <TableHead>Bán</TableHead>
                                                    <TableHead>Bot</TableHead>
                                                    <TableHead>Người mua</TableHead>
                                                    <TableHead>Note</TableHead>
                                                    <TableHead></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {paginatedData.paginated.map((account) => {
                                                    const parsed = parseAccountData(account.data);
                                                    return (
                                                        <TableRow key={account.id}>
                                                            <TableCell>
                                                                <span className="inline-flex items-center px-1 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 whitespace-nowrap">
                                                                    {account.type_name}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {account.code || '-'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <code
                                                                    className="text-[11px] bg-muted px-1 py-0.5 rounded max-w-[110px] truncate block cursor-pointer hover:bg-muted/80"
                                                                    title={parsed.tk ? `Click để copy: ${parsed.tk}` : ''}
                                                                    onClick={() => parsed.tk && copyText(parsed.tk, `tk-${account.id}`)}
                                                                >
                                                                    {copiedField === `tk-${account.id}` ? '✓ Copied' : (parsed.tk || '-')}
                                                                </code>
                                                            </TableCell>
                                                            <TableCell>
                                                                <code
                                                                    className="text-[11px] bg-muted px-1 py-0.5 rounded max-w-[90px] truncate block cursor-pointer hover:bg-muted/80"
                                                                    title={parsed.mk ? `Click để copy: ${parsed.mk}` : ''}
                                                                    onClick={() => parsed.mk && copyText(parsed.mk, `mk-${account.id}`)}
                                                                >
                                                                    {copiedField === `mk-${account.id}` ? '✓ Copied' : (parsed.mk || '-')}
                                                                </code>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-0.5">
                                                                    <code
                                                                        className="text-[11px] bg-muted px-1 py-0.5 rounded max-w-[60px] truncate block cursor-pointer hover:bg-muted/80"
                                                                        title={parsed.twofa ? `Click để copy: ${parsed.twofa}` : ''}
                                                                        onClick={() => parsed.twofa && copyText(parsed.twofa, `2fa-${account.id}`)}
                                                                    >
                                                                        {copiedField === `2fa-${account.id}` ? '✓' : (parsed.twofa ? parsed.twofa.substring(0, 8) + '...' : '-')}
                                                                    </code>
                                                                    {parsed.twofa && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 w-7 p-0"
                                                                            title="Lấy mã 2FA"
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
                                                                                        setTimeout(() => {
                                                                                            setTwoFaTokens(prev => { const n = { ...prev }; delete n[account.id]; return n; });
                                                                                        }, 30000);
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
                                                                            className="text-[11px] font-mono font-bold text-green-500 cursor-pointer"
                                                                            title="Click để copy mã 2FA"
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(twoFaTokens[account.id]);
                                                                                setCopiedField(`2fa-token-${account.id}`);
                                                                                setTimeout(() => setCopiedField(prev => prev === `2fa-token-${account.id}` ? null : prev), 2000);
                                                                            }}
                                                                        >
                                                                            {copiedField === `2fa-token-${account.id}` ? '✓' : twoFaTokens[account.id]}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            {/* Tình trạng pay */}
                                                            <TableCell>
                                                                <Select
                                                                    value={account.payment_status}
                                                                    onValueChange={(val: string) => handleUpdateStatus(account.id, 'payment_status', val)}
                                                                >
                                                                    <SelectTrigger className={`w-[72px] h-6 text-[11px] ${account.payment_status === 'paid' ? 'border-green-500 text-green-600' :
                                                                        account.payment_status === 'invalid' ? 'border-red-500 text-red-600' :
                                                                            'border-yellow-500 text-yellow-600'
                                                                        }`}>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="pending">Chưa pay</SelectItem>
                                                                        <SelectItem value="paid">Đã pay</SelectItem>
                                                                        <SelectItem value="invalid">Sai TT</SelectItem>
                                                                        <SelectItem value="package_error">Lỗi gói</SelectItem>
                                                                        <SelectItem value="wrong_info">Sai TT tin</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            {/* Ngày pay */}
                                                            <TableCell>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {account.paid_at ? formatDate(account.paid_at) : '-'}
                                                                </span>
                                                            </TableCell>
                                                            {/* Ngày thêm */}
                                                            <TableCell>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatDate(account.created_at)}
                                                                </span>
                                                            </TableCell>
                                                            {/* Trạng thái bán */}
                                                            <TableCell>
                                                                <Select
                                                                    value={account.sale_status}
                                                                    onValueChange={(val: string) => handleUpdateStatus(account.id, 'sale_status', val)}
                                                                >
                                                                    <SelectTrigger className={`w-[72px] h-6 text-[11px] ${account.sale_status === 'sold' ? 'border-purple-500 text-purple-600' :
                                                                        'border-blue-500 text-blue-600'
                                                                        }`}>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="in_stock">Còn hàng</SelectItem>
                                                                        <SelectItem value="sold">Đã bán</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            {/* Lên Bot */}
                                                            <TableCell>
                                                                <Select
                                                                    value={account.bot_status || 'not_uploaded'}
                                                                    onValueChange={(val: string) => handleUpdateStatus(account.id, 'bot_status', val)}
                                                                >
                                                                    <SelectTrigger className={`w-[72px] h-6 text-[11px] ${account.bot_status === 'uploaded' ? 'border-teal-500 text-teal-600' :
                                                                        'border-orange-500 text-orange-600'
                                                                        }`}>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="not_uploaded">Chưa lên</SelectItem>
                                                                        <SelectItem value="uploaded">Đã lên</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </TableCell>
                                                            {/* Người mua */}
                                                            <TableCell>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {account.buyer_username || '-'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                {editingId === account.id ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <Input
                                                                            value={editNote}
                                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditNote(e.target.value)}
                                                                            className="h-7 text-xs w-24"
                                                                        />
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-9 w-9 p-0"
                                                                            onClick={() => handleSaveNote(account.id)}
                                                                            title="Lưu"
                                                                        >
                                                                            <Save className="w-5 h-5" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-9 w-9 p-0"
                                                                            onClick={() => setEditingId(null)}
                                                                            title="Hủy"
                                                                        >
                                                                            <X className="w-5 h-5" />
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-xs truncate max-w-[100px]" title={account.note || ''}>
                                                                            {account.note || '-'}
                                                                        </span>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-9 w-9 p-0"
                                                                            onClick={() => startEditNote(account)}
                                                                            title="Sửa ghi chú"
                                                                        >
                                                                            <Edit2 className="w-5 h-5" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-0.5">
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="h-9 w-9 p-0"
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
                                                                            <Check className="w-5 h-5 text-green-500" />
                                                                        ) : (
                                                                            <Copy className="w-5 h-5" />
                                                                        )}
                                                                    </Button>
                                                                    <Button
                                                                        variant="destructive"
                                                                        size="sm"
                                                                        className="h-9 w-9 p-0"
                                                                        onClick={() => handleDelete(account.id)}
                                                                        title="Xóa tài khoản"
                                                                    >
                                                                        <Trash2 className="w-5 h-5" />
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
                                            <span className="text-sm text-muted-foreground">
                                                Hiển thị {paginatedData.startIndex + 1}-{Math.min(paginatedData.startIndex + pageSize, paginatedData.total)} / {paginatedData.total}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                    disabled={currentPage === 1}
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </Button>
                                                <span className="text-sm font-medium">
                                                    {currentPage} / {paginatedData.totalPages}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setCurrentPage(p => Math.min(paginatedData.totalPages, p + 1))}
                                                    disabled={currentPage === paginatedData.totalPages}
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
            {
                activeTab === 'sold' && (
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <User className="w-5 h-5" />
                                Tài khoản đã bán ({accounts.filter(a => a.sale_status === 'sold').length})
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="text-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                    <p className="mt-2 text-muted-foreground">Đang tải...</p>
                                </div>
                            ) : accounts.filter(a => a.sale_status === 'sold').length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Chưa có tài khoản nào được bán</p>
                                </div>
                            ) : (
                                <>
                                    <div className="max-h-[600px] overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[80px]">Loại</TableHead>
                                                    <TableHead className="w-[80px]">Code</TableHead>
                                                    <TableHead>TK</TableHead>
                                                    <TableHead>MK</TableHead>
                                                    <TableHead>2FA</TableHead>
                                                    <TableHead className="w-[120px]">Người mua</TableHead>
                                                    <TableHead className="w-[100px]">Ngày bán</TableHead>
                                                    <TableHead className="w-[100px]">Ngày thêm</TableHead>
                                                    <TableHead>Note</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {soldAccountsData.paginatedSold.map((account) => {
                                                    const parsed = parseAccountData(account.data);
                                                    return (
                                                        <TableRow key={account.id}>
                                                            <TableCell>
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                                                    {account.type_name}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {account.code || '-'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[120px] truncate cursor-pointer hover:bg-muted/80" title={parsed.tk} onClick={() => copyText(parsed.tk, `sold-tk-${account.id}`)}>
                                                                    {parsed.tk || '-'}
                                                                </code>
                                                            </TableCell>
                                                            <TableCell>
                                                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[100px] truncate cursor-pointer hover:bg-muted/80" title={parsed.mk} onClick={() => copyText(parsed.mk, `sold-mk-${account.id}`)}>
                                                                    {parsed.mk || '-'}
                                                                </code>
                                                            </TableCell>
                                                            <TableCell>
                                                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[100px] truncate cursor-pointer hover:bg-muted/80" title={parsed.twofa} onClick={() => copyText(parsed.twofa, `sold-2fa-${account.id}`)}>
                                                                    {parsed.twofa || '-'}
                                                                </code>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                                                                    <User className="w-3 h-3" />
                                                                    {account.buyer_username || 'N/A'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {account.sold_at ? formatDate(account.sold_at) : '-'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {formatDate(account.created_at)}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className="text-xs text-muted-foreground">
                                                                    {account.note || '-'}
                                                                </span>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    {/* Pagination */}
                                    {soldAccountsData.totalPages > 1 && (
                                        <div className="flex items-center justify-between mt-4">
                                            <span className="text-sm text-muted-foreground">
                                                Trang {soldPage} / {soldAccountsData.totalPages} (Tổng: {soldAccountsData.totalSold})
                                            </span>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSoldPage(p => Math.max(1, p - 1))}
                                                    disabled={soldPage <= 1}
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setSoldPage(p => Math.min(soldAccountsData.totalPages, p + 1))}
                                                    disabled={soldPage >= soldAccountsData.totalPages}
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

            {/* Add Type Dialog */}
            <Dialog
                open={showAddTypeDialog}
                onOpenChange={setShowAddTypeDialog}
                title="Thêm loại tài khoản mới"
            >
                <div className="py-4">
                    <Input
                        placeholder="Nhập tên loại tài khoản..."
                        value={newTypeName}
                        onChange={(e) => setNewTypeName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleAddType();
                            }
                        }}
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowAddTypeDialog(false)}>
                        <X className="w-4 h-4 mr-1" />
                        Hủy
                    </Button>
                    <Button onClick={handleAddType} disabled={addingType || !newTypeName.trim()}>
                        <Plus className="w-4 h-4 mr-1" />
                        {addingType ? 'Đang thêm...' : 'Thêm'}
                    </Button>
                </div>
            </Dialog>
        </div >
    );
}

