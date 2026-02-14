import { useLanguage } from '@/contexts/LanguageContext';
import { useSettings } from '@/contexts/SettingsContext';

export function useCurrency() {
    const { language } = useLanguage();
    const { settings } = useSettings();

    const formatPrice = (amountVND: number) => {
        if (language === 'en') {
            // Convert to USD
            const rate = settings.exchange_rate || 26000;
            const amountUSD = amountVND / rate;
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(amountUSD);
        } else {
            // Keep as VND
            return new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency: 'VND',
            }).format(amountVND);
        }
    };

    return { formatPrice };
}
