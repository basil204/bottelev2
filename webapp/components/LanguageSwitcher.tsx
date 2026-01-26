'use client';

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
                className="p-2 rounded-lg hover:bg-accent/50 transition-colors flex items-center gap-2 text-sm font-medium"
                title={language === 'vi' ? 'Chuyển sang Tiếng Anh' : 'Switch to Vietnamese'}
            >
                <Globe className="h-4 w-4" />
                <span>{language === 'vi' ? 'VI' : 'EN'}</span>
            </button>
        </div>
    );
}
