"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, User, Phone, PackageSearch, Truck, RefreshCw, Navigation, Building2, Locate } from "lucide-react";

/* ═══════════════════ Types ═══════════════════ */

interface RecyclePointGeo {
    id: number;
    regionUz: string;
    regionRu: string;
    cityUz: string;
    phone: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    color: string;
    status: string;
    isAccepting: boolean;
    pricePerKg: number;
    _count: { requests: number; supervisors: number; drivers: number };
}

interface DriverGPS {
    id: number;
    name: string;
    phone: string;
    status: string;
    lastLat: number | null;
    lastLng: number | null;
    lastSeenAt: string | null;
    pointId: number | null;
    point: { regionUz: string; color: string; lat: number | null; lng: number | null } | null;
    supervisorId: number | null;
    supervisor: { name: string } | null;
}

interface RequestGeo {
    id: number;
    name: string;
    phone: string;
    status: string;
    volume: number | null;
    address: string | null;
    pickupLat: number;
    pickupLng: number;
    pickupType: string;
    point: { regionUz: string; color: string } | null;
    assignedDriver: { id: number; name: string; phone: string } | null;
}

/* ═══════════════════ Helpers ═══════════════════ */

const TAILWIND_TO_HEX: Record<string, string> = {
    'bg-emerald-500': '#10b981', 'bg-blue-500': '#3b82f6', 'bg-purple-500': '#8b5cf6',
    'bg-orange-500': '#f97316', 'bg-red-500': '#ef4444', 'bg-teal-500': '#14b8a6',
    'bg-indigo-500': '#6366f1', 'bg-pink-500': '#ec4899', 'bg-cyan-500': '#06b6d4',
    'bg-lime-500': '#84cc16', 'bg-yellow-500': '#eab308', 'bg-violet-500': '#8b5cf6',
};

