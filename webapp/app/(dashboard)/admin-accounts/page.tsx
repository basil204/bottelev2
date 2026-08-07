'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Trash2, Edit, Plus, Shield, ShieldCheck } from 'lucide-react';

interface AdminAccount {
    id: number;
    fullname: string;
    username: string;
    telegram_id: string | null;
    role: 'super_admin' | 'admin';
}


export default function AdminAccountsPage() {
    const router = useRouter();
    const [adminRole, setAdminRole] = useState<string>('admin');
    const [accounts, setAccounts] = useState<AdminAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
    const [formData, setFormData] = useState({
        fullname: '',
        username: '',
        password: '',
        telegram_id: '',
        role: 'admin' as 'super_admin' | 'admin'
    });

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        // Read admin role from cookie
        const cookies = document.cookie.split(';');
        let role = 'admin';
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'admin_role') {
                role = value;
                break;
            }
        }
        setAdminRole(role);

        // Redirect if not super_admin
        if (role !== 'super_admin') {
            router.push('/settings');
            return;
        }

        fetchAccounts();
    }, [router]);

    const fetchAccounts = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin-accounts');
            if (res.ok) {
                const data = await res.json();
                setAccounts(data);
            }
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.username || (!editingAccount && !formData.password)) {
            setMessage({ type: 'error', text: 'Vui lòng điền đầy đủ thông tin' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            const url = editingAccount
                ? `/api/admin-accounts?id=${editingAccount.id}`
                : '/api/admin-accounts';

            const res = await fetch(url, {
                method: editingAccount ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                setMessage({ type: 'success', text: editingAccount ? 'Cập nhật thành công!' : 'Tạo tài khoản thành công!' });
                setShowDialog(false);
                setEditingAccount(null);
                setFormData({ fullname: '', username: '', password: '', telegram_id: '', role: 'admin' });
                fetchAccounts();

            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Có lỗi xảy ra' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Lỗi kết nối server' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        const reason = window.prompt('Nhập lý do xóa tài khoản này (bắt buộc):');
        if (reason === null) return; // Cancelled
        if (!reason.trim()) {
            alert('Bạn phải nhập lý do xóa!');
            return;
        }

        try {
            const res = await fetch(`/api/admin-accounts?id=${id}&reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Xóa tài khoản thành công!' });
                fetchAccounts();
            } else {
                const data = await res.json();
                setMessage({ type: 'error', text: data.error || 'Không thể xóa tài khoản' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Lỗi kết nối server' });
        }
    };


    const openEditDialog = (account: AdminAccount) => {
        setEditingAccount(account);
        setFormData({
            fullname: account.fullname,
            username: account.username,
            password: '',
            telegram_id: account.telegram_id || '',
            role: account.role
        });

        setShowDialog(true);
    };

    const openCreateDialog = () => {
        setEditingAccount(null);
        setFormData({ fullname: '', username: '', password: '', telegram_id: '', role: 'admin' });
        setShowDialog(true);
    };


    if (adminRole !== 'super_admin') {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="text-center">
                    <Shield className="w-16 h-16 mx-auto text-red-500 mb-4" />
                    <h2 className="text-xl font-bold text-red-500">Không có quyền truy cập</h2>
                    <p className="text-muted-foreground">Chỉ Super Admin mới có quyền quản lý tài khoản admin.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Quản lý tài khoản Admin</h2>
                    <p className="text-muted-foreground">Tạo và quản lý các tài khoản admin đăng nhập webapp</p>
                </div>
                <Button onClick={openCreateDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tạo tài khoản mới
                </Button>
            </div>

            {message && (
                <div className={`p-4 rounded-lg text-sm border ${message.type === 'success'
                    ? 'bg-green-100 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400'
                    : 'bg-red-100 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Danh sách tài khoản Admin</CardTitle>
                    <CardDescription>Tất cả các tài khoản có quyền đăng nhập vào trang quản trị</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Họ tên</TableHead>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Telegram ID</TableHead>
                                    <TableHead>Quyền hạn</TableHead>
                                    <TableHead className="text-right">Thao tác</TableHead>

                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">Đang tải...</TableCell>
                                    </TableRow>
                                ) : accounts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                            Chưa có tài khoản admin nào
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    accounts.map((account) => (
                                        <TableRow key={account.id}>
                                            <TableCell className="font-medium">{account.fullname || 'N/A'}</TableCell>
                                            <TableCell>{account.username}</TableCell>
                                            <TableCell className="font-mono text-sm">{account.telegram_id || '-'}</TableCell>
                                            <TableCell>

                                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${account.role === 'super_admin'
                                                    ? 'bg-emerald-500/20 text-emerald-700 border border-emerald-500'
                                                    : 'bg-emerald-500/20 text-emerald-700 border border-emerald-500'
                                                    }`}>
                                                    {account.role === 'super_admin' ? (
                                                        <><ShieldCheck className="w-3 h-3" /> Super Admin</>
                                                    ) : (
                                                        <><Shield className="w-3 h-3" /> Admin</>
                                                    )}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => openEditDialog(account)}>
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button size="sm" variant="destructive" onClick={() => handleDelete(account.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog
                open={showDialog}
                onOpenChange={(open) => !open && setShowDialog(false)}
                title={editingAccount ? 'Chỉnh sửa tài khoản' : 'Tạo tài khoản Admin mới'}
            >
                <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Họ tên</label>
                        <Input
                            value={formData.fullname}
                            onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                            placeholder="Nguyễn Văn A"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Username <span className="text-red-500">*</span></label>
                        <Input
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="admin"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Telegram ID <span className="text-muted-foreground text-xs">(để thống kê chi tiêu)</span></label>
                        <Input
                            value={formData.telegram_id}
                            onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
                            placeholder="123456789"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">
                            Password {!editingAccount && <span className="text-red-500">*</span>}
                            {editingAccount && <span className="text-muted-foreground text-xs">(để trống nếu không đổi)</span>}
                        </label>
                        <Input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="••••••••"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Quyền hạn</label>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant={formData.role === 'super_admin' ? 'default' : 'outline'}
                                onClick={() => setFormData({ ...formData, role: 'super_admin' })}
                                className="flex-1"
                            >
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                Super Admin
                            </Button>
                            <Button
                                type="button"
                                variant={formData.role === 'admin' ? 'default' : 'outline'}
                                onClick={() => setFormData({ ...formData, role: 'admin' })}
                                className="flex-1"
                            >
                                <Shield className="w-4 h-4 mr-2" />
                                Admin
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Super Admin: Full quyền, có thể quản lý tài khoản admin<br />
                            Admin: Không có quyền quản lý tài khoản admin
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={() => setShowDialog(false)}>Hủy</Button>
                        <Button onClick={handleSubmit} disabled={saving}>
                            {saving ? 'Đang lưu...' : (editingAccount ? 'Cập nhật' : 'Tạo tài khoản')}
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
