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

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
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
    }, [page]); // Search logic could be debounced here

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
            alert('Balance updated successfully!');
            setSelectedUser(null);
            setAmount('');
            setReason('');
            fetchUsers();
        } else {
            alert('Error updating balance!');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Users</h2>
                    <p className="text-muted-foreground">Manage user accounts and balances</p>
                </div>
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <Input
                        type="text"
                        placeholder="Search users..."
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
                    <CardTitle>User Directory</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Telegram ID</TableHead>
                                    <TableHead>Balance</TableHead>
                                    <TableHead>Joined Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
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
                                                    Manage
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
                title={`Manage Balance: ${selectedUser?.username}`}
            >
                <div className="space-y-4 pt-4">
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            className="flex-1"
                            variant={actionType === 'add' ? 'default' : 'outline'}
                            onClick={() => setActionType('add')}
                        >
                            Add (+ )
                        </Button>
                        <Button
                            type="button"
                            className="flex-1"
                            variant={actionType === 'subtract' ? 'destructive' : 'outline'}
                            onClick={() => setActionType('subtract')}
                        >
                            Subtract (-)
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Amount (VND)</label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Enter amount..."
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Reason</label>
                        <Textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Optional reason..."
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setSelectedUser(null)}>Cancel</Button>
                        <Button
                            onClick={handleBalanceUpdate}
                            variant={actionType === 'add' ? 'default' : 'destructive'}
                        >
                            Confirm {actionType === 'add' ? 'Credit' : 'Debit'}
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
