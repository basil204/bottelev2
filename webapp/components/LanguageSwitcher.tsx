'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Globe, ChevronDown } from 'lucide-react';

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

    const handleSelect = (lang: 'vi' | 'en') => {
        setLanguage(lang);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg hover:bg-accent/50 transition-colors flex items-center gap-2 text-sm font-medium border border-border"
                title={language === 'vi' ? 'Đổi ngôn ngữ' : 'Change language'}
            >
                <Globe className="h-4 w-4" />
                <span>{language === 'vi' ? '🇻🇳 VN' : '🇺🇸 EN'}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
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
                </div>
            )}
        </div>
    );
}
