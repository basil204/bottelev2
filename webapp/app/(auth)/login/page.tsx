'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LoginPage() {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        // ... (existing logic)
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // Get form data
            const form = e.target as HTMLFormElement;
            const username = (form[0] as HTMLInputElement).value;
            const password = (form[1] as HTMLInputElement).value;

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                // Redirect
                window.location.href = '/';
            } else {
                setError(data.error || 'Invalid credentials');
                setIsLoading(false);
            }
        } catch (err) {
            setError('Something went wrong');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
            {/* Dynamic Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/30 dark:bg-purple-600/20 blur-[100px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/30 dark:bg-blue-600/20 blur-[100px] animate-pulse delay-700" />
                <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-pink-500/20 dark:bg-pink-500/10 blur-[80px] animate-pulse delay-1000" />
            </div>

            {/* Glassmorphism Card */}
            <div className="relative z-10 w-full max-w-md p-8 md:p-10">
                <div className="absolute inset-0 bg-white/60 dark:bg-black/40 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl" />

                <div className="relative z-20 flex flex-col items-center">
                    {/* Logo / Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600 mb-2">
                            {t('auth.login_title')}
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            {t('auth.login_subtitle')}
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="w-full space-y-6">
                        <div className="space-y-4">
                            {/* Username Input */}
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder={t('auth.username_placeholder')}
                                    className="w-full bg-background/50 dark:bg-white/5 border border-input rounded-xl py-3.5 pl-11 pr-4 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all hover:bg-background/80 dark:hover:bg-white/10"
                                    required
                                />
                            </div>

                            {/* Password Input */}
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={t('auth.password_placeholder')}
                                    className="w-full bg-background/50 dark:bg-white/5 border border-input rounded-xl py-3.5 pl-11 pr-12 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-transparent transition-all hover:bg-background/80 dark:hover:bg-white/10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <label className="flex items-center gap-2 cursor-pointer hover:text-foreground transition-colors">
                                <input type="checkbox" className="w-4 h-4 rounded bg-background/50 border-input text-primary focus:ring-primary/50 focus:ring-offset-0" />
                                <span>{t('auth.remember_me')}</span>
                            </label>
                            <Link href="/forgot-password" className="hover:text-primary transition-colors">
                                {t('auth.forgot_password')}
                            </Link>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={clsx(
                                "w-full relative group overflow-hidden rounded-xl p-[1px] focus:outline-none focus:ring-2 focus:ring-primary/50",
                                isLoading && "cursor-not-allowed opacity-80"
                            )}
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 group-hover:from-blue-500 group-hover:to-purple-500 transition-colors" />
                            <div className="relative bg-background dark:bg-[#0f172a] bg-opacity-90 dark:bg-opacity-90 group-hover:bg-opacity-0 transition-all rounded-xl py-3.5 flex items-center justify-center gap-2 text-foreground group-hover:text-white font-medium">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>{t('auth.signing_in')}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{t('auth.sign_in')}</span>
                                        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>

                    {/* Sign Up Link */}
                    <div className="mt-8 text-center text-sm text-muted-foreground">
                        <span>Don't have an account? </span>
                        <Link href="/signup" className="text-primary hover:text-blue-400 font-medium transition-colors">
                            Create Account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
