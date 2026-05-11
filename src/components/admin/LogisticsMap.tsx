"use client";

import { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapPin, User, Phone, PackageSearch, Truck, RefreshCw } from "lucide-react";

interface DriverGPS {
    id: number;
    name: string;
    phone: string;
    status: string;
    lastLat: number | null;
    lastLng: number | null;
    lastSeenAt: string | null;
}

const createRequestIcon = (status: string) => {
    const color = status === "new" ? "#ef4444" : status === "en_route" ? "#f59e0b" : "#10b981";
    return L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"><div style="width: 8px; height: 8px; background: white; border-radius: 50%; margin: 6px auto;"></div></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
};

const driverIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #6366f1; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(99,102,241,0.6); display: flex; align-items: center; justify-content: center;"><span style="font-size:14px;">🚚</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
});

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

export default function LogisticsMap() {
    const [requests, setRequests] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<DriverGPS[]>([]);
    const [center, setCenter] = useState<[number, number]>([41.311081, 69.240562]);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const fetchData = useCallback(() => {
        fetch("/api/admin/logistics")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                if (data.requests) {
                    setRequests(data.requests);
                    if (data.requests.length > 0) {
                        setCenter([data.requests[0].pickupLat, data.requests[0].pickupLng]);
                    }
                }
                if (data.drivers) {
                    setDrivers(data.drivers);
                    // Agar ariza yo'q bo'lsa, birinchi GPS li haydovchiga markazlash
                    if ((!data.requests || data.requests.length === 0) && data.drivers.length > 0) {
                        const gpsDriver = data.drivers.find((d: DriverGPS) => d.lastLat && d.lastLng);
                        if (gpsDriver) setCenter([gpsDriver.lastLat!, gpsDriver.lastLng!]);
                    }
                }
                setLastUpdate(new Date());
            }
        });
    }, []);

    useEffect(() => {
        fetchData();
        // Har 30 soniyada yangilash
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const routeCoords: [number, number][] = requests.map(r => [r.pickupLat, r.pickupLng]);
    const driversWithGPS = drivers.filter(d => d.lastLat && d.lastLng);

    return (
        <div className="relative z-0 space-y-3">
            {/* Statistika panel */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-100 shadow-sm">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-xs font-medium text-gray-600">Yangi arizalar: {requests.filter(r => r.status === 'new').length}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-100 shadow-sm">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium text-gray-600">Faol arizalar: {requests.filter(r => r.status !== 'new').length}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-1.5 border border-gray-100 shadow-sm">
                        <Truck size={14} className="text-indigo-500" />
                        <span className="text-xs font-medium text-gray-600">Online haydovchilar: {drivers.length} ({driversWithGPS.length} GPS)</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">{lastUpdate.toLocaleTimeString('ru-RU')}</span>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    >
                        <RefreshCw size={12} /> Yangilash
                    </button>
                </div>
            </div>

            <style jsx global>{`
                .leaflet-container {
                    width: 100%;
                    height: 600px;
                    border-radius: 0.75rem;
                    z-index: 1 !important;
                }
            `}</style>
            
            <MapContainer center={center} zoom={12} scrollWheelZoom={true}>
                <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />

                {/* Route line */}
                {routeCoords.length > 1 && (
                     <Polyline 
                        positions={routeCoords} 
                        pathOptions={{ color: '#3b82f6', weight: 4, dashArray: '10, 10', opacity: 0.6 }} 
                     />
                )}

                {/* Request markers */}
                {requests.map(req => (
                    <Marker 
                        key={`req-${req.id}`} 
                        position={[req.pickupLat, req.pickupLng]}
                        icon={createRequestIcon(req.status)}
                    >
                        <Popup className="rounded-xl">
                            <div className="p-1 min-w-[200px] font-sans">
                                <h3 className="font-bold flex items-center gap-2 border-b pb-2 mb-2 text-sm">
                                   <PackageSearch size={16} className="text-blue-500" /> #{req.id} - Jami: {req.volume || "?"} kg
                                </h3>
                                <div className="space-y-2 text-xs">
                                    <p className="flex items-center gap-2"><User size={14}/> <b>{req.name}</b></p>
                                    <p className="flex items-center gap-2"><Phone size={14}/> {req.phone}</p>
                                    <p className="flex items-center gap-2 text-gray-500"><MapPin size={14} /> {req.address || "Faqat GPS"}</p>
                                    {req.assignedDriver && (
                                        <p className="flex items-center gap-2 text-indigo-600"><Truck size={14}/> {req.assignedDriver.name}</p>
                                    )}
                                    <div className="mt-3 bg-gray-50 p-2 rounded border font-semibold text-center uppercase tracking-wider text-gray-700">
                                        Holat: {req.status === 'new' ? <span className="text-red-500">Mijoz kutyapti</span> : <span className="text-green-500">{req.status}</span>}
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Driver markers */}
                {driversWithGPS.map(drv => (
                    <Marker
                        key={`drv-${drv.id}`}
                        position={[drv.lastLat!, drv.lastLng!]}
                        icon={driverIcon}
                    >
                        <Popup className="rounded-xl">
                            <div className="p-1 min-w-[180px] font-sans">
                                <h3 className="font-bold flex items-center gap-2 border-b pb-2 mb-2 text-sm text-indigo-700">
                                    🚚 {drv.name}
                                </h3>
                                <div className="space-y-1.5 text-xs">
                                    <p className="flex items-center gap-2"><Phone size={12}/> {drv.phone}</p>
                                    <p className="flex items-center gap-2 text-gray-500">
                                        📡 {timeAgo(drv.lastSeenAt)}
                                    </p>
                                    <div className={`mt-2 text-center text-[10px] font-bold px-2 py-1 rounded ${
                                        drv.status === 'active' ? 'bg-green-50 text-green-700' :
                                        drv.status === 'on_route' ? 'bg-amber-50 text-amber-700' :
                                        'bg-gray-50 text-gray-600'
                                    }`}>
                                        {drv.status === 'active' ? '🟢 Bo\'sh' : drv.status === 'on_route' ? '🚚 Yo\'lda' : drv.status}
                                    </div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
}
