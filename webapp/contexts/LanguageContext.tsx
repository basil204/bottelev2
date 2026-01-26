'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { vi } from '../locales/vi';
import { en } from '../locales/en';

type Language = 'vi' | 'en';
type Translations = typeof vi;

// Helper to access nested keys safely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNestedValue(obj: any, key: string): string {
    return key.split('.').reduce((o, i) => (o ? o[i] : null), obj) || key;
}

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>('vi');

    useEffect(() => {
        const saved = localStorage.getItem('language') as Language;
        if (saved && (saved === 'vi' || saved === 'en')) {
            setLanguageState(saved);
        }
    }, []);

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
    };

    const dictionary = language === 'vi' ? vi : en;

    const t = (key: string) => {
        return getNestedValue(dictionary, key);
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}
