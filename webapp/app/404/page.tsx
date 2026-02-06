"use client";

import { useState } from "react";
import { MapPinOff, RefreshCw, MapPin, ShieldAlert } from "lucide-react";

export default function NotFoundPage() {
    const [requesting, setRequesting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRequestPermission = () => {
        setRequesting(true);
        setError(null);

        if (!navigator.geolocation) {
            setError("Trình duyệt của bạn không hỗ trợ định vị");
            setRequesting(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            () => {
                // Permission granted, redirect to home
                window.location.href = "/";
            },
            (err) => {
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setError("Bạn vẫn chưa cấp quyền định vị. Vui lòng vào cài đặt trình duyệt để bật lại.");
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setError("Không thể xác định vị trí. Vui lòng thử lại.");
                        break;
                    case err.TIMEOUT:
                        setError("Hết thời gian chờ. Vui lòng thử lại.");
                        break;
                    default:
                        setError("Có lỗi xảy ra. Vui lòng thử lại.");
                }
                setRequesting(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
            }
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Main Card */}
                <div className="bg-gray-800/50 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl p-8 text-center">
                    {/* Icon */}
                    <div className="relative mb-6">
                        <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full flex items-center justify-center">
                            <MapPinOff className="w-12 h-12 text-red-400" />
                        </div>
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center animate-pulse">
                            <ShieldAlert className="w-4 h-4 text-yellow-400" />
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl font-bold text-white mb-2">
                        <span className="text-red-400">4</span>
                        <span className="text-orange-400">0</span>
                        <span className="text-yellow-400">4</span>
                    </h1>
                    <h2 className="text-xl font-semibold text-gray-300 mb-4">
                        Yêu cầu quyền định vị
                    </h2>

                    {/* Description */}
                    <p className="text-gray-400 mb-6 leading-relaxed">
                        Để truy cập website, bạn cần cho phép truy cập vị trí của mình.
                        Thông tin này được sử dụng để xác minh và cải thiện trải nghiệm của bạn.
                    </p>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                            <p className="text-red-400 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Request Button */}
                    <button
                        onClick={handleRequestPermission}
                        disabled={requesting}
                        className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-gray-600 disabled:to-gray-500 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                        {requesting ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                Đang yêu cầu quyền...
                            </>
                        ) : (
                            <>
                                <MapPin className="w-5 h-5" />
                                Cấp quyền định vị
                            </>
                        )}
                    </button>

                    {/* Instructions */}
                    <div className="mt-6 p-4 bg-gray-700/30 rounded-xl">
                        <p className="text-gray-500 text-xs leading-relaxed">
                            💡 <strong className="text-gray-400">Mẹo:</strong> Nếu bạn đã từ chối trước đó,
                            hãy nhấn vào biểu tượng 🔒 trên thanh địa chỉ và bật lại quyền định vị.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-gray-600 text-sm mt-6">
                    © 2024 Admin Dashboard. Mọi quyền được bảo lưu.
                </p>
            </div>
        </div>
    );
}
