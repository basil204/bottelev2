"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Loader2 } from "lucide-react";

interface LocationData {
    lat: string;
    lon: string;
    display_name: string;
    address?: {
        road?: string;
        neighbourhood?: string;
        suburb?: string;
        city?: string;
        postcode?: string;
        country?: string;
    };
}

export function Footer() {
    const router = useRouter();
    const [location, setLocation] = useState<LocationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Check if geolocation is supported
        if (!navigator.geolocation) {
            setError("Trình duyệt không hỗ trợ định vị");
            setLoading(false);
            // Redirect to 404 if geolocation not supported
            router.push('/404');
            return;
        }

        // Request location permission
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
                    // Call Nominatim API to get address from coordinates
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                        {
                            headers: {
                                "Accept-Language": "vi",
                            },
                        }
                    );

                    if (!response.ok) {
                        throw new Error("Không thể lấy thông tin địa chỉ");
                    }

                    const data: LocationData = await response.json();
                    setLocation(data);

                    // Log visit to admin logs
                    try {
                        await fetch('/api/log-visit', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                lat: data.lat,
                                lon: data.lon,
                                display_name: data.display_name,
                                address: data.address,
                            }),
                        });
                    } catch (logErr) {
                        console.error('Failed to log visit:', logErr);
                    }
                } catch (err) {
                    setError("Lỗi khi lấy thông tin địa chỉ");
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                // Redirect to 404 when location permission is denied or error occurs
                switch (err.code) {
                    case err.PERMISSION_DENIED:
                        setError("Bạn đã từ chối quyền truy cập vị trí");
                        break;
                    case err.POSITION_UNAVAILABLE:
                        setError("Không thể xác định vị trí");
                        break;
                    case err.TIMEOUT:
                        setError("Hết thời gian chờ lấy vị trí");
                        break;
                    default:
                        setError("Lỗi không xác định");
                }
                setLoading(false);
                // Redirect to 404
                router.push('/404');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000, // Cache location for 5 minutes
            }
        );
    }, [router]);

    return (
        <footer className="border-t border-gray-700 bg-gray-900/50 backdrop-blur-sm px-4 py-3">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <MapPin className="h-4 w-4 text-blue-400" />
                {loading ? (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang lấy vị trí...</span>
                    </div>
                ) : error ? (
                    <span className="text-red-400">{error}</span>
                ) : location ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span className="font-medium text-gray-300">
                            {location.display_name}
                        </span>
                        <span className="text-gray-500 text-xs">
                            ({location.lat}, {location.lon})
                        </span>
                    </div>
                ) : (
                    <span>Không có thông tin vị trí</span>
                )}
            </div>
        </footer>
    );
}
