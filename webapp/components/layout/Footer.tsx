"use client";

import { useEffect, useState } from "react";
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
    const [location, setLocation] = useState<LocationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Log initial visit on mount without prompting for location
    useEffect(() => {
        const logInitialVisit = async () => {
            try {
                await fetch('/api/log-visit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        lat: null,
                        lon: null,
                        display_name: null,
                        address: null,
                    }),
                });
            } catch (logErr) {
                console.error('Failed to log initial visit:', logErr);
            }
        };
        logInitialVisit();
    }, []);

    const handleRequestLocation = () => {
        if (!navigator.geolocation) {
            setError("Trình duyệt không hỗ trợ định vị");
            return;
        }

        setLoading(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;

                try {
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

                    // Update log with coordinates
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
                } catch (err) {
                    setError("Lỗi khi lấy thông tin địa chỉ");
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
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
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000,
            }
        );
    };

    return (
        <footer className="border-t border-white/5 bg-zinc-950/20 backdrop-blur-sm px-6 py-3.5">
            <div className="flex items-center justify-center">
                <button
                    onClick={handleRequestLocation}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.01] border border-white/5 hover:border-white/10 hover:bg-white/[0.03] transition-all duration-200 text-xs text-slate-400 hover:text-slate-200 group cursor-pointer"
                    title="Nhấp để chia sẻ vị trí"
                >
                    {loading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                    ) : (
                        <MapPin className="h-3.5 w-3.5 text-violet-400 group-hover:scale-110 transition-transform" />
                    )}
                    {error ? (
                        <span className="text-red-400">{error}</span>
                    ) : location ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5 text-left">
                            <span className="font-medium text-slate-300">
                                {location.display_name}
                            </span>
                            <span className="text-slate-500 font-mono">
                                ({location.lat}, {location.lon})
                            </span>
                        </div>
                    ) : (
                        <span className="transition-colors">
                            Hệ thống quản trị Bot Tele
                        </span>
                    )}
                </button>
            </div>
        </footer>
    );
}
