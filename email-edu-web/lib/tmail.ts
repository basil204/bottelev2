import axios from 'axios';

const API_BASE_URL = 'https://api.smtp.dev';
const API_KEY = process.env.TMAIL_API_KEY || 'smtplabs_BtwSYcVYeL7jbef28sVNwHDYw6cTtursTtDRnvQnjrTY8qDe';

// Create axios instance with default headers
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'X-API-KEY': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

export interface TMailAccount {
    id: string;
    address: string;
    isActive: boolean;
    createdAt: string;
}

export interface TMailMailbox {
    id: string;
    name: string;
    messagesCount: number;
}

export interface TMailMessage {
    id: string;
    from: { address: string; name?: string };
    to: { address: string; name?: string }[];
    subject: string;
    preview?: string;
    date: string;
    isRead: boolean;
}

export interface TMailMessageDetail extends TMailMessage {
    html?: string;
    text?: string;
    attachments?: any[];
}

/**
 * Tạo tài khoản tMail mới
 */
export async function createTMailAccount(address: string, password: string): Promise<{
    success: boolean;
    data?: TMailAccount;
    error?: string;
}> {
    try {
        const response = await apiClient.post('/accounts', {
            address,
            password
        });

        return {
            success: true,
            data: response.data
        };
    } catch (error: any) {
        console.error('Error creating tMail account:', error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
}

/**
 * Lấy thông tin tài khoản theo địa chỉ email
 */
export async function getTMailAccount(address: string): Promise<{
    success: boolean;
    data?: TMailAccount;
    error?: string;
}> {
    try {
        const response = await apiClient.get('/accounts', {
            params: {
                address,
                isActive: 'true',
                page: 1
            }
        });

        const accounts = response.data?.data || response.data;
        if (accounts && accounts.length > 0) {
            return {
                success: true,
                data: accounts[0]
            };
        }

        return {
            success: false,
            error: 'Account not found'
        };
    } catch (error: any) {
        console.error('Error fetching tMail account:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Lấy danh sách mailboxes của tài khoản
 */
export async function getTMailMailboxes(accountId: string): Promise<{
    success: boolean;
    data?: TMailMailbox[];
    error?: string;
}> {
    try {
        const response = await apiClient.get(`/accounts/${accountId}/mailboxes`);

        return {
            success: true,
            data: response.data?.data || response.data
        };
    } catch (error: any) {
        console.error('Error fetching mailboxes:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Lấy danh sách messages từ mailbox
 */
export async function getTMailMessages(
    accountId: string,
    mailboxId: string,
    page: number = 1,
    limit?: number
): Promise<{
    success: boolean;
    data?: TMailMessage[];
    total?: number;
    error?: string;
}> {
    try {
        const params: any = { page };
        if (limit) params.limit = limit;

        const response = await apiClient.get(
            `/accounts/${accountId}/mailboxes/${mailboxId}/messages`,
            { params }
        );

        return {
            success: true,
            data: response.data?.data || response.data,
            total: response.data?.total || 0
        };
    } catch (error: any) {
        console.error('Error fetching messages:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Lấy chi tiết message
 */
export async function getTMailMessageDetail(
    accountId: string,
    mailboxId: string,
    messageId: string
): Promise<{
    success: boolean;
    data?: TMailMessageDetail;
    error?: string;
}> {
    try {
        const response = await apiClient.get(
            `/accounts/${accountId}/mailboxes/${mailboxId}/messages/${messageId}`
        );

        return {
            success: true,
            data: response.data
        };
    } catch (error: any) {
        console.error('Error fetching message detail:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Xóa tài khoản tMail
 */
export async function deleteTMailAccount(accountId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        await apiClient.delete(`/accounts/${accountId}`);
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting tMail account:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}
