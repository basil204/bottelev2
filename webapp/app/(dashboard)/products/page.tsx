'use client';

import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Plus, Edit, Trash2, Database, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog } from '@/components/ui/dialog';

interface Product {
    id: number;
    name: string;
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
    const [accounts, setAccounts] = useState<Account[]>([]);

    const fetchProducts = () => {
        setLoading(true);
        fetch('/api/products')
            .then((res) => res.json())
            .then((data) => {
                setProducts(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleDelete = async (id: number) => {
        if (!confirm(t('products.delete_confirm'))) return;
        await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
        fetchProducts();
    };

    const handleSave = async () => {
        if (!editingProduct?.name || !editingProduct?.price) return;

        const method = editingProduct.id ? 'PUT' : 'POST';
        await fetch('/api/products', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingProduct),
        });

        setIsModalOpen(false);
        setEditingProduct(null);
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
            alert(t('products.success_stock').replace('{count}', result.count));
            setIsStockModalOpen(false);
            setStockData('');
            setCurrentProductId(null);
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
        setStockData('');
        setIsStockModalOpen(true);
    };

    const openViewStockModal = async (product: Product) => {
        setCurrentProductId(product.id);
        const res = await fetch(`/api/inventory?productId=${product.id}`);
        const data = await res.json();
        setAccounts(data.accounts || []);
        setIsViewStockModalOpen(true);
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
                                    <TableHead>{t('products.price')}</TableHead>
                                    <TableHead>{t('products.type')}</TableHead>
                                    <TableHead>{t('products.stock')}</TableHead>
                                    <TableHead className="text-right">{t('products.actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">{t('common.loading')}</TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell>#{product.id}</TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
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
                        placeholder={'username|password\nuser2|pass2'}
                    />
                    <div className="text-right text-xs text-muted-foreground">
                        {stockData.split('\n').filter(l => l.trim()).length} accounts
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
                title={t('products.current_inventory')}
                className="max-w-2xl"
            >
                <div className="max-h-[60vh] overflow-auto border rounded-md p-2 space-y-2 bg-muted/20">
                    {accounts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">{t('products.empty_inventory')}</div>
                    ) : (
                        accounts.map((acc, i) => (
                            <div key={acc.id} className="flex items-center justify-between p-2 rounded border bg-card text-card-foreground">
                                <span className="font-mono text-sm text-muted-foreground">#{i + 1}</span>
                                <code className="text-sm font-mono flex-1 mx-4 truncate">{acc.username}</code>
                                <span className={clsx(
                                    "text-xs px-2 py-0.5 rounded-full capitalize",
                                    acc.status === 'available' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                )}>
                                    {acc.status}
                                </span>
                            </div>
                        ))
                    )}
                </div>
                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={() => setIsViewStockModalOpen(false)}>{t('products.close')}</Button>
                </div>
            </Dialog>
        </div>
    );
}
