'use client';

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Send } from 'lucide-react';

export default function NotificationsPage() {
    const { t } = useLanguage();
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);

    const handleSend = async () => {
        if (!message.trim()) return;

        setLoading(true);
        try {
            let imageUrl = '';

            // Upload image if selected
            if (imageFile) {
                const formData = new FormData();
                formData.append('file', imageFile);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                const uploadData = await uploadRes.json();
                if (uploadData.success) {
                    imageUrl = uploadData.url;
                } else {
                    alert(t('notifications.upload_error') || 'Upload failed');
                    setLoading(false);
                    return;
                }
            }

            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    imageUrl
                }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                let msg = t('notifications.success_message')
                    .replace('{sent}', data.sent)
                    .replace('{total}', data.total);
                if (data.removed > 0) {
                    msg += `\n🗑️ Đã xóa ${data.removed} user không hoạt động (blocked/deactivated)`;
                }
                alert(msg);
                setMessage('');
                setImageFile(null); // Reset file
                // Reset file input value if needed (controlled input complex, letting it be simple)
                const fileInput = document.getElementById('image-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';

            } else {
                alert(t('notifications.error_message') + (data.error ? ` (${data.error})` : ''));
            }
        } catch (error) {
            console.error(error);
            alert(t('notifications.error_message'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t('notifications.title')}</h2>
                    <p className="text-muted-foreground">{t('notifications.subtitle')}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-primary" />
                        {t('notifications.send')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('notifications.message_label')}</label>
                        <Textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t('notifications.placeholder')}
                            className="min-h-[150px]"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Image (Optional)</label>
                        <div className="flex items-center gap-2">
                            <input
                                id="image-upload"
                                type="file"
                                accept="image/*"
                                onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                                className="block w-full text-sm text-slate-500
                                  file:mr-4 file:py-2 file:px-4
                                  file:rounded-full file:border-0
                                  file:text-sm file:font-semibold
                                  file:bg-violet-50 file:text-violet-700
                                  hover:file:bg-violet-100"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={handleSend} disabled={loading || !message.trim()}>
                            <Send className="w-4 h-4 mr-2" />
                            {loading ? t('notifications.sending') : t('notifications.send')}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
