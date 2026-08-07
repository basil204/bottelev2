'use client';

import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { Plus, Minus, Edit, Trash2, Database, List, X, ChevronLeft, ChevronRight, User, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface Product {
    id: number;
    name: string;
    code: string | null;
    price: number;
    description: string;
    stock: number;
    sold_count: number;
    type: 'stock' | 'order';
    priority: number;
    check_live: number;
    category_id?: number | null;
    category_name?: string | null;
}

interface Account {
    id: number;
    username: string;
    password?: string | null;
    extra_data?: string | null;
    twofa?: string | null;
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
    const { formatPrice } = useCurrency();
    const [products, setProducts] = useState<Product[]>([]);
    const [categoriesList, setCategoriesList] = useState<{ id: number; name: string }[]>([]);
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
    const [savingSoldId, setSavingSoldId] = useState<number | null>(null);
    const [savingProduct, setSavingProduct] = useState(false);
    const [productFormError, setProductFormError] = useState('');

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

    const updateSoldCount = async (product: Product, nextValue: number) => {
        const soldCount = Math.max(0, Math.trunc(nextValue));
        setSavingSoldId(product.id);
        setProducts(current => current.map(item => item.id === product.id ? { ...item, sold_count: soldCount } : item));
        try {
            const response = await fetch('/api/products', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: product.id, sold_count: soldCount }),
            });
            if (!response.ok) throw new Error('Không thể cập nhật số lượng đã bán');
        } catch (error) {
            alert(error instanceof Error ? error.message : 'Không thể cập nhật số lượng đã bán');
            fetchProducts();
        } finally {
            setSavingSoldId(null);
        }
    };

    const fetchCategories = () => {
        fetch('/api/categories')
            .then((res) => res.json())
            .then((data) => setCategoriesList(Array.isArray(data) ? data : []))
            .catch(() => setCategoriesList([]));
    };

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    const handleDelete = async (id: number) => {
        const reason = window.prompt(t('products.delete_reason_prompt') || 'Nhập lý do xóa sản phẩm này (bắt buộc):');
        if (reason === null) return;
        if (!reason.trim()) {
            alert('Bạn phải nhập lý do xóa!');
            return;
        }

        const res = await fetch(`/api/products?id=${id}&reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
        if (res.ok) {
            fetchProducts();
        } else {
            const data = await res.json();
            alert(data.error || 'Lỗi khi xóa sản phẩm');
        }
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
        if (!editingProduct?.name?.trim()) {
            setProductFormError('Vui lòng nhập tên sản phẩm.');
            return;
        }
        if (!Number.isFinite(Number(editingProduct.price)) || Number(editingProduct.price) <= 0) {
            setProductFormError('Giá sản phẩm phải lớn hơn 0.');
            return;
        }
        setSavingProduct(true);
        setProductFormError('');

        const isNewProduct = !editingProduct.id;
        const method = isNewProduct ? 'POST' : 'PUT';

        const res = await fetch('/api/products', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingProduct),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            setProductFormError(errorData.error || 'Không thể lưu sản phẩm.');
            setSavingProduct(false);
            return;
        }

        if (res.ok) {
            const data = await res.json();
            // Fire and forget - don't wait for broadcast
            if (isNewProduct && notifyNewProduct) {
                fetch('/api/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'new_product',
                        productId: data.id,
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
        setSavingProduct(false);
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

            // Fire and forget - chỉ thông báo khi có account mới được thêm
            if (notifyUsers && currentProductName && result.count > 0) {
                fetch('/api/broadcast', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'stock_added',
                        productId: currentProductId,
                        productName: currentProductName,
                        addedCount: result.count,
                        totalStock: result.totalStock || result.count
                    })
                }).catch(e => console.error('Broadcast error:', e));
            }

            // Hiển thị thông báo chi tiết
            let msg = '';
            if (result.count > 0) {
                msg += t('products.success_stock').replace('{count}', result.count);
            }
            if (result.skipped > 0) {
                msg += `\nBỏ qua ${result.skipped} tài khoản đã tồn tại.`;
            }
            if (result.count === 0 && result.skipped > 0) {
                msg = `Tất cả ${result.skipped} tài khoản đều đã tồn tại. Không có tài khoản mới được thêm.`;
            }

            alert(msg);
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
        setProductFormError('');
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
        const reason = window.prompt('Nhập lý do xóa tài khoản này (bắt buộc):');
        if (reason === null) return;
        if (!reason.trim()) {
            alert('Bạn phải nhập lý do xóa!');
            return;
        }

        const res = await fetch(`/api/inventory?accountId=${accountId}&reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
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
            const data = await res.json();
            alert(data.error || 'Lỗi khi xóa tài khoản!');
        }
    };


    const handleDeleteSelectedAccounts = async () => {
        if (selectedAccountIds.size === 0) return;

        const reason = window.prompt(`Nhập lý do xóa ${selectedAccountIds.size} tài khoản đã chọn (bắt buộc):`);
        if (reason === null) return;
        if (!reason.trim()) {
            alert('Bạn phải nhập lý do xóa!');
            return;
        }

        const ids = Array.from(selectedAccountIds).join(',');
        const res = await fetch(`/api/inventory?accountIds=${ids}&reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
        if (res.ok) {
            const result = await res.json();
            alert(`Đã xóa ${result.deletedCount} tài khoản!`);
            setSelectedAccountIds(new Set());
            if (currentProductId) {
                await fetchInventory(currentProductId, inventoryPage);
            }
            fetchProducts();
        } else {
            const data = await res.json();
            alert(data.error || 'Lỗi khi xóa tài khoản!');
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

        const reason = window.prompt(`Nhập lý do xóa ${statusLabel} tài khoản (bắt buộc):`);
        if (reason === null) return;
        if (!reason.trim()) {
            alert('Bạn phải nhập lý do xóa!');
            return;
        }

        const res = await fetch(`/api/inventory?productId=${currentProductId}&status=${status}&reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
        if (res.ok) {
            const result = await res.json();
            alert(`Đã xóa ${result.deletedCount} tài khoản!`);
            setSelectedAccountIds(new Set());
            setInventoryPage(1);
            await fetchInventory(currentProductId, 1);
            fetchProducts();
        } else {
            const data = await res.json();
            alert(data.error || 'Lỗi khi xóa tài khoản!');
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
                                        <TableHead>Thư mục</TableHead>
                                        <TableHead>{t('products.name')}</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>{t('products.price')}</TableHead>
                                        <TableHead>{t('products.type')}</TableHead>
                                        <TableHead>{t('products.stock')}</TableHead>
                                        <TableHead>Đã bán</TableHead>
                                        <TableHead>Ưu tiên</TableHead>
                                        <TableHead>Check Live</TableHead>
                                        <TableHead className="text-right">{t('products.actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={11} className="h-24 text-center">{t('common.loading')}</TableCell>
                                        </TableRow>
                                    ) : (
                                        products.map((product) => (
                                            <TableRow key={product.id}>
                                                <TableCell>#{product.id}</TableCell>
                                                <TableCell>
                                                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-800 dark:bg-slate-850 dark:text-zinc-800 text-xs font-semibold">
                                                        {product.category_name || 'Khác'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-medium">{product.name}</TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{product.code || '-'}</TableCell>
                                                <TableCell className="text-green-600 dark:text-green-400 font-bold">{formatPrice(product.price)}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded text-xs ${product.type === 'order' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-700' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-700'}`}>
                                                        {product.type === 'order' ? t('products.manual') : t('products.auto')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-bold">{product.stock}</TableCell>
                                                <TableCell>
                                                    <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateSoldCount(product, Number(product.sold_count || 0) - 1)}
                                                            disabled={savingSoldId === product.id || Number(product.sold_count || 0) <= 0}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white hover:text-zinc-900 disabled:opacity-35"
                                                            aria-label="Giảm số đã bán"
                                                        ><Minus className="h-3.5 w-3.5" /></button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={Number(product.sold_count || 0)}
                                                            onChange={(event) => setProducts(current => current.map(item => item.id === product.id ? { ...item, sold_count: Math.max(0, Number(event.target.value)) } : item))}
                                                            onBlur={(event) => updateSoldCount(product, Number(event.target.value))}
                                                            className="h-7 w-14 border-0 bg-transparent p-0 text-center text-sm font-semibold text-zinc-900 shadow-none focus:ring-0"
                                                            aria-label={`Số lượng đã bán của ${product.name}`}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => updateSoldCount(product, Number(product.sold_count || 0) + 1)}
                                                            disabled={savingSoldId === product.id}
                                                            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-white hover:text-emerald-700 disabled:opacity-35"
                                                            aria-label="Tăng số đã bán"
                                                        ><Plus className="h-3.5 w-3.5" /></button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-900 text-white text-xs font-mono">
                                                        {product.priority || 0}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded text-xs bg-slate-900 text-white ${product.check_live ? '' : 'opacity-60'}`}>
                                                        {product.check_live ? 'Bật' : 'Tắt'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right flex justify-end gap-2">
                                                    <Button size="icon" variant="ghost" onClick={() => openViewStockModal(product)} title={t('products.view_accounts')}>
                                                        <List className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="text-green-600" onClick={() => openStockModal(product)} title={t('products.add_stock')}>
                                                        <Database className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="text-emerald-600" onClick={() => openModal(product)}>
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
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-700">
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
                                                            {formatPrice(item.price)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-700">
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

            {/* Product form */}
            <Dialog
                open={isModalOpen}
                onOpenChange={(open) => {
                    if (savingProduct) return;
                    setIsModalOpen(open);
                    if (!open) {
                        setEditingProduct(null);
                        setProductFormError('');
                    }
                }}
                title={editingProduct?.id ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
                description="Thiết lập thông tin bán hàng, cách kiểm tra và thông báo cho khách."
                className="max-w-2xl self-start"
            >
                <div className="space-y-6 pt-2">
                    {productFormError && (
                        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {productFormError}
                        </div>
                    )}

                    <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="product-name">Tên sản phẩm <span className="text-red-500">*</span></Label>
                            <Input
                                id="product-name"
                                value={editingProduct?.name || ''}
                                onChange={(e) => setEditingProduct(prev => ({ ...prev!, name: e.target.value }))}
                                placeholder="Ví dụ: Gmail EDU 1 năm"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="product-category">Thư mục</Label>
                            <select
                                id="product-category"
                                value={editingProduct?.category_id || ''}
                                onChange={(e) => setEditingProduct(prev => ({ ...prev!, category_id: Number(e.target.value) || null }))}
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            >
                                <option value="">Chưa phân loại</option>
                                {categoriesList.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="product-code">Mã sản phẩm</Label>
                            <Input
                                id="product-code"
                                value={editingProduct?.code || ''}
                                onChange={(e) => setEditingProduct(prev => ({ ...prev!, code: e.target.value || null }))}
                                placeholder="Tùy chọn"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="product-price">Giá bán (VND) <span className="text-red-500">*</span></Label>
                            <Input
                                id="product-price"
                                type="number"
                                min="0"
                                step="1000"
                                value={editingProduct?.price ?? ''}
                                onChange={(e) => setEditingProduct(prev => ({ ...prev!, price: Number(e.target.value) }))}
                                placeholder="100000"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="product-priority">Độ ưu tiên</Label>
                            <Input
                                id="product-priority"
                                type="number"
                                min="0"
                                value={editingProduct?.priority ?? 0}
                                onChange={(e) => setEditingProduct(prev => ({ ...prev!, priority: Number(e.target.value) }))}
                            />
                            <p className="text-xs text-slate-500">Số lớn hơn sẽ được hiển thị trước.</p>
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                            <Label htmlFor="product-description">Mô tả</Label>
                            <Textarea
                                id="product-description"
                                rows={4}
                                value={editingProduct?.description || ''}
                                onChange={(e) => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))}
                                placeholder="Thông tin khách hàng cần biết trước khi mua..."
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                            <div>
                                <Label htmlFor="product-check-live" className="cursor-pointer">Kiểm tra trước khi bán</Label>
                                <p className="mt-1 text-xs leading-5 text-slate-500">Chỉ giao tài khoản còn hoạt động.</p>
                            </div>
                            <Switch
                                id="product-check-live"
                                checked={editingProduct?.check_live === 1}
                                onCheckedChange={(checked) => setEditingProduct(prev => ({ ...prev!, check_live: checked ? 1 : 0 }))}
                            />
                        </div>

                        {!editingProduct?.id && (
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                                <div>
                                    <Label htmlFor="product-notify" className="cursor-pointer">Thông báo khách hàng</Label>
                                    <p className="mt-1 text-xs leading-5 text-slate-500">Gửi thông báo sau khi tạo sản phẩm.</p>
                                </div>
                                <Switch id="product-notify" checked={notifyNewProduct} onCheckedChange={setNotifyNewProduct} />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                        <Button variant="outline" disabled={savingProduct} onClick={() => setIsModalOpen(false)}>
                            Hủy
                        </Button>
                        <Button disabled={savingProduct} onClick={handleSave} className="min-w-32">
                            {savingProduct ? 'Đang lưu...' : editingProduct?.id ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* Legacy product form kept unmounted during migration */}
            <Dialog
                open={false}
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
                        <label className="text-sm font-medium">Thư mục (Category)</label>
                        <select
                            value={editingProduct?.category_id || ''}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, category_id: Number(e.target.value) || null }))}
                            className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="">-- Chọn thư mục --</option>
                            {categoriesList.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
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
                        <label className="text-sm font-medium">Độ ưu tiên (Cao hơn hiện trước)</label>
                        <Input
                            type="number"
                            value={editingProduct?.priority ?? 0}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, priority: Number(e.target.value) }))}
                            placeholder="0"
                        />
                    </div>
                    <div className="flex items-center space-x-2 py-2">
                        <input
                            type="checkbox"
                            id="check_live"
                            checked={editingProduct?.check_live === 1}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, check_live: e.target.checked ? 1 : 0 }))}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label htmlFor="check_live" className="text-sm font-medium cursor-pointer">
                            Check Live trước khi bán
                        </label>
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
                                <code className="text-sm font-mono flex-1 truncate select-all" title={`${acc.username}${acc.password ? `|${acc.password}` : ''}${acc.extra_data ? `|${acc.extra_data}` : ''}${acc.twofa ? `|${acc.twofa}` : ''}`}>
                                    {acc.username}
                                    {acc.password ? `|${acc.password}` : ''}
                                    {acc.extra_data ? `|${acc.extra_data}` : ''}
                                    {acc.twofa ? `|${acc.twofa}` : ''}
                                </code>
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
