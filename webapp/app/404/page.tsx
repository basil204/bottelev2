"use client";

import Link from "next/link";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Main Card */}
                <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl p-8 text-center">
                    {/* Icon */}
                    <div className="relative mb-6">
                        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full flex items-center justify-center">
                            <FileQuestion className="w-12 h-12 text-blue-400" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl font-bold text-white mb-2">
                        <span className="text-blue-400">4</span>
                        <span className="text-indigo-400">0</span>
                        <span className="text-purple-400">4</span>
                    </h1>
                    <h2 className="text-xl font-semibold text-gray-300 mb-4">
                        Không Tìm Thấy Trang
                    </h2>

                    {/* Description */}
                    <p className="text-gray-400 mb-8 leading-relaxed">
                        Trang bạn đang tìm kiếm không tồn tại hoặc đã bị di chuyển sang địa chỉ khác.
                    </p>

                    {/* Actions */}
                    <div className="flex flex-col gap-3">
                        <Link
                            href="/"
                            className="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/25 flex items-center justify-center gap-2"
                        >
                            <Home className="w-5 h-5" />
                            Quay về Trang chủ
                        </Link>
                        
                        <button
                            onClick={() => window.history.back()}
                            className="w-full py-3.5 px-6 bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold rounded-xl transition-all duration-300 border border-gray-600/30 flex items-center justify-center gap-2"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Quay lại trang trước
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-gray-600 text-sm mt-6">
                    © 2026 Admin Dashboard. Mọi quyền được bảo lưu.
                </p>
            </div>
        </div>
    );
}
