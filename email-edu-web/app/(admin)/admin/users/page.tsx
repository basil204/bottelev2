'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { RefreshCw, Mail, User, Calendar, Plus, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface UserData {
    id: number;
    username: string;
    name: string;
    role: string;
    email_quota: number;
    emails_created: number;
    created_at: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState('');

    // Form state
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newName, setNewName] = useState('');
    const [newQuota, setNewQuota] = useState('10');
    const [newRole, setNewRole] = useState('user');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/users');
            const data = await res.json();
            if (data.success) {
                setUsers(data.data);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const createUser = async () => {
        if (!newUsername || !newPassword) {
            setError('Username và password là bắt buộc');
            return;
        }

        try {
            setCreating(true);
            setError('');

            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: newUsername,
                    password: newPassword,
                    name: newName || newUsername,
                    role: newRole,
                    email_quota: parseInt(newQuota) || 10
                })
            });

            const data = await res.json();

            if (data.success) {
                setDialogOpen(false);
                setNewUsername('');
                setNewPassword('');
                setNewName('');
                setNewQuota('10');
                setNewRole('user');
                fetchUsers();
            } else {
                setError(data.error || 'Tạo user thất bại');
            }
        } catch (error) {
            setError('Đã xảy ra lỗi');
        } finally {
            setCreating(false);
        }
    };

    const updateQuota = async (userId: number, quota: number) => {
        try {
            const res = await fetch('/api/users', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, email_quota: quota })
            });
            const data = await res.json();
            if (data.success) {
                fetchUsers();
            }
        } catch (error) {
            console.error('Error updating quota:', error);
        }
    };

    const deleteUser = async (userId: number, username: string) => {
        if (!confirm(`Bạn có chắc muốn xóa user "${username}"?`)) return;

        try {
            const res = await fetch(`/api/users?id=${userId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                fetchUsers();
            }
        } catch (error) {
            console.error('Error deleting user:', error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold">Quản lý Users</h2>
                    <p className="text-muted-foreground">Xem và quản lý người dùng</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Tạo User mới
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Tạo User mới</DialogTitle>
                                <DialogDescription>Nhập thông tin để tạo tài khoản người dùng mới</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                {error && (
                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                                        {error}
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="username">Tên đăng nhập *</Label>
                                    <Input
                                        id="username"
                                        placeholder="Nhập tên đăng nhập"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="password">Mật khẩu *</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Nhập mật khẩu"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Tên hiển thị</Label>
                                    <Input
                                        id="name"
                                        placeholder="Nhập tên hiển thị"
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="quota">Email Quota</Label>
                                        <Input
                                            id="quota"
                                            type="number"
                                            min={0}
                                            value={newQuota}
                                            onChange={(e) => setNewQuota(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="role">Role</Label>
                                        <select
                                            id="role"
                                            className="w-full h-10 px-3 rounded-md border border-input bg-background"
                                            value={newRole}
                                            onChange={(e) => setNewRole(e.target.value)}
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                </div>
                                <Button
                                    className="w-full"
                                    onClick={createUser}
                                    disabled={creating}
                                >
                                    {creating ? 'Đang tạo...' : 'Tạo User'}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Button onClick={fetchUsers} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng Users</CardTitle>
                        <User className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{users.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tổng Emails đã tạo</CardTitle>
                        <Mail className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {users.reduce((sum, u) => sum + u.emails_created, 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Quota còn lại</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {users.reduce((sum, u) => sum + (u.email_quota - u.emails_created), 0)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Users Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Danh sách Users</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Đang tải...</div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Chưa có user nào
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Tên</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Emails đã tạo</TableHead>
                                    <TableHead>Quota</TableHead>
                                    <TableHead>Ngày tạo</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>{user.id}</TableCell>
                                        <TableCell className="font-mono text-sm">{user.username}</TableCell>
                                        <TableCell>{user.name}</TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin'
                                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </TableCell>
                                        <TableCell>{user.emails_created}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    className="w-20 h-8"
                                                    defaultValue={user.email_quota}
                                                    min={0}
                                                    onBlur={(e) => {
                                                        const newQuota = parseInt(e.target.value);
                                                        if (newQuota !== user.email_quota) {
                                                            updateQuota(user.id, newQuota);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {formatDate(user.created_at)}
                                        </TableCell>
                                        <TableCell>
                                            {user.role !== 'admin' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-100"
                                                    onClick={() => deleteUser(user.id, user.username)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
