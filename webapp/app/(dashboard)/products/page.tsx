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
    type: 'auto' | 'manual';
}

interface Account {
    id: number;
    username: string;
    status: string;
    created_at: string;
}

export default function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([]);
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
        if (!confirm('Are you sure you want to delete this product?')) return;
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
            alert(`Successfully added ${result.count} accounts!`);
            setIsStockModalOpen(false);
            setStockData('');
            setCurrentProductId(null);
            fetchProducts();
        } else {
            alert('Error adding accounts!');
        }
    };

    const openModal = (product?: Product) => {
        setEditingProduct(product || { type: 'auto' });
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
                    <h2 className="text-3xl font-bold tracking-tight">Products</h2>
                    <p className="text-muted-foreground">Manage digital products and inventory</p>
                </div>
                <Button onClick={() => openModal()}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Product
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Product List</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Price</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((product) => (
                                        <TableRow key={product.id}>
                                            <TableCell>#{product.id}</TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell className="text-green-600 dark:text-green-400 font-bold">{formatCurrency(product.price)}</TableCell>
                                            <TableCell>
                                                <span className={`px-2 py-1 rounded text-xs ${product.type === 'auto' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                                                    {product.type.toUpperCase()}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-bold">{product.stock}</TableCell>
                                            <TableCell className="text-right flex justify-end gap-2">
                                                <Button size="icon" variant="ghost" onClick={() => openViewStockModal(product)} title="View Accounts">
                                                    <List className="w-4 h-4" />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="text-green-600" onClick={() => openStockModal(product)} title="Add Stock">
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
                title={editingProduct?.id ? 'Edit Product' : 'Add New Product'}
            >
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Product Name</label>
                        <Input
                            value={editingProduct?.name || ''}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, name: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Price (VND)</label>
                        <Input
                            type="number"
                            value={editingProduct?.price || ''}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, price: Number(e.target.value) }))}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <select
                            value={editingProduct?.type || 'auto'}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, type: e.target.value as 'auto' | 'manual' }))}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <option value="auto">Auto (Automatic Delivery)</option>
                            <option value="manual">Manual (Hand Delivery)</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                            value={editingProduct?.description || ''}
                            onChange={(e) => setEditingProduct(prev => ({ ...prev!, description: e.target.value }))}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave}>Save Changes</Button>
                    </div>
                </div>
            </Dialog>

            {/* Add Stock Modal */}
            <Dialog
                open={isStockModalOpen}
                onOpenChange={setIsStockModalOpen}
                title="Add Stock"
                description="Enter accounts one per line (format: user|pass)"
            >
                <div className="space-y-4 pt-2">
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
                        <Button variant="outline" onClick={() => setIsStockModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleAddStock} disabled={!stockData.trim()}>Add to Inventory</Button>
                    </div>
                </div>
            </Dialog>

            {/* View Stock Modal */}
            <Dialog
                open={isViewStockModalOpen}
                onOpenChange={setIsViewStockModalOpen}
                title="Current Inventory"
                className="max-w-2xl"
            >
                <div className="max-h-[60vh] overflow-auto border rounded-md p-2 space-y-2 bg-muted/20">
                    {accounts.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Empty Inventory</div>
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
                    <Button variant="outline" onClick={() => setIsViewStockModalOpen(false)}>Close</Button>
                </div>
            </Dialog>
        </div>
    );
}
