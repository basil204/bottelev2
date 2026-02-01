'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { User, Mail, Calendar, Shield } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface UserProfile {
    id: number;
    email: string;
    name: string;
    role: string;
    email_quota: number;
    emails_created: number;
    created_at: string;
}

export default function ProfilePage() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/user/profile');
            const data = await res.json();
            if (data.success) {
                setUser(data.user);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                Không thể tải thông tin tài khoản
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold">Tài khoản</h2>
                <p className="text-muted-foreground">Thông tin cá nhân của bạn</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Profile Info */}
                <Card>
                    <CardHeader>
                        <CardTitle>Thông tin cá nhân</CardTitle>
                        <CardDescription>Thông tin tài khoản của bạn</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <User className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Họ tên</p>
                                <p className="font-medium">{user.name}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Mail className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Email</p>
                                <p className="font-medium">{user.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Shield className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Vai trò</p>
                                <p className="font-medium capitalize">{user.role}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                            <Calendar className="w-5 h-5 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Ngày đăng ký</p>
                                <p className="font-medium">{formatDate(user.created_at)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Email Stats */}
                <Card>
                    <CardHeader>
                        <CardTitle>Thống kê Email</CardTitle>
                        <CardDescription>Quota và số lượng email đã tạo</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border">
                                <div className="text-sm text-muted-foreground mb-1">Emails đã tạo</div>
                                <div className="text-3xl font-bold">{user.emails_created}</div>
                            </div>
                            <div className="p-4 rounded-lg bg-gradient-to-r from-green-500/10 to-blue-500/10 border">
                                <div className="text-sm text-muted-foreground mb-1">Quota tổng cộng</div>
                                <div className="text-3xl font-bold">{user.email_quota}</div>
                            </div>
                            <div className="p-4 rounded-lg bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border">
                                <div className="text-sm text-muted-foreground mb-1">Còn lại</div>
                                <div className="text-3xl font-bold">{user.email_quota - user.emails_created}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
