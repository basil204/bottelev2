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

    const handleSend = async () => {
        if (!message.trim()) return;

        setLoading(true);
        try {
            const res = await fetch('/api/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                alert(t('notifications.success_message')
                    .replace('{sent}', data.sent)
                    .replace('{total}', data.total)
                );
                setMessage('');
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
