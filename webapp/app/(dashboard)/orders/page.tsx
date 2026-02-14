'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';
import { clsx } from 'clsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ShoppingCart } from 'lucide-react';

interface Order {
    id: number;
    user_id: number;
    username: string;
    product_name: string;
    price: number;
    status: 'pending' | 'completed';
    created_at: string;
}

import { useLanguage } from '@/contexts/LanguageContext';

export default function OrdersPage() {
    const { t } = useLanguage();
    const { formatPrice } = useCurrency();
    const [orders, setOrders] = useState<Order[]>([]);
    // ... (state)
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/orders?page=${page}&limit=10`)
            .then((res) => res.json())
            .then((data) => {
                setOrders(Array.isArray(data.data) ? data.data : []);
                setTotalPages(data.pagination?.totalPages || 1);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setOrders([]);
                setTotalPages(1);
                setLoading(false);
            });
    }, [page]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('orders.title')}</h2>
                    <p className="text-muted-foreground">{t('orders.subtitle')}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-primary" />
                        {t('orders.latest')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[100px]">{t('orders.id')}</TableHead>
                                    <TableHead>{t('orders.user')}</TableHead>
                                    <TableHead>{t('orders.product')}</TableHead>
                                    <TableHead>{t('orders.price')}</TableHead>
                                    <TableHead>{t('orders.status')}</TableHead>
                                    <TableHead className="text-right">{t('orders.date')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            {t('common.loading')}
                                        </TableCell>
                                    </TableRow>
                                ) : orders.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            {t('orders.no_orders')}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    orders.map((order) => (
                                        <TableRow key={order.id}>
                                            <TableCell className="font-medium">#{order.id}</TableCell>
                                            <TableCell>{order.username || `User #${order.user_id}`}</TableCell>
                                            <TableCell className="text-blue-600 dark:text-blue-400 font-medium">
                                                {order.product_name || 'N/A'}
                                            </TableCell>
                                            <TableCell>{formatPrice(order.price)}</TableCell>
                                            <TableCell>
                                                <span
                                                    className={clsx(
                                                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                                                        order.status === 'completed'
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                    )}
                                                >
                                                    {order.status === 'completed' ? t('orders.completed') : t('orders.pending')}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {formatDate(order.created_at)}
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
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || loading}
                        >
                            Next
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
