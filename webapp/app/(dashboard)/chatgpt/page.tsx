"use client";

import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Bot,
    Users,
    Wallet,
    Plus,
    Trash2,
    Edit,
    RefreshCw,
    Clock,
    Settings
} from "lucide-react";
import { useCurrency } from '@/hooks/useCurrency';

interface Fam {
    id: number;
    name: string;
    workspace_id: string;
    authorization: string;
    max_slots: number;
    used_slots: number;
    active_rentals: number;
    status: 'active' | 'full' | 'inactive';
    created_at: string;
}

interface Rental {
    id: number;
    user_id: number;
    fam_id: number;
    email: string;
    price: number;
    start_date: string;
    end_date: string;
    status: 'active' | 'expired' | 'cancelled';
    invite_status: string;
    fam_name: string;
    telegram_id: number;
    username: string;
}

interface SettingsType {
    slot_price: number;
    slot_days: number;
}

interface Stats {
    totalFams: number;
    activeFams: number;
    totalSlots: number;
    usedSlots: number;
    availableSlots: number;
    activeRentals: number;
    totalRevenue: number;
}

export default function ChatGPTPage() {
    const { formatPrice } = useCurrency();
    const [fams, setFams] = useState<Fam[]>([]);
    const [rentals, setRentals] = useState<Rental[]>([]);
    const [settings, setSettings] = useState<SettingsType>({ slot_price: 60000, slot_days: 30 });
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'fams' | 'rentals' | 'settings'>('fams');

    // Form states
    const [showAddFam, setShowAddFam] = useState(false);
    const [editingFam, setEditingFam] = useState<Fam | null>(null);
    const [newFam, setNewFam] = useState({ name: '', workspace_id: '', authorization: '', max_slots: 5 });
    const [newSettings, setNewSettings] = useState({ slot_price: 60000, slot_days: 30 });

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/chatgpt');
            const data = await res.json();
            if (data.success) {
                setFams(data.fams || []);
                setRentals(data.rentals || []);
                setSettings(data.settings || { slot_price: 60000, slot_days: 30 });
                setNewSettings(data.settings || { slot_price: 60000, slot_days: 30 });
                setStats(data.stats || null);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAddFam = async () => {
        try {
            const res = await fetch('/api/chatgpt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newFam)
            });
            const data = await res.json();
            if (data.success) {
                setShowAddFam(false);
                setNewFam({ name: '', workspace_id: '', authorization: '', max_slots: 5 });
                fetchData();
            } else {
                alert(data.error || 'Failed to add FAM');
            }
        } catch (error) {
            console.error('Error adding FAM:', error);
        }
    };

    const handleUpdateFam = async () => {
        if (!editingFam) return;
        try {
            const res = await fetch('/api/chatgpt', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: editingFam.id,
                    name: editingFam.name,
                    authorization: editingFam.authorization,
                    status: editingFam.status
                })
            });
            const data = await res.json();
            if (data.success) {
                setEditingFam(null);
                fetchData();
            }
        } catch (error) {
            console.error('Error updating FAM:', error);
        }
    };

    const handleDeleteFam = async (id: number) => {
        if (!confirm('Bạn có chắc muốn xóa FAM này?')) return;
        try {
            const res = await fetch(`/api/chatgpt?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchData();
            } else {
                alert(data.error || 'Failed to delete FAM');
            }
        } catch (error) {
            console.error('Error deleting FAM:', error);
        }
    };

    const handleCancelRental = async (id: number) => {
        if (!confirm('Bạn có chắc muốn hủy rental này?')) return;
        try {
            const res = await fetch(`/api/chatgpt/rentals?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchData();
            }
        } catch (error) {
            console.error('Error cancelling rental:', error);
        }
    };

    const handleUpdateSettings = async () => {
        try {
            const res = await fetch('/api/chatgpt/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            const data = await res.json();
            if (data.success) {
                setSettings(newSettings);
                alert('Đã lưu cài đặt!');
            }
        } catch (error) {
            console.error('Error updating settings:', error);
        }
    };



    const getDaysRemaining = (endDate: string) => {
        const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <Badge className="bg-green-500 text-white">Hoạt động</Badge>;
            case 'full': return <Badge className="bg-yellow-500 text-white">Đầy slot</Badge>;
            case 'inactive': return <Badge className="bg-gray-500 text-white">Không hoạt động</Badge>;
            case 'expired': return <Badge className="bg-red-500 text-white">Hết hạn</Badge>;
            case 'cancelled': return <Badge className="bg-gray-500 text-white">Đã hủy</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">🤖 ChatGPT Team Management</h1>
                <Button onClick={fetchData} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                </Button>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Tổng FAM</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.totalFams}</div>
                            <p className="text-xs text-muted-foreground">{stats.activeFams} hoạt động</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Slots</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.usedSlots}/{stats.totalSlots}</div>
                            <p className="text-xs text-muted-foreground">{stats.availableSlots} trống</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Đang thuê</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.activeRentals}</div>
                            <p className="text-xs text-muted-foreground">rentals active</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Doanh thu</CardTitle>
                        </CardHeader>
                        <CardContent>
                            Hiện tại: {formatPrice(settings.slot_price)}
                            <p className="text-xs text-muted-foreground">từ rentals</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2">
                <Button
                    variant={activeTab === 'fams' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('fams')}
                >
                    <Bot className="h-4 w-4 mr-2" />
                    FAM ({fams.length})
                </Button>
                <Button
                    variant={activeTab === 'rentals' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('rentals')}
                >
                    <Users className="h-4 w-4 mr-2" />
                    Rentals ({rentals.filter(r => r.status === 'active').length})
                </Button>
                <Button
                    variant={activeTab === 'settings' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('settings')}
                >
                    <Settings className="h-4 w-4 mr-2" />
                    Cài đặt giá
                </Button>
            </div>

            {/* FAM Tab */}
            {activeTab === 'fams' && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Danh sách FAM</CardTitle>
                            <CardDescription>Quản lý các workspace ChatGPT Team</CardDescription>
                        </div>
                        <Button onClick={() => setShowAddFam(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Thêm FAM
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Tên</TableHead>
                                    <TableHead>Workspace ID</TableHead>
                                    <TableHead>Slots</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fams.map((fam) => (
                                    <TableRow key={fam.id}>
                                        <TableCell>{fam.id}</TableCell>
                                        <TableCell className="font-medium">{fam.name}</TableCell>
                                        <TableCell className="font-mono text-xs">{fam.workspace_id.substring(0, 20)}...</TableCell>
                                        <TableCell>
                                            <span className={fam.active_rentals >= fam.max_slots - 1 ? 'text-red-500' : 'text-green-500'}>
                                                {fam.active_rentals}/{fam.max_slots - 1}
                                            </span>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(fam.status)}</TableCell>
                                        <TableCell>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setEditingFam(fam)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDeleteFam(fam.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {fams.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                                            Chưa có FAM nào. Nhấn "Thêm FAM" để bắt đầu.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Rentals Tab */}
            {activeTab === 'rentals' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Danh sách email đang thuê</CardTitle>
                        <CardDescription>Quản lý các slot đã cho thuê</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>FAM</TableHead>
                                    <TableHead>Giá</TableHead>
                                    <TableHead>Còn lại</TableHead>
                                    <TableHead>Trạng thái</TableHead>
                                    <TableHead>Thao tác</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rentals.map((rental) => (
                                    <TableRow key={rental.id}>
                                        <TableCell>{rental.id}</TableCell>
                                        <TableCell className="font-mono text-sm">{rental.email}</TableCell>
                                        <TableCell>
                                            {rental.username || rental.telegram_id}
                                        </TableCell>
                                        <TableCell>{rental.fam_name}</TableCell>
                                        <TableCell>{formatPrice(rental.price)}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-4 w-4" />
                                                {getDaysRemaining(rental.end_date)} ngày
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(rental.status)}</TableCell>
                                        <TableCell>
                                            {rental.status === 'active' && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleCancelRental(rental.id)}
                                                >
                                                    Hủy
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {rentals.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                                            Chưa có rental nào.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Cài đặt giá slot</CardTitle>
                        <CardDescription>Điều chỉnh giá và thời hạn thuê</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 max-w-md">
                        <div>
                            <Label>Giá mỗi slot (VND)</Label>
                            <Input
                                type="number"
                                value={newSettings.slot_price}
                                onChange={(e) => setNewSettings({ ...newSettings, slot_price: parseInt(e.target.value) || 0 })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Hiện tại: {formatPrice(settings.slot_price)}
                            </p>
                        </div>
                        <div>
                            <Label>Số ngày thuê</Label>
                            <Input
                                type="number"
                                min={1}
                                value={newSettings.slot_days}
                                onChange={(e) => setNewSettings({ ...newSettings, slot_days: parseInt(e.target.value) || 30 })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Hiện tại: {settings.slot_days} ngày
                            </p>
                        </div>
                        <Button onClick={handleUpdateSettings}>
                            <Wallet className="h-4 w-4 mr-2" />
                            Lưu cài đặt
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Add FAM Dialog */}
            <Dialog
                open={showAddFam}
                onOpenChange={setShowAddFam}
                title="Thêm FAM mới"
                description="Nhập thông tin workspace ChatGPT Team"
            >
                <div className="space-y-4">
                    <div>
                        <Label>Tên FAM</Label>
                        <Input
                            placeholder="VD: FAM 1"
                            value={newFam.name}
                            onChange={(e) => setNewFam({ ...newFam, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <Label>Workspace ID (chatgpt_account_id)</Label>
                        <Input
                            placeholder="VD: 26c08774-651a-48fd-a53c-92e0e565f564"
                            value={newFam.workspace_id}
                            onChange={(e) => setNewFam({ ...newFam, workspace_id: e.target.value })}
                        />
                    </div>
                    <div>
                        <Label>Authorization (Bearer token)</Label>
                        <Input
                            placeholder="eyJhbGciOi..."
                            value={newFam.authorization}
                            onChange={(e) => setNewFam({ ...newFam, authorization: e.target.value })}
                        />
                    </div>
                    <div>
                        <Label>Số slots (mặc định 5)</Label>
                        <Input
                            type="number"
                            min={1}
                            max={10}
                            value={newFam.max_slots}
                            onChange={(e) => setNewFam({ ...newFam, max_slots: parseInt(e.target.value) || 5 })}
                        />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setShowAddFam(false)}>Hủy</Button>
                        <Button onClick={handleAddFam}>Thêm FAM</Button>
                    </div>
                </div>
            </Dialog>

            {/* Edit FAM Dialog */}
            <Dialog
                open={!!editingFam}
                onOpenChange={() => setEditingFam(null)}
                title="Sửa FAM"
            >
                {editingFam && (
                    <div className="space-y-4">
                        <div>
                            <Label>Tên FAM</Label>
                            <Input
                                value={editingFam.name}
                                onChange={(e) => setEditingFam({ ...editingFam, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Authorization (Bearer token)</Label>
                            <Input
                                value={editingFam.authorization}
                                onChange={(e) => setEditingFam({ ...editingFam, authorization: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>Trạng thái</Label>
                            <Select
                                value={editingFam.status}
                                onValueChange={(value: 'active' | 'full' | 'inactive') => setEditingFam({ ...editingFam, status: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Hoạt động</SelectItem>
                                    <SelectItem value="full">Đầy slot</SelectItem>
                                    <SelectItem value="inactive">Không hoạt động</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setEditingFam(null)}>Hủy</Button>
                            <Button onClick={handleUpdateFam}>Lưu</Button>
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
}
