'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, User, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { useLanguage } from '@/contexts/LanguageContext';

export default function LoginPage() {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
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
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#030712]">
            {/* Ambient Background Lights */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[55%] h-[55%] rounded-full bg-violet-600/10 blur-[130px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[55%] h-[55%] rounded-full bg-cyan-600/10 blur-[130px] animate-pulse delay-700" />
                <div className="absolute top-[30%] right-[20%] w-[35%] h-[35%] rounded-full bg-indigo-500/5 blur-[100px] animate-pulse delay-1000" />
            </div>

            {/* Glowing Border Card Wrapper */}
            <div className="relative z-10 w-full max-w-md p-[1px] rounded-3xl overflow-hidden group">
                {/* Spinning Gradient Border */}
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400 opacity-60 blur-[2px] rounded-3xl" />
                
                {/* Double Layer Glass Card */}
                <div className="relative z-20 w-full bg-[#09090b]/80 backdrop-blur-2xl p-8 md:p-10 rounded-3xl border border-white/5 shadow-2xl flex flex-col items-center">
                    
                    {/* Glowing Shield Logo */}
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-6">
                        <ShieldCheck className="h-7 w-7 text-white" />
                    </div>

                    {/* Logo / Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-2">
                            {t('auth.login_title')}
                        </h1>
                        <p className="text-muted-foreground text-sm max-w-[280px]">
                            {t('auth.login_subtitle')}
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="w-full mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center font-medium animate-in fade-in-50 duration-300">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="w-full space-y-5">
                        <div className="space-y-4">
                            {/* Username Input */}
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User className="h-5 w-5 text-muted-foreground group-focus-within/input:text-violet-400 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder={t('auth.username_placeholder')}
                                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 pl-11 pr-4 text-white text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all hover:bg-white/[0.04]"
                                    required
                                />
                            </div>

                            {/* Password Input */}
                            <div className="relative group/input">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-muted-foreground group-focus-within/input:text-violet-400 transition-colors" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={t('auth.password_placeholder')}
                                    className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-3.5 pl-11 pr-12 text-white text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all hover:bg-white/[0.04]"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-muted-foreground hover:text-white transition-colors focus:outline-none"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Remember Me & Forgot Password */}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4 rounded bg-white/[0.02] border-white/10 text-violet-600 focus:ring-violet-500/50 focus:ring-offset-0 transition-colors" 
                                />
                                <span>{t('auth.remember_me')}</span>
                            </label>
                            <Link href="/forgot-password" className="hover:text-violet-400 font-medium transition-colors">
                                {t('auth.forgot_password')}
                            </Link>
                        </div>

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={clsx(
                                "w-full relative group/btn overflow-hidden rounded-xl p-[1px] focus:outline-none cursor-pointer",
                                isLoading ? "cursor-not-allowed opacity-80" : ""
                            )}
                        >
                            <span className="absolute inset-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 group-hover/btn:from-violet-500 group-hover/btn:via-indigo-500 group-hover/btn:to-cyan-400 transition-colors" />
                            <div className="relative bg-[#09090b]/90 group-hover/btn:bg-opacity-0 transition-all rounded-xl py-3.5 flex items-center justify-center gap-2 text-white font-medium text-sm">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>{t('auth.signing_in')}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{t('auth.sign_in')}</span>
                                        <ArrowRight className="h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </div>
                        </button>
                    </form>

                    {/* Sign Up Link */}
                    <div className="mt-8 text-center text-xs text-muted-foreground">
                        <span>Don't have an account? </span>
                        <Link href="/signup" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
                            Create Account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
