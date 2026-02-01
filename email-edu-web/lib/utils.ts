import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'dd/MM/yyyy HH:mm', { locale: vi });
}

export function generateRandomUsername(length: number = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function generateRandomPassword(length: number = 12): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export function getDeleteTime(hours: number): Date {
    const date = new Date();
    date.setHours(date.getHours() + hours);
    return date;
}

export function getTimeRemaining(deleteAt: Date): string {
    const now = new Date();
    const diff = deleteAt.getTime() - now.getTime();

    if (diff <= 0) return 'Đã hết hạn';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days} ngày`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes} phút`;
}

// Vietnamese names
const VIETNAMESE_LAST_NAMES = [
    'Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Huynh', 'Phan', 'Vu', 'Vo', 'Dang',
    'Bui', 'Do', 'Ho', 'Ngo', 'Duong', 'Ly', 'Dao', 'Dinh', 'Truong', 'Luu',
    'Ha', 'Mai', 'Tang', 'Trinh', 'Cao', 'Lam', 'Vuong', 'Thai', 'Chau', 'Ta'
];

const VIETNAMESE_FIRST_NAMES = [
    // Male names
    'Anh', 'Binh', 'Cuong', 'Dat', 'Dung', 'Duc', 'Hai', 'Hieu', 'Hoang', 'Huy',
    'Khanh', 'Khoa', 'Long', 'Manh', 'Minh', 'Nam', 'Nghia', 'Phong', 'Quang', 'Son',
    'Tai', 'Thanh', 'Thang', 'Tien', 'Tuan', 'Trung', 'Vinh', 'Vuong', 'Hung', 'Duy',
    // Female names
    'An', 'Chi', 'Dao', 'Ha', 'Hanh', 'Hang', 'Hoa', 'Huong', 'Lan', 'Linh',
    'Mai', 'My', 'Nga', 'Ngoc', 'Nhi', 'Phuong', 'Thao', 'Thu', 'Trang', 'Uyen',
    'Van', 'Vy', 'Xuan', 'Yen', 'Trinh', 'Quynh', 'Ngan', 'Diep', 'Kim', 'Thuy'
];

const VIETNAMESE_MIDDLE_NAMES = [
    'Van', 'Thi', 'Minh', 'Hoang', 'Thanh', 'Ngoc', 'Quoc', 'Kim', 'Duc', 'Hong',
    'Phuoc', 'Xuan', 'Huu', 'Dinh', 'Quang', 'Trong', 'Tuan', 'Cong', 'Hien', 'Bao'
];

export function getRandomVietnameseFirstName(): string {
    return VIETNAMESE_FIRST_NAMES[Math.floor(Math.random() * VIETNAMESE_FIRST_NAMES.length)];
}

export function getRandomVietnameseLastName(): string {
    return VIETNAMESE_LAST_NAMES[Math.floor(Math.random() * VIETNAMESE_LAST_NAMES.length)];
}

export function getRandomVietnameseMiddleName(): string {
    return VIETNAMESE_MIDDLE_NAMES[Math.floor(Math.random() * VIETNAMESE_MIDDLE_NAMES.length)];
}

export function getRandomVietnameseFullName(): { firstName: string; lastName: string } {
    const lastName = getRandomVietnameseLastName();
    const middleName = getRandomVietnameseMiddleName();
    const firstName = getRandomVietnameseFirstName();

    // Trong tiếng Việt: Họ + Tên đệm + Tên
    // Google: familyName = Họ, givenName = Tên đệm + Tên
    return {
        lastName: lastName,
        firstName: `${middleName} ${firstName}`
    };
}
