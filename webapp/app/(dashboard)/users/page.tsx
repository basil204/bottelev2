'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { Search, UserCog, Package, ShoppingCart, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface User {
    id: number;
    username: string;
    telegram_id: number;
    balance: number;
    created_at: string;
}

interface Order {
    id: number;
    invoice_code: string;
    product_id: number;
    price: number;
    email: string | null;
    note: string | null;
    status: string;
    created_at: string;
    completed_at: string | null;
    product_name: string;
}

interface ProductSummary {
    productId: number;
    productName: string;
    count: number;
    totalSpent: number;
    lastPurchase: string;
}

import { useLanguage } from '@/contexts/LanguageContext';

export default function UsersPage() {
    const { t } = useLanguage();
    const { formatPrice } = useCurrency();
    const [users, setUsers] = useState<User[]>([]);
    // ... (state)
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [actionType, setActionType] = useState<'add' | 'subtract'>('add');
    const [searchQuery, setSearchQuery] = useState('');

    // Purchase history state
    const [activeTab, setActiveTab] = useState<'balance' | 'orders'>('balance');
    const [userOrders, setUserOrders] = useState<Order[]>([]);
    const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    const fetchUsers = () => {
        setLoading(true);
        fetch(`/api/users?page=${page}&limit=10&search=${searchQuery}`)
            .then((res) => res.json())
            .then((data) => {
                setUsers(Array.isArray(data.data) ? data.data : []);
                setTotalPages(data.pagination?.totalPages || 1);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setUsers([]);
                setTotalPages(1);
                setLoading(false);
            });
    };

    const fetchUserOrders = async (userId: number) => {
        setLoadingOrders(true);
        try {
            const res = await fetch(`/api/users/${userId}/orders`);
            const data = await res.json();
            setUserOrders(data.orders || []);
            setProductSummary(data.summary || []);
        } catch (err) {
            console.error(err);
            setUserOrders([]);
            setProductSummary([]);
        } finally {
            setLoadingOrders(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers();
        }, 500);

        return () => clearTimeout(timer);
    }, [page, searchQuery]);

    // Fetch orders when user is selected
    useEffect(() => {
        if (selectedUser) {
            fetchUserOrders(selectedUser.id);
            setActiveTab('balance');
        } else {
            setUserOrders([]);
            setProductSummary([]);
        }
    }, [selectedUser]);

    // Handle search input change directly
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setPage(1); // Reset to page 1 on search
    };

    const handleBalanceUpdate = async () => {
        if (!selectedUser || !amount) return;

        const res = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: selectedUser.id,
                amount: Number(amount),
                type: actionType,
                reason
            }),
        });

        if (res.ok) {
            alert(t('users.success'));
            setSelectedUser(null);
            setAmount('');
            setReason('');
            fetchUsers();
        } else {
            alert(t('users.error'));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('users.title')}</h2>
                    <p className="text-muted-foreground">{t('users.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        type="text"
                        placeholder={t('users.search_placeholder')}
                        className="w-64"
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                    <Button variant="secondary" onClick={() => fetchUsers()}>
                        <Search className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('users.directory')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('users.id')}</TableHead>
                                    <TableHead>{t('users.username')}</TableHead>
                                    <TableHead>{t('users.telegram_id')}</TableHead>
                                    <TableHead>{t('users.balance')}</TableHead>
                                    <TableHead>{t('users.joined_date')}</TableHead>
                                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">{t('common.loading')}</TableCell>
                                    </TableRow>
                                ) : (
                                    users.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell>#{user.id}</TableCell>
                                            <TableCell className="font-medium">{user.username || 'N/A'}</TableCell>
                                            <TableCell className="text-muted-foreground">{user.telegram_id}</TableCell>
                                            <TableCell className="font-bold text-green-600 dark:text-green-400">
                                                {formatPrice(user.balance)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSelectedUser(user)}
                                                >
                                                    <UserCog className="w-4 h-4 mr-2" />
                                                    {t('users.manage')}
                                                </Button>
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
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                        >
                            Next
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog
                open={!!selectedUser}
                onOpenChange={(open) => !open && setSelectedUser(null)}
                title={`${t('users.manage_balance')}: ${selectedUser?.username}`}
            >
                <div className="space-y-4 pt-4">
                    {/* Tab Buttons */}
                    <div className="flex gap-2 border-b pb-2">
                        <Button
                            type="button"
                            variant={activeTab === 'balance' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('balance')}
                        >
                            <UserCog className="w-4 h-4 mr-2" />
                            Số dư
                        </Button>
                        <Button
                            type="button"
                            variant={activeTab === 'orders' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('orders')}
                        >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Lịch sử mua ({userOrders.length})
                        </Button>
                    </div>

                    {/* Balance Tab */}
                    {activeTab === 'balance' && (
                        <>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    className="flex-1"
                                    variant={actionType === 'add' ? 'default' : 'outline'}
                                    onClick={() => setActionType('add')}
                                >
                                    {t('users.add')}
                                </Button>
                                <Button
                                    type="button"
                                    className="flex-1"
                                    variant={actionType === 'subtract' ? 'destructive' : 'outline'}
                                    onClick={() => setActionType('subtract')}
                                >
                                    {t('users.subtract')}
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('users.amount')}</label>
                                <Input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder={t('users.enter_amount')}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('users.reason')}</label>
                                <Textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder={t('users.reason_placeholder')}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={() => setSelectedUser(null)}>{t('common.cancel')}</Button>
                                <Button
                                    onClick={handleBalanceUpdate}
                                    variant={actionType === 'add' ? 'default' : 'destructive'}
                                >
                                    {t('users.confirm')} {actionType === 'add' ? t('users.credit') : t('users.debit')}
                                </Button>
                            </div>
                        </>
                    )}

                    {/* Orders Tab */}
                    {activeTab === 'orders' && (
                        <div className="space-y-4">
                            {/* Product Summary */}
                            {productSummary.length > 0 && (
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <h4 className="font-medium mb-2 flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Sản phẩm đã mua
                                    </h4>
                                    <div className="space-y-2">
                                        {productSummary.map((item) => (
                                            <div key={item.productId} className="flex justify-between items-center text-sm bg-background rounded p-2">
                                                <span className="font-medium">{item.productName}</span>
                                                <div className="text-right">
                                                    <div className="text-green-600 font-medium">{item.count} lần</div>
                                                    <div className="text-muted-foreground text-xs">{formatPrice(item.totalSpent)}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Orders List */}
                            <div className="flex items-center justify-between">
                                <h4 className="font-medium">Chi tiết đơn hàng</h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => selectedUser && fetchUserOrders(selectedUser.id)}
                                    disabled={loadingOrders}
                                >
                                    <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>

                            {loadingOrders ? (
                                <div className="text-center py-4 text-muted-foreground">Đang tải...</div>
                            ) : userOrders.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground">Chưa có đơn hàng nào</div>
                            ) : (
                                <div className="max-h-64 overflow-y-auto space-y-2">
                                    {userOrders.map((order) => (
                                        <div key={order.id} className="border rounded-lg p-3 text-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-medium">{order.product_name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${order.status === 'completed'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                    : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    }`}>
                                                    {order.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
                                                </span>
                                            </div>
                                            <div className="text-muted-foreground text-xs space-y-0.5">
                                                {order.invoice_code && <div>🧾 {order.invoice_code}</div>}
                                                <div>💰 {formatPrice(order.price)}</div>
                                                <div>🕐 {new Date(order.created_at).toLocaleString('vi-VN')}</div>
                                                {order.email && <div>📧 {order.email}</div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="flex justify-end pt-2">
                                <Button variant="outline" onClick={() => setSelectedUser(null)}>{t('common.cancel')}</Button>
                            </div>
                        </div>
                    )}
                </div>
            </Dialog>
        </div>
    );
}
