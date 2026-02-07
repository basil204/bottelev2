'use client';

import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Plus, Edit, Trash2, Database, List, X, ChevronLeft, ChevronRight, User, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';

interface Product {
    id: number;
    name: string;
    code: string | null;
    price: number;
    description: string;
    stock: number;
    type: 'stock' | 'order';
}

interface Account {
    id: number;
    username: string;
    status: string;
    created_at: string;
}

interface SoldAccount {
    order_id: number;
    invoice_code: string;
    account_data: string;
    price: number;
    sold_at: string;
    user_id: number;
    buyer_username: string;
    buyer_telegram_id: string;
    product_id: number;
    product_name: string;
}

import { useLanguage } from '@/contexts/LanguageContext';

export default function ProductsPage() {
    const { t } = useLanguage();
    const [products, setProducts] = useState<Product[]>([]);
    // ... (state)
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);
    const [isViewStockModalOpen, setIsViewStockModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
    const [stockData, setStockData] = useState('');
    const [currentProductId, setCurrentProductId] = useState<number | null>(null);
    const [currentProductName, setCurrentProductName] = useState<string>('');
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [notifyUsers, setNotifyUsers] = useState(true);
    const [notifyNewProduct, setNotifyNewProduct] = useState(true);
    // Inventory pagination & selection
    const [inventoryPage, setInventoryPage] = useState(1);
    const [inventoryTotalPages, setInventoryTotalPages] = useState(1);
    const [inventoryTotal, setInventoryTotal] = useState(0);
    const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
    const [inventoryLoading, setInventoryLoading] = useState(false);

    // Tab state
    const [activeTab, setActiveTab] = useState<'products' | 'sold'>('products');
    const [soldAccounts, setSoldAccounts] = useState<SoldAccount[]>([]);
    const [soldLoading, setSoldLoading] = useState(false);
    const [soldPage, setSoldPage] = useState(1);
    const [soldTotalPages, setSoldTotalPages] = useState(1);
    const [soldTotal, setSoldTotal] = useState(0);
    const [searchTelegramId, setSearchTelegramId] = useState('');

    const fetchProducts = () => {
        setLoading(true);
        fetch('/api/products')
            .then((res) => res.json())
            .then((data) => {
                setProducts(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => {
                setProducts([]);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm(t('products.delete_confirm'))) return;
        await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
        fetchProducts();
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const fetchSoldInventory = async (page: number = 1, telegramId: string = '') => {
        setSoldLoading(true);
        try {
            let url = `/api/sold-inventory?page=${page}&limit=10`;
            if (telegramId) {
                url += `&telegramId=${encodeURIComponent(telegramId)}`;
            }
            const res = await fetch(url);
            const data = await res.json();
            if (data.data) {
                setSoldAccounts(data.data);
                setSoldPage(data.pagination.page);
                setSoldTotalPages(data.pagination.totalPages);
                setSoldTotal(data.pagination.total);
            }
        } catch (error) {
            console.error('Error fetching sold inventory:', error);
        } finally {
            setSoldLoading(false);
        }
    };

    const handleSearchSold = () => {
        setSoldPage(1);
        fetchSoldInventory(1, searchTelegramId);
    };

    useEffect(() => {
        if (activeTab === 'sold') {
            fetchSoldInventory();
        }
    }, [activeTab]);

    const handleSave = async () => {
        if (!editingProduct?.name || !editingProduct?.price) return;

        const isNewProduct = !editingProduct.id;
        const method = isNewProduct ? 'POST' : 'PUT';

        const res = await fetch('/api/products', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingProduct),
        });

        if (res.ok) {
            // Fire and forget - don't wait for broadcast
            if (isNewProduct && notifyNewProduct) {
                fetch('/api/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'new_product',
                        productName: editingProduct.name,
                        productPrice: editingProduct.price
                    })
                }).catch(e => console.error('Broadcast error:', e));
            }

            alert(isNewProduct ? 'Thêm sản phẩm thành công!' : 'Cập nhật sản phẩm thành công!');
        }

        setIsModalOpen(false);
        setEditingProduct(null);
        setNotifyNewProduct(true);
        fetchProducts();
    };

    const handleAddStock = async () => {
        if (!currentProductId || !stockData) return;

        const res = await fetch('/api/inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: currentProductId, data: stockData }),
        });

        if (res.ok) {
            const result = await res.json();

            // Fire and forget - don't wait for broadcast
            if (notifyUsers && currentProductName) {
                fetch('/api/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'stock_added',
                        productName: currentProductName,
                        addedCount: result.count,
                        totalStock: result.totalStock || result.count
                    })
                }).catch(e => console.error('Broadcast error:', e));
            }

            alert(t('products.success_stock').replace('{count}', result.count));
            setIsStockModalOpen(false);
            setStockData('');
            setCurrentProductId(null);
            setCurrentProductName('');
            setNotifyUsers(true);
            fetchProducts();
        } else {
            alert(t('products.error_stock'));
        }
    };

    const openModal = (product?: Product) => {
        setEditingProduct(product || { type: 'stock' });
        setIsModalOpen(true);
    };

    const openStockModal = (product: Product) => {
        setCurrentProductId(product.id);
        setCurrentProductName(`${product.name} ${Number(product.price).toLocaleString('vi-VN')}đ`);
        setStockData('');
        setNotifyUsers(true);
        setIsStockModalOpen(true);
    };

    const openViewStockModal = async (product: Product) => {
        setCurrentProductId(product.id);
        setInventoryPage(1);
        setSelectedAccountIds(new Set());
        await fetchInventory(product.id, 1);
        setIsViewStockModalOpen(true);
    };

    const fetchInventory = async (productId: number, page: number) => {
        setInventoryLoading(true);
        const res = await fetch(`/api/inventory?productId=${productId}&page=${page}&limit=20`);
        const data = await res.json();
        setAccounts(data.accounts || []);
        setInventoryTotalPages(data.pagination?.totalPages || 1);
        setInventoryTotal(data.pagination?.total || 0);
        setInventoryLoading(false);
    };

    const handleInventoryPageChange = (newPage: number) => {
        if (!currentProductId) return;
        setInventoryPage(newPage);
        fetchInventory(currentProductId, newPage);
    };

    const handleDeleteAccount = async (accountId: number) => {
        if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return;
        const res = await fetch(`/api/inventory?accountId=${accountId}`, { method: 'DELETE' });
        if (res.ok) {
            setAccounts(prev => prev.filter(acc => acc.id !== accountId));
            setSelectedAccountIds(prev => {
                const next = new Set(prev);
                next.delete(accountId);
                return next;
            });
            setInventoryTotal(prev => prev - 1);
            fetchProducts();
        } else {
            alert('Lỗi khi xóa tài khoản!');
        }
    };

    const handleDeleteSelectedAccounts = async () => {
        if (selectedAccountIds.size === 0) return;
        if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedAccountIds.size} tài khoản đã chọn?`)) return;
        const ids = Array.from(selectedAccountIds).join(',');
        const res = await fetch(`/api/inventory?accountIds=${ids}`, { method: 'DELETE' });
        if (res.ok) {
            const result = await res.json();
            alert(`Đã xóa ${result.deletedCount} tài khoản!`);
            setSelectedAccountIds(new Set());
            if (currentProductId) {
                await fetchInventory(currentProductId, inventoryPage);
            }
            fetchProducts();
        } else {
            alert('Lỗi khi xóa tài khoản!');
        }
    };

    const toggleAccountSelection = (accountId: number) => {
        setSelectedAccountIds(prev => {
            const next = new Set(prev);
            if (next.has(accountId)) {
                next.delete(accountId);
            } else {
                next.add(accountId);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (accounts.every(acc => selectedAccountIds.has(acc.id))) {
            // Deselect all on current page
            setSelectedAccountIds(prev => {
                const next = new Set(prev);
                accounts.forEach(acc => next.delete(acc.id));
                return next;
            });
        } else {
            // Select all on current page
            setSelectedAccountIds(prev => {
                const next = new Set(prev);
                accounts.forEach(acc => next.add(acc.id));
                return next;
            });
        }
    };

    const handleDeleteAccountsByStatus = async (status: 'available' | 'sold' | 'all') => {
        if (!currentProductId) return;
        const statusLabel = status === 'all' ? 'tất cả' : (status === 'available' ? 'còn hàng' : 'đã bán');
        if (!confirm(`Bạn có chắc chắn muốn xóa ${statusLabel} tài khoản?`)) return;
        const res = await fetch(`/api/inventory?productId=${currentProductId}&status=${status}`, { method: 'DELETE' });
        if (res.ok) {
            const result = await res.json();
            alert(`Đã xóa ${result.deletedCount} tài khoản!`);
            setSelectedAccountIds(new Set());
            setInventoryPage(1);
            await fetchInventory(currentProductId, 1);
            fetchProducts();
        } else {
            alert('Lỗi khi xóa tài khoản!');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('products.title')}</h2>
                    <p className="text-muted-foreground">{t('products.subtitle')}</p>
                </div>
                <Button onClick={() => openModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t('products.new_product')}
                </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'products'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Package className="w-4 h-4 inline mr-2" />
                    {t('products.list')}
                </button>
                <button
                    onClick={() => setActiveTab('sold')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sold'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <User className="w-4 h-4 inline mr-2" />
                    Đã bán ({soldTotal})
                </button>
            </div>

            {activeTab === 'products' && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t('products.list')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('users.id')}</TableHead>
                                        <TableHead>{t('products.name')}</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>{t('products.price')}</TableHead>
                                        <TableHead>{t('products.type')}</TableHead>
                                        <TableHead>{t('products.stock')}</TableHead>
                                        <TableHead className="text-right">{t('products.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-24 text-center">{t('common.loading')}</TableCell>
                                        </TableRow>
                                    ) : (
                                        products.map((product) => (
                                            <TableRow key={product.id}>
                                                <TableCell>#{product.id}</TableCell>
                                                <TableCell className="font-medium">{product.name}</TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{product.code || '-'}</TableCell>
                                                <TableCell className="text-green-600 dark:text-green-400 font-bold">{formatCurrency(product.price)}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded text-xs ${product.type === 'order' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                        {product.type === 'order' ? t('products.manual') : t('products.auto')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-bold">{product.stock}</TableCell>
                                                <TableCell className="text-right flex justify-end gap-2">
                                                    <Button size="icon" variant="ghost" onClick={() => openViewStockModal(product)} title={t('products.view_accounts')}>
                                                        <List className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="text-green-600" onClick={() => openStockModal(product)} title={t('products.add_stock')}>
                                                        <Database className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="text-blue-600" onClick={() => openModal(product)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="text-red-600" onClick={() => handleDelete(product.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sold Accounts Tab */}
            {activeTab === 'sold' && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Tài khoản đã bán ({soldTotal})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Search */}
                        <div className="flex gap-2 mb-4">
                            <Input
                                placeholder="Tìm theo Telegram ID..."
                                value={searchTelegramId}
                                onChange={(e) => setSearchTelegramId(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearchSold()}
                                className="max-w-xs"
                            />
                            <Button onClick={handleSearchSold} variant="outline">
                                Tìm kiếm
                            </Button>
                            {searchTelegramId && (
                                <Button
                                    onClick={() => {
                                        setSearchTelegramId('');
                                        fetchSoldInventory(1, '');
                                    }}
                                    variant="ghost"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                        {soldLoading ? (
                            <div className="text-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                <p className="mt-2 text-muted-foreground">Đang tải...</p>
                            </div>
                        ) : soldAccounts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Chưa có tài khoản nào được bán</p>
                            </div>
                        ) : (
                            <>
                                <div className="max-h-[600px] overflow-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-[100px]">Mã HĐ</TableHead>
                                                <TableHead>Sản phẩm</TableHead>
                                                <TableHead>Tài khoản</TableHead>
                                                <TableHead className="w-[100px]">Giá</TableHead>
                                                <TableHead className="w-[120px]">Người mua</TableHead>
                                                <TableHead className="w-[100px]">Telegram ID</TableHead>
                                                <TableHead className="w-[140px]">Ngày bán</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {soldAccounts.map((item) => (
                                                <TableRow key={item.order_id}>
                                                    <TableCell>
                                                        <span className="text-xs font-mono text-muted-foreground">
                                                            {item.invoice_code || `#${item.order_id}`}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                                            {item.product_name}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded max-w-[200px] truncate block">
                                                            {item.account_data || '-'}
                                                        </code>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-green-600 dark:text-green-400 font-bold text-sm">
                                                            {formatCurrency(item.price)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                                                            <User className="w-3 h-3" />
                                                            {item.buyer_username || 'N/A'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs font-mono text-muted-foreground">
                                                            {item.buyer_telegram_id || '-'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatDate(item.sold_at)}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                {/* Pagination */}
                                {soldTotalPages > 1 && (
                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-sm text-muted-foreground">
                                            Trang {soldPage} / {soldTotalPages} (Tổng: {soldTotal})
                                        </span>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fetchSoldInventory(soldPage - 1, searchTelegramId)}
                                                disabled={soldPage <= 1}
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => fetchSoldInventory(soldPage + 1, searchTelegramId)}
                                                disabled={soldPage >= soldTotalPages}
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

            {/* Edit Product Modal */}
            <Dialog
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                title={editingProduct?.id ? t('products.edit') : t('products.new_product')}
            >
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('products.name')}</label>
                        <Input
                            value={editingProduct?.name || ''}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, name: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Code (tùy chọn)</label>
                        <Input
                            value={editingProduct?.code || ''}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, code: e.target.value || null }))}
                            placeholder="Mã code sản phẩm..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('products.price')} (VND)</label>
                        <Input
                            type="number"
                            value={editingProduct?.price || ''}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, price: Number(e.target.value) }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('products.type')}</label>
                        <select
                            value="stock"
                            disabled
                            className="flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm shadow-sm cursor-not-allowed opacity-70"
                        >
                            <option value="stock">Tự động (có kho)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('products.description')}</label>
                        <Textarea
                            value={editingProduct?.description || ''}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))}
                        />
                    </div>
                    {!editingProduct?.id && (
                        <div className="flex items-center gap-2 py-2">
                            <input
                                type="checkbox"
                                id="notifyNewProduct"
                                checked={notifyNewProduct}
                                onChange={(e) => setNotifyNewProduct(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-600"
                            />
                            <label htmlFor="notifyNewProduct" className="text-sm">
                                📢 Thông báo sản phẩm mới tới tất cả users
                            </label>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleSave}>{t('products.save')}</Button>
                    </div>
                </div>
            </Dialog>

            {/* Add Stock Modal */}
            <Dialog
                open={isStockModalOpen}
                onOpenChange={setIsStockModalOpen}
                title={t('products.add_stock_title')}
                description={t('products.add_stock_desc')}
            >
                <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                        <input
                            type="file"
                            accept=".txt"
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        const content = event.target?.result as string;
                                        setStockData(prev => prev ? prev + '\n' + content : content);
                                    };
                                    reader.readAsText(file);
                                }
                                e.target.value = ''; // Reset input
                            }}
                            className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                        />
                    </div>
                    <Textarea
                        value={stockData}
                        onChange={(e) => setStockData(e.target.value)}
                        className="h-64 font-mono text-sm"
                        placeholder={'username|password\nusername|password|2fa\nusername|password|mail_kp|2fa\nkey'}
                    />
                    <div className="text-right text-xs text-muted-foreground">
                        {stockData.split('\n').filter(l => l.trim()).length} accounts
                    </div>
                    <div className="flex items-center gap-2 py-2">
                        <input
                            type="checkbox"
                            id="notifyUsers"
                            checked={notifyUsers}
                            onChange={(e) => setNotifyUsers(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600"
                        />
                        <label htmlFor="notifyUsers" className="text-sm">
                            📢 Thông báo tới tất cả users
                        </label>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setIsStockModalOpen(false)}>{t('common.cancel')}</Button>
                        <Button onClick={handleAddStock} disabled={!stockData.trim()}>{t('products.add_stock')}</Button>
                    </div>
                </div>
            </Dialog>

            {/* View Stock Modal */}
            <Dialog
                open={isViewStockModalOpen}
                onOpenChange={setIsViewStockModalOpen}
                title={`${t('products.current_inventory')} (${inventoryTotal} tài khoản)`}
                className="max-w-2xl"
            >
                {/* Bulk delete buttons */}
                <div className="flex gap-2 mb-3 flex-wrap items-center">
                    {selectedAccountIds.size > 0 && (
                        <Button size="sm" variant="destructive" onClick={handleDeleteSelectedAccounts}>
                            <Trash2 className="w-3 h-3 mr-1" /> Xóa đã chọn ({selectedAccountIds.size})
                        </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20" onClick={() => handleDeleteAccountsByStatus('sold')}>
                        <Trash2 className="w-3 h-3 mr-1" /> Xóa đã bán
                    </Button>
                    <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 dark:border-orange-800 dark:hover:bg-orange-900/20" onClick={() => handleDeleteAccountsByStatus('available')}>
                        <Trash2 className="w-3 h-3 mr-1" /> Xóa còn hàng
                    </Button>
                    <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleDeleteAccountsByStatus('all')}>
                        <Trash2 className="w-3 h-3 mr-1" /> Xóa tất cả
                    </Button>
                </div>

                {/* Header with Select All */}
                {accounts.length > 0 && (
                    <div className="flex items-center gap-3 p-2 border-b bg-muted/30 rounded-t-md">
                        <input
                            type="checkbox"
                            checked={accounts.length > 0 && accounts.every(acc => selectedAccountIds.has(acc.id))}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-400 cursor-pointer"
                            title="Chọn tất cả trang này"
                        />
                        <span className="text-sm text-muted-foreground">Chọn tất cả trang này</span>
                    </div>
                )}

                <div className="max-h-[50vh] overflow-auto border rounded-b-md p-2 space-y-1 bg-muted/20">
                    {inventoryLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Đang tải...</div>
                    ) : accounts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('products.empty_inventory')}</div>
                    ) : (
                        accounts.map((acc, i) => (
                            <div
                                key={acc.id}
                                className={clsx(
                                    "flex items-center p-2 rounded border bg-card text-card-foreground group cursor-pointer transition-colors",
                                    selectedAccountIds.has(acc.id) && "bg-primary/10 border-primary/30"
                                )}
                                onClick={() => toggleAccountSelection(acc.id)}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedAccountIds.has(acc.id)}
                                    onChange={() => toggleAccountSelection(acc.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 rounded border-gray-400 mr-3 cursor-pointer"
                                />
                                <span className="font-mono text-sm text-muted-foreground w-12">#{(inventoryPage - 1) * 20 + i + 1}</span>
                                <code className="text-sm font-mono flex-1 truncate">{acc.username}</code>
                                <span className={clsx(
                                    "text-xs px-2 py-0.5 rounded-full capitalize mr-2",
                                    acc.status === 'available' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                    {acc.status}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc.id); }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600"
                                    title="Xóa tài khoản"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {inventoryTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-3">
                        <div className="text-sm text-muted-foreground">
                            Trang {inventoryPage} / {inventoryTotalPages}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleInventoryPageChange(inventoryPage - 1)}
                                disabled={inventoryPage <= 1 || inventoryLoading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleInventoryPageChange(inventoryPage + 1)}
                                disabled={inventoryPage >= inventoryTotalPages || inventoryLoading}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}

                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={() => setIsViewStockModalOpen(false)}>{t('products.close')}</Button>
                </div>
            </Dialog>
        </div>
    );
}
