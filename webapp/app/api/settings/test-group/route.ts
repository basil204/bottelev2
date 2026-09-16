import { NextResponse } from 'next/server';
import { sendToTelegramGroups, getNotificationGroupIds } from '@/lib/telegramBroadcast';
import { getAdminFromCookie, logAdminAction, getRequestInfo } from '@/lib/adminLog';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { targetGroupId, message } = body;
        const { ipAddress, userAgent } = getRequestInfo(request);
        const adminName = await getAdminFromCookie(request);

        let customGroupIds: string[] | undefined = undefined;
        if (targetGroupId && typeof targetGroupId === 'string' && targetGroupId.trim()) {
            customGroupIds = targetGroupId.split(/[\r\n,;|]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        }

        const effectiveGroupIds = customGroupIds && customGroupIds.length > 0
            ? customGroupIds
            : await getNotificationGroupIds();

        if (effectiveGroupIds.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'Chưa có ID Nhóm / Kênh Telegram nào được nhập hoặc lưu trong cấu hình. Vui lòng nhập ID nhóm (ví dụ: -1001234567890 hoặc @ten_kenh).'
            }, { status: 400 });
        }

        const testMsg = message || `🔔 <b>KIỂM TRA KẾT NỐI THÔNG BÁO BOT TELEGRAM</b>\n\n` +
            `✅ Bot đã kết nối thành công và có quyền gửi tin nhắn vào nhóm/kênh này!\n` +
            `⏱️ <i>Thời gian kiểm tra: ${new Date().toLocaleString('vi-VN')}</i>\n\n` +
            `🚀 Các thông báo thêm sản phẩm mới, thêm số lượng nhập kho, và thông báo Sale sẽ được gửi tự động vào đây.`;

        const stats = await sendToTelegramGroups({
            message: testMsg,
            customGroupIds: effectiveGroupIds
        });

        await logAdminAction({
            adminName: adminName || 'System',
            action: 'BROADCAST',
            targetType: 'SETTING',
            details: { test: 'TELEGRAM_GROUP_NOTIFICATION', targets: effectiveGroupIds, stats },
            ipAddress,
            userAgent,
            request
        });

        if (stats.sent > 0) {
            return NextResponse.json({
                success: true,
                message: `Đã gửi tin nhắn test thành công tới ${stats.sent}/${stats.total} nhóm/kênh Telegram (${effectiveGroupIds.join(', ')})!`,
                stats
            });
        } else {
            return NextResponse.json({
                success: false,
                error: `Không thể gửi tin nhắn tới ${effectiveGroupIds.join(', ')}. Vui lòng kiểm tra lại: 1. Bot đã được thêm vào nhóm/kênh chưa? 2. Bot đã được cấp quyền Đăng tin nhắn (Send Messages / Post Messages / Admin) chưa?`,
                stats
            }, { status: 400 });
        }
    } catch (error: any) {
        console.error('[TEST_GROUP_ERR]', error);
        return NextResponse.json({
            success: false,
            error: error?.message || 'Lỗi khi gửi tin nhắn test nhóm'
        }, { status: 500 });
    }
}
