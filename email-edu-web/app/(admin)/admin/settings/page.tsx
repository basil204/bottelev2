'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function AdminSettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold">Cài đặt hệ thống</h2>
                <p className="text-muted-foreground">Quản lý cài đặt hệ thống</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Cài đặt chung
                    </CardTitle>
                    <CardDescription>
                        Tính năng này đang được phát triển
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Các cài đặt hệ thống sẽ được thêm vào đây trong các bản cập nhật sau.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
