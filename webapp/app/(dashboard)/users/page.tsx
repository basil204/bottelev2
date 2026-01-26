'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { Search, UserCog } from 'lucide-react';
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

import { useLanguage } from '@/contexts/LanguageContext';

export default function UsersPage() {
    const { t } = useLanguage();
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

    const fetchUsers = () => {
        setLoading(true);
        fetch(`/api/users?page=${page}&limit=10&search=${searchQuery}`)
            .then((res) => res.json())
            .then((data) => {
                setUsers(data.data);
                setTotalPages(data.pagination.totalPages);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchUsers();
    }, [page]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        fetchUsers();
    }

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
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <Input
                        type="text"
                        placeholder={t('users.search_placeholder')}
                        className="w-64"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <Button type="submit" variant="secondary">
                        <Search className="w-4 h-4" />
                    </Button>
                </form>
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
                                                {formatCurrency(user.balance)}
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
                </div>
            </Dialog>
        </div>
    );
}
