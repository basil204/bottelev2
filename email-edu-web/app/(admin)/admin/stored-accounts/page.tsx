'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { RefreshCw, Plus, Trash2, Package, Copy, Check, Edit2, Save, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface AccountType {
    id: number;
    name: string;
}

interface StoredAccount {
    id: number;
    account_type_id: number;
    type_name: string;
    data: string;
    payment_status: 'pending' | 'paid' | 'invalid';
    sale_status: 'in_stock' | 'sold';
    paid_at: string | null;
    sold_at: string | null;
    note: string | null;
    created_at: string;
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
    pending: 'Chưa pay',
    paid: 'Đã pay',
    invalid: 'Sai thông tin'
};

const SALE_STATUS_LABELS: Record<string, string> = {
    in_stock: 'Còn hàng',
    sold: 'Đã bán'
};

export default function StoredAccountsPage() {
    const [accounts, setAccounts] = useState<StoredAccount[]>([]);
    const [types, setTypes] = useState<AccountType[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editNote, setEditNote] = useState('');

    // Form state
    const [selectedType, setSelectedType] = useState<string>('');
    const [accountData, setAccountData] = useState('');
    const [note, setNote] = useState('');

    // Filter state
    const [filterType, setFilterType] = useState<string>('all');
    const [filterPayment, setFilterPayment] = useState<string>('all');
    const [filterSale, setFilterSale] = useState<string>('all');

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
    }, [filterType, filterPayment, filterSale]);

    useEffect(() => {
        fetchTypes();
    }, []);

    useEffect(() => {
        fetchAccounts();
    }, [fetchAccounts]);

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
                    note: note || null
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                setAccountData('');
                setNote('');
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

    const handleUpdateStatus = async (id: number, field: 'payment_status' | 'sale_status', value: string) => {
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
        if (!confirm('Bạn có chắc muốn xóa tài khoản này?')) return;

        try {
            const res = await fetch('/api/stored-accounts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
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

    const copyData = (data: string, id: number) => {
        navigator.clipboard.writeText(data);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
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
        invalid: accounts.filter(a => a.payment_status === 'invalid').length,
        inStock: accounts.filter(a => a.sale_status === 'in_stock').length,
        sold: accounts.filter(a => a.sale_status === 'sold').length,
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

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-6">
                <Card>
                    <CardContent className="pt-4">
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">Tổng cộng</p>
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
                        <div className="text-2xl font-bold text-red-600">{stats.invalid}</div>
                        <p className="text-xs text-muted-foreground">Sai thông tin</p>
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
                                    onClick={() => {
                                        const name = prompt('Nhập tên loại tài khoản mới:');
                                        if (name?.trim()) {
                                            fetch('/api/account-types', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ name: name.trim() })
                                            }).then(res => res.json()).then(data => {
                                                if (data.success) {
                                                    fetchTypes();
                                                    alert('Đã thêm loại: ' + name.trim());
                                                } else {
                                                    alert(data.error);
                                                }
                                            });
                                        }
                                    }}
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
                    <div>
                        <label className="text-sm font-medium mb-2 block">
                            Thông tin tài khoản (mỗi dòng 1 tài khoản để thêm nhiều)
                        </label>
                        <Textarea
                            placeholder="email:password hoặc username:password..."
                            value={accountData}
                            onChange={(e) => setAccountData(e.target.value)}
                            rows={4}
                        />
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
                        <div className="w-48">
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
                        <div className="w-48">
                            <label className="text-sm font-medium mb-2 block">Tình trạng pay</label>
                            <Select value={filterPayment} onValueChange={setFilterPayment}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tất cả</SelectItem>
                                    <SelectItem value="pending">Chưa pay</SelectItem>
                                    <SelectItem value="paid">Đã pay</SelectItem>
                                    <SelectItem value="invalid">Sai thông tin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-48">
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
                        <div className="max-h-[600px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Loại</TableHead>
                                        <TableHead>Thông tin</TableHead>
                                        <TableHead className="w-[130px]">Tình trạng</TableHead>
                                        <TableHead className="w-[120px]">Trạng thái</TableHead>
                                        <TableHead className="w-[100px]">Ngày pay</TableHead>
                                        <TableHead className="w-[100px]">Ngày bán</TableHead>
                                        <TableHead className="w-[150px]">Ghi chú</TableHead>
                                        <TableHead className="w-[100px]">Hành động</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {accounts.map((account) => (
                                        <TableRow key={account.id}>
                                            <TableCell>
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                                    {account.type_name}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <code className="text-sm bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                                                        {account.data}
                                                    </code>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyData(account.data, account.id)}
                                                    >
                                                        {copiedId === account.id ? (
                                                            <Check className="w-4 h-4 text-green-500" />
                                                        ) : (
                                                            <Copy className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={account.payment_status}
                                                    onValueChange={(val) => handleUpdateStatus(account.id, 'payment_status', val)}
                                                >
                                                    <SelectTrigger className={`w-[120px] text-xs ${account.payment_status === 'paid' ? 'border-green-500 text-green-600' :
                                                        account.payment_status === 'invalid' ? 'border-red-500 text-red-600' :
                                                            'border-yellow-500 text-yellow-600'
                                                        }`}>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="pending">Chưa pay</SelectItem>
                                                        <SelectItem value="paid">Đã pay</SelectItem>
                                                        <SelectItem value="invalid">Sai thông tin</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={account.sale_status}
                                                    onValueChange={(val) => handleUpdateStatus(account.id, 'sale_status', val)}
                                                >
                                                    <SelectTrigger className={`w-[100px] text-xs ${account.sale_status === 'sold' ? 'border-purple-500 text-purple-600' :
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
                                            <TableCell className="text-xs text-muted-foreground">
                                                {account.paid_at ? formatDate(account.paid_at) : '-'}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {account.sold_at ? formatDate(account.sold_at) : '-'}
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
                                                            onClick={() => handleSaveNote(account.id)}
                                                        >
                                                            <Save className="w-3 h-3" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setEditingId(null)}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xs truncate max-w-[80px]" title={account.note || ''}>
                                                            {account.note || '-'}
                                                        </span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => startEditNote(account)}
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => handleDelete(account.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