function twToHex(tw: string): string {
    return TAILWIND_TO_HEX[tw] || '#10b981';
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(dateStr: string | null): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'hozirgina';
    if (mins < 60) return `${mins} daqiqa oldin`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} soat oldin`;
    return `${Math.floor(hrs / 24)} kun oldin`;
}

/* ═══════════════════ Icons ═══════════════════ */

const createPointIcon = (color: string) => L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:${color}; width:36px; height:36px; border-radius:50%; border:3px solid white; box-shadow:0 2px 12px ${color}80; display:flex; align-items:center; justify-content:center; font-size:16px; position:relative;">🏭<div style="position:absolute;bottom:-4px;right:-4px;width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid white;"></div></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
});

const createRequestIcon = (status: string) => {
    const color = status === 'new_' || status === 'new' ? '#ef4444' :
        status === 'en_route' ? '#f59e0b' :
        status === 'collecting' ? '#8b5cf6' : '#10b981';
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background:${color}; width:24px; height:24px; border-radius:50%; border:2px solid white; box-shadow:0 0 6px ${color}60;"><div style="width:8px;height:8px;background:white;border-radius:50%;margin:6px auto;"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
    });
};

const driverIcon = (color: string, isActive: boolean) => L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:${isActive ? color : '#94a3b8'}; width:30px; height:30px; border-radius:50%; border:3px solid white; box-shadow:0 0 8px ${isActive ? color : '#94a3b8'}60; display:flex; align-items:center; justify-content:center; font-size:14px;">🚚</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
});

/* ═══════════════════ Map Recenter ═══════════════════ */

function RecenterMap({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
    return null;
}

/* ═══════════════════ Main Component ═══════════════════ */

export default function LogisticsMap() {
    const [points, setPoints] = useState<RecyclePointGeo[]>([]);
    const [requests, setRequests] = useState<RequestGeo[]>([]);
    const [drivers, setDrivers] = useState<DriverGPS[]>([]);
    const [center, setCenter] = useState<[number, number]>([41.311081, 69.240562]);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [showRadius, setShowRadius] = useState(true);
    const [showLines, setShowLines] = useState(true);
    const [selectedPoint, setSelectedPoint] = useState<number | null>(null);

    const fetchData = useCallback(() => {
        fetch("/api/admin/logistics")
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setPoints(data.points || []);
                    setRequests(data.requests || []);
                    setDrivers(data.drivers || []);
                    setLastUpdate(new Date());

                    // Birinchi bazaga markazlash
                    const firstPoint = data.points?.find((p: RecyclePointGeo) => p.lat && p.lng);
                    if (firstPoint) setCenter([firstPoint.lat!, firstPoint.lng!]);
                }
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);

        // ── SSE: Real-time GPS yangilanish ──────────────────────────
        let sseCleanup: (() => void) | null = null;
        try {
            const evtSource = new EventSource('/api/admin/sse');
            evtSource.onmessage = (ev) => {
                try {
                    const data = JSON.parse(ev.data);
                    if (data.type === 'driver.gps_update') {
                        // GPS yangilanganda — darhol ma'lumot yangilash
                        fetchData();
                    }
                } catch { /* parse xatosi — e'tiborsiz */ }
            };
            evtSource.onerror = () => {
                evtSource.close();
            };
            sseCleanup = () => evtSource.close();
        } catch { /* SSE qo'llanilmaydi */ }

        return () => {
            clearInterval(interval);
            sseCleanup?.();
        };
    }, [fetchData]);

    // GPS'li elementlar
    const pointsWithGPS = useMemo(() => points.filter(p => p.lat && p.lng), [points]);
    const driversWithGPS = useMemo(() => drivers.filter(d => d.lastLat && d.lastLng), [drivers]);

    // Hudud bo'yicha statistika
    const regionStats = useMemo(() => {
        const map = new Map<number, { name: string; color: string; requests: number; drivers: number }>();
        points.forEach(p => {
            map.set(p.id, {
                name: p.regionUz,
                color: twToHex(p.color),
                requests: p._count.requests,
                drivers: p._count.drivers,
            });
        });
        return map;
    }, [points]);

    // Eng yaqin bazani topish
    const findNearestPoint = useCallback((lat: number, lng: number): { point: RecyclePointGeo; distance: number } | null => {
        let nearest: RecyclePointGeo | null = null;
        let minDist = Infinity;
        pointsWithGPS.forEach(p => {
            const dist = haversineKm(lat, lng, p.lat!, p.lng!);
            if (dist < minDist) { minDist = dist; nearest = p; }
        });
        return nearest ? { point: nearest as RecyclePointGeo, distance: minDist } : null;
    }, [pointsWithGPS]);

    // Haydovchi → Baza chiziqlari
    const driverPointLines = useMemo(() => {
        if (!showLines) return [];
        return driversWithGPS
            .filter(d => d.point?.lat && d.point?.lng)
            .map(d => ({
                id: d.id,
                from: [d.lastLat!, d.lastLng!] as [number, number],
                to: [d.point!.lat!, d.point!.lng!] as [number, number],
                color: twToHex(d.point!.color),
            }));
    }, [driversWithGPS, showLines]);

    return (
        <div className="relative z-0 space-y-3">
            {/* ═══ Statistika Panel ═══ */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Bazalar */}
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-100 shadow-sm">
                        <Building2 size={14} className="text-emerald-500" />
                        <span className="text-xs font-medium text-gray-600">
                            Bazalar: {pointsWithGPS.length}
                        </span>
                    </div>
                    {/* Yangi arizalar */}
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-100 shadow-sm">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-xs font-medium text-gray-600">
                            Yangi arizalar: {requests.filter(r => r.status === 'new_' || r.status === 'new').length}
                        </span>
                    </div>
                    {/* Faol arizalar */}
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-100 shadow-sm">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium text-gray-600">
                            Faol: {requests.filter(r => r.status !== 'new_' && r.status !== 'new').length}
                        </span>
                    </div>
                    {/* Haydovchilar */}
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-100 shadow-sm">
                        <Truck size={14} className="text-indigo-500" />
                        <span className="text-xs font-medium text-gray-600">
                            Haydovchilar: {drivers.length} ({driversWithGPS.length} GPS)
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Boshqaruv tugmalari */}
                    <button
                        onClick={() => setShowRadius(!showRadius)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${showRadius ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                    >
                        ⭕ Radius
                    </button>
                    <button
                        onClick={() => setShowLines(!showLines)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${showLines ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
                    >
                        📏 Chiziqlar
                    </button>
                    <span className="text-[10px] text-gray-400">{lastUpdate.toLocaleTimeString('ru-RU')}</span>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                        <RefreshCw size={12} /> Yangilash
                    </button>
                </div>
            </div>

            {/* ═══ Hudud Legend ═══ */}
            {pointsWithGPS.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hududlar:</span>
                    {pointsWithGPS.map(p => {
                        const hex = twToHex(p.color);
                        const isSelected = selectedPoint === p.id;
                        return (
                            <button
                                key={p.id}
                                onClick={() => {
                                    setSelectedPoint(isSelected ? null : p.id);
                                    if (!isSelected && p.lat && p.lng) setCenter([p.lat, p.lng]);
                                }}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border ${isSelected ? 'ring-2 ring-offset-1 shadow-sm' : ''}`}
                                style={{
                                    backgroundColor: isSelected ? hex + '20' : '#f9fafb',
                                    borderColor: isSelected ? hex : '#e5e7eb',
                                    color: isSelected ? hex : '#6b7280',
                                    outlineColor: hex,
                                }}
                            >
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hex }} />
                                {p.regionUz}
                                <span className="text-[10px] opacity-70">
                                    ({p._count.requests}📦 {p._count.drivers}🚚)
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ═══ XARITA ═══ */}
            <style jsx global>{`
                .leaflet-container {
                    width: 100%;
                    height: 650px;
                    border-radius: 0.75rem;
                    z-index: 1 !important;
                }
                .nearest-popup { font-size: 12px; }
                .nearest-popup b { color: #059669; }
            `}</style>

            <MapContainer center={center} zoom={11} scrollWheelZoom={true}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                <RecenterMap center={center} />

                {/* ── 1. Baza xizmat radius doirasi ── */}
                {showRadius && pointsWithGPS.map(p => (
                    <Circle
                        key={`radius-${p.id}`}
                        center={[p.lat!, p.lng!]}
                        radius={10000} // 10km
                        pathOptions={{
                            color: twToHex(p.color),
                            weight: 1.5,
                            fillColor: twToHex(p.color),
                            fillOpacity: 0.06,
                            dashArray: '6, 6',
                        }}
                    />
                ))}

                {/* ── 2. Haydovchi → Baza chiziqlari ── */}
                {driverPointLines.map(line => (
                    <Polyline
                        key={`dpl-${line.id}`}
                        positions={[line.from, line.to]}
                        pathOptions={{
                            color: line.color,
                            weight: 2.5,
                            dashArray: '8, 8',
                            opacity: 0.5,
                        }}
                    />
                ))}

                {/* ── 3. Baza markerlari ── */}
                {pointsWithGPS.map(p => {
                    const hex = twToHex(p.color);
                    return (
                        <Marker
                            key={`point-${p.id}`}
                            position={[p.lat!, p.lng!]}
                            icon={createPointIcon(hex)}
                        >
                            <Popup className="rounded-xl" maxWidth={300}>
                                <div className="p-1 min-w-[240px] font-sans">
                                    <div className="flex items-center gap-2 border-b pb-2 mb-3">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ background: hex + '20' }}>
                                            🏭
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-sm" style={{ color: hex }}>{p.regionUz}</h3>
                                            <p className="text-[10px] text-gray-400">{p.cityUz}</p>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5 text-xs">
                                        <p className="flex items-center gap-2">📞 {p.phone}</p>
                                        {p.address && <p className="flex items-center gap-2 text-gray-500">📍 {p.address}</p>}
                                        <p className="flex items-center gap-2">💰 {p.pricePerKg.toLocaleString()} so&apos;m/kg</p>
                                        <div className="flex gap-3 mt-2 pt-2 border-t">
                                            <span className="text-[11px] font-bold" style={{ color: hex }}>📦 {p._count.requests} ariza</span>
                                            <span className="text-[11px] font-bold text-indigo-600">🚚 {p._count.drivers} haydovchi</span>
                                            <span className="text-[11px] font-bold text-gray-500">👷 {p._count.supervisors} masul</span>
                                        </div>
                                        <div className={`mt-2 text-center text-[10px] font-bold px-2 py-1 rounded ${p.isAccepting ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {p.isAccepting ? '✅ Qabul qilyapti' : '🔴 Qabul to\'xtatilgan'}
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* ── 4. Ariza markerlari ── */}
                {requests.map(req => {
                    const nearestResult = findNearestPoint(req.pickupLat, req.pickupLng);
                    return (
                        <Marker
                            key={`req-${req.id}`}
                            position={[req.pickupLat, req.pickupLng]}
                            icon={createRequestIcon(req.status)}
                        >
                            <Popup className="rounded-xl" maxWidth={280}>
                                <div className="p-1 min-w-[220px] font-sans">
                                    <h3 className="font-bold flex items-center gap-2 border-b pb-2 mb-2 text-sm">
                                        <PackageSearch size={16} className="text-blue-500" />
                                        #{req.id} — {req.volume || '?'} kg
                                    </h3>
                                    <div className="space-y-1.5 text-xs">
                                        <p className="flex items-center gap-2"><User size={14} /> <b>{req.name}</b></p>
                                        <p className="flex items-center gap-2"><Phone size={14} /> {req.phone}</p>
                                        <p className="flex items-center gap-2 text-gray-500"><MapPin size={14} /> {req.address || "Faqat GPS"}</p>
                                        {req.point && (
                                            <p className="flex items-center gap-2 text-emerald-600">
                                                <Building2 size={14} /> {req.point.regionUz}
                                            </p>
                                        )}
                                        {req.assignedDriver && (
                                            <p className="flex items-center gap-2 text-indigo-600">
                                                <Truck size={14} /> {req.assignedDriver.name}
                                            </p>
                                        )}

                                        {/* Eng yaqin baza */}
                                        {nearestResult && (
                                            <div className="mt-2 pt-2 border-t bg-emerald-50 rounded-lg p-2">
                                                <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                                                    <Navigation size={12} /> Eng yaqin baza:
                                                </p>
                                                <p className="text-xs font-bold mt-0.5">
                                                    🏭 {nearestResult.point.regionUz} — <span className="text-emerald-600">{nearestResult.distance.toFixed(1)} km</span>
                                                </p>
                                            </div>
                                        )}

                                        <div className={`mt-2 text-center text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded ${
                                            req.status === 'new' || req.status === 'new_'
                                                ? 'bg-red-50 text-red-600'
                                                : 'bg-emerald-50 text-emerald-600'
                                        }`}>
                                            {req.status === 'new' || req.status === 'new_' ? '⏳ Mijoz kutyapti' :
                                             req.status === 'en_route' ? '🚚 Yo\'lda' :
                                             req.status === 'collecting' ? '📦 Yig\'ilmoqda' :
                                             req.status}
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* ── 5. Haydovchi markerlari ── */}
                {driversWithGPS.map(drv => {
                    const hex = drv.point ? twToHex(drv.point.color) : '#6366f1';
                    const nearestResult = findNearestPoint(drv.lastLat!, drv.lastLng!);
                    const isActive = drv.status === 'active';

                    return (
                        <Marker
                            key={`drv-${drv.id}`}
                            position={[drv.lastLat!, drv.lastLng!]}
                            icon={driverIcon(hex, isActive)}
                        >
                            <Popup className="rounded-xl" maxWidth={260}>
                                <div className="p-1 min-w-[200px] font-sans">
                                    <h3 className="font-bold flex items-center gap-2 border-b pb-2 mb-2 text-sm" style={{ color: hex }}>
                                        🚚 {drv.name}
                                    </h3>
                                    <div className="space-y-1.5 text-xs">
                                        <p className="flex items-center gap-2"><Phone size={12} /> {drv.phone}</p>
                                        <p className="flex items-center gap-2 text-gray-500">
                                            📡 {timeAgo(drv.lastSeenAt)}
                                        </p>
                                        {drv.point && (
                                            <p className="flex items-center gap-2" style={{ color: hex }}>
                                                <Building2 size={12} /> {drv.point.regionUz}
                                            </p>
                                        )}
                                        {drv.supervisor && (
                                            <p className="flex items-center gap-2 text-gray-500">
                                                👷 Masul: {drv.supervisor.name}
                                            </p>
                                        )}

                                        {/* Eng yaqin baza */}
                                        {nearestResult && (
                                            <div className="mt-2 pt-2 border-t bg-blue-50 rounded-lg p-2">
                                                <p className="text-[10px] font-bold text-blue-700 flex items-center gap-1">
                                                    <Navigation size={11} /> Eng yaqin baza:
                                                </p>
                                                <p className="text-xs font-bold mt-0.5">
                                                    🏭 {nearestResult.point.regionUz} — <span className="text-blue-600">{nearestResult.distance.toFixed(1)} km</span>
                                                </p>
                                            </div>
                                        )}

                                        <div className={`mt-2 text-center text-[10px] font-bold px-2 py-1 rounded ${
                                            isActive ? 'bg-green-50 text-green-700' :
                                            drv.status === 'on_route' ? 'bg-amber-50 text-amber-700' :
                                            'bg-gray-50 text-gray-600'
                                        }`}>
                                            {isActive ? '🟢 Bo\'sh' : drv.status === 'on_route' ? '🚚 Yo\'lda' : drv.status}
                                        </div>
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
