import axios from 'axios';

/**
 * Lấy mã 2FA từ 2fa.live
 * @param secret - Secret key cho 2FA (phần sau /tok/)
 * @returns Mã OTP 6 số
 */
export async function get2FACode(secret: string): Promise<{
    success: boolean;
    token?: string;
    error?: string;
}> {
    try {
        // Remove all spaces and URL-encoded spaces (%20)
        const cleanSecret = secret.replace(/\s/g, '').replace(/%20/g, '');

        const response = await axios.get(`https://2fa.live/tok/${cleanSecret}`, {
            headers: {
                'Accept': '*/*',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.data && response.data.token) {
            return {
                success: true,
                token: response.data.token
            };
        }

        return {
            success: false,
            error: 'Không lấy được mã 2FA'
        };
    } catch (error: any) {
        console.error('Error fetching 2FA code:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}
