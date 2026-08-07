'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, ChevronDown, Check } from 'lucide-react';

export function LanguageSwitcher() {
    const { language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (lang: 'vi' | 'en' | 'zh') => {
        setLanguage(lang);
        setIsOpen(false);
    };

    const langLabel: Record<string, string> = { vi: '🇻🇳 VN', en: '🇺🇸 EN', zh: '🇨🇳 中文' };
    const langTitle: Record<string, string> = { vi: 'Đổi ngôn ngữ', en: 'Change language', zh: '切换语言' };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-100/80 px-3 text-xs font-semibold text-zinc-700 transition-all hover:border-zinc-300 hover:bg-zinc-200/70 active:scale-[0.98]"
                title={langTitle[language] || 'Change language'}
            >
                <Globe className="h-4 w-4" />
                <span>{langLabel[language] || '🇻🇳 VN'}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-zinc-200 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl">
                    <button
                        onClick={() => handleSelect('vi')}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-accent/50 transition-colors ${language === 'vi' ? 'bg-accent/30 font-medium' : ''}`}
                    >
                        <span>🇻🇳</span>
                        <span>Tiếng Việt</span>
                        {language === 'vi' && <span className="ml-auto text-primary">✓</span>}
                    </button>
                    <button
                        onClick={() => handleSelect('en')}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-accent/50 transition-colors ${language === 'en' ? 'bg-accent/30 font-medium' : ''}`}
                    >
                        <span>🇺🇸</span>
                        <span>English</span>
                        {language === 'en' && <span className="ml-auto text-primary">✓</span>}
                    </button>
                    <button
                        onClick={() => handleSelect('zh')}
                        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-accent/50 transition-colors ${language === 'zh' ? 'bg-accent/30 font-medium' : ''}`}
                    >
                        <span>🇨🇳</span>
                        <span>中文</span>
                        {language === 'zh' && <span className="ml-auto text-primary">✓</span>}
                    </button>
                </div>
            )}
        </div>
    );
}
