'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapPin, Navigation, Loader2, X, Check } from 'lucide-react';
import type { Language } from '@/lib/translations';

// Leaflet CSS import qilinadi
import 'leaflet/dist/leaflet.css';

export interface LocationData {
    lat: number;
    lng: number;
    address?: string;
}

interface LocationPickerProps {
    language: Language;
    onLocationSelect: (location: LocationData) => void;
    initialLocation?: LocationData | null;
}

// ─── UI matnlari ────────────────────────────────────────────────
const T: Record<string, Partial<Record<Language, string>>> = {
    detectBtn: {
        uz: '📍 Joylashuvni aniqlash',
        ru: '📍 Определить местоположение',
        en: '📍 Detect my location',
        qr: '📍 Joylashuvdı anıqlaw',
        zh: '📍 检测位置',
        tr: '📍 Konumumu belirle',
        tg: '📍 Ҷойгиршавиро муайян кунед',
        kk: '📍 Орнымды анықтау',
        tk: '📍 Ýerleşişimi kesgitle',
        fa: '📍 مکان من را شناسایی کن',
    },
    detecting: {
        uz: 'Aniqlanmoqda...',
        ru: 'Определяется...',
        en: 'Detecting...',
        qr: 'Anıqlanmoqda...',
        zh: '检测中...',
        tr: 'Belirleniyor...',
        tg: 'Муайян шуда истодааст...',
        kk: 'Анықталуда...',
        tk: 'Kesgitlenýär...',
        fa: 'در حال شناسایی...',
    },
    mapHint: {
        uz: '🗺️ Xaritada aniq joyni belgilang',
        ru: '🗺️ Укажите точное место на карте',
        en: '🗺️ Click on the map to mark your location',
        qr: '🗺️ Xaritada anıq joydı belgilań',
        zh: '🗺️ 在地图上标记位置',
        tr: '🗺️ Haritada tam konumu işaretleyin',
        tg: '📍 Дар харита ҷойи дақиқро ишора кунед',
        kk: '🗺️ Картада нақты орынды белгілеңіз',
        tk: '🗺️ Kartada anyk ýerini belläň',
        fa: '🗺️ مکان دقیق را روی نقشه مشخص کنید',
    },
    confirmed: {
        uz: '✅ Joylashuv belgilandi',
        ru: '✅ Местоположение указано',
        en: '✅ Location confirmed',
        qr: '✅ Joylashuw belgilendi',
        zh: '✅ 位置已确认',
        tr: '✅ Konum belirlendi',
        tg: '✅ Ҷойгиршавӣ тасдиқ шуд',
        kk: '✅ Орналасуы белгіленді',
        tk: '✅ Ýerleşiş tassyklandy',
        fa: '✅ مکان تأیید شد',
    },
    errorDenied: {
        uz: 'Joylashuv ruxsati berilmagan. Xaritadan tanlang.',
        ru: 'Доступ к геолокации запрещён. Выберите на карте.',
        en: 'Location access denied. Please select on map.',
        qr: 'Joylashuw ruxsatı berilmegen.',
        zh: '位置访问被拒绝。',
        tr: 'Konum erişimi reddedildi.',
        tg: 'Иҷозати ҷойгиршавӣ дода нашуд.',
        kk: 'Геолокацияға рұқсат жоқ.',
        tk: 'Ýerleşiş rugsady berilmedi.',
        fa: 'دسترسی مکان رد شد.',
    },
    removeMarker: {
        uz: 'Markerni olib tashlash',
        ru: 'Убрать маркер',
        en: 'Remove marker',
        qr: 'Markerdı alıw',
        zh: '移除标记',
        tr: 'İşareti kaldır',
        tg: 'Маркерро нест кунед',
        kk: 'Маркерді алып тастау',
        tk: 'Belligi aýyr',
        fa: 'حذف نشانگر',
    },
};

const tl = (key: string, lang: Language): string =>
    T[key]?.[lang] ?? T[key]?.['en'] ?? key;

// ─── Tashkent markazi ────────────────────────────────────────────
const DEFAULT_CENTER: [number, number] = [41.299496, 69.240073];
const DEFAULT_ZOOM = 12;
const MARKER_ZOOM = 16;

export default function LocationPicker({
    language,
    onLocationSelect,
    initialLocation,
}: LocationPickerProps) {
    const [detecting, setDetecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(
        initialLocation ?? null
    );
    const [mapReady, setMapReady] = useState(false);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const leafletRef = useRef<typeof import('leaflet') | null>(null);

    // ── Leaflet'ni faqat client-side lazy load qilish ──
    const initMap = useCallback(async () => {
        if (mapRef.current || !mapContainerRef.current) return;

        const L = await import('leaflet');
        leafletRef.current = L;

        // Default marker icon fix (Webpack bilan conflict)
        const DefaultIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
        });
        L.Marker.prototype.options.icon = DefaultIcon;

        const center = initialLocation
            ? [initialLocation.lat, initialLocation.lng] as [number, number]
            : DEFAULT_CENTER;

        const map = L.map(mapContainerRef.current, {
            center,
            zoom: initialLocation ? MARKER_ZOOM : DEFAULT_ZOOM,
            zoomControl: true,
            attributionControl: false,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap',
        }).addTo(map);

        // Agar initial location bor bo'lsa marker qo'yish
        if (initialLocation) {
            markerRef.current = L.marker([initialLocation.lat, initialLocation.lng], {
                draggable: true,
            }).addTo(map);
            setupMarkerDrag(markerRef.current);
        }

        // Xaritaga bosish — marker qo'yish
        map.on('click', (e: L.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            placeMarker(lat, lng, map, L);
        });

        mapRef.current = map;
        setMapReady(true);

        // Map resize fix
        setTimeout(() => map.invalidateSize(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialLocation]);

    useEffect(() => {
        initMap();
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [initMap]);

    // ── Marker qo'yish ──
    const placeMarker = useCallback((lat: number, lng: number, map?: L.Map, L?: typeof import('leaflet')) => {
        const m = map ?? mapRef.current;
        const lib = L ?? leafletRef.current;
        if (!m || !lib) return;

        // Eski markerni olib tashlash
        if (markerRef.current) {
            m.removeLayer(markerRef.current);
        }

        const marker = lib.marker([lat, lng], { draggable: true }).addTo(m);
        markerRef.current = marker;
        setupMarkerDrag(marker);

        const loc: LocationData = { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
        setSelectedLocation(loc);
        onLocationSelect(loc);

        m.setView([lat, lng], Math.max(m.getZoom(), MARKER_ZOOM), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onLocationSelect]);

    const setupMarkerDrag = (marker: L.Marker) => {
        marker.on('dragend', () => {
            const pos = marker.getLatLng();
            const loc: LocationData = { lat: +pos.lat.toFixed(6), lng: +pos.lng.toFixed(6) };
            setSelectedLocation(loc);
            onLocationSelect(loc);
        });
    };

    // ── GPS geolokatsiya ──
    const handleDetectLocation = useCallback(() => {
        if (!navigator.geolocation) {
            setError(tl('errorDenied', language));
            return;
        }

        setDetecting(true);
        setError(null);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                placeMarker(latitude, longitude);
                setDetecting(false);
            },
            (err) => {
                setDetecting(false);
                if (err.code === err.PERMISSION_DENIED) {
                    setError(tl('errorDenied', language));
                } else {
                    setError(tl('errorDenied', language));
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, [language, placeMarker]);

    // ── Markerni olib tashlash ──
    const handleRemoveMarker = useCallback(() => {
        if (markerRef.current && mapRef.current) {
            mapRef.current.removeLayer(markerRef.current);
            markerRef.current = null;
        }
        setSelectedLocation(null);
        onLocationSelect({ lat: 0, lng: 0 });
    }, [onLocationSelect]);

    return (
        <div className="space-y-3">
            {/* GPS tugmasi */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={handleDetectLocation}
                    disabled={detecting}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                >
                    {detecting ? (
                        <Loader2 size={15} className="animate-spin" />
                    ) : (
                        <Navigation size={15} />
                    )}
                    {detecting ? tl('detecting', language) : tl('detectBtn', language)}
                </button>

                {selectedLocation && selectedLocation.lat !== 0 && (
                    <>
                        <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg">
                            <Check size={13} />
                            {tl('confirmed', language)}
                        </span>
                        <button
                            type="button"
                            onClick={handleRemoveMarker}
                            className="flex items-center gap-1 text-red-500 hover:text-red-600 text-xs font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            <X size={13} />
                            {tl('removeMarker', language)}
                        </button>
                    </>
                )}
            </div>

            {/* Xato xabari */}
            {error && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                    ⚠️ {error}
                </p>
            )}

            {/* Xarita */}
            <div className="relative">
                <div
                    ref={mapContainerRef}
                    className="w-full h-[260px] rounded-2xl border-2 border-gray-200 overflow-hidden bg-gray-100 z-0 relative"
                />

                {/* Xarita ustidagi hint */}
                {!selectedLocation && mapReady && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-sm shadow-lg border border-gray-200 px-4 py-2 rounded-xl">
                        <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
                            <MapPin size={13} className="text-blue-500" />
                            {tl('mapHint', language)}
                        </p>
                    </div>
                )}

                {/* Koordinata ko'rsatkichi */}
                {selectedLocation && selectedLocation.lat !== 0 && (
                    <div className="absolute bottom-3 left-3 z-[1000] bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg">
                        <p className="text-[10px] font-mono">
                            {selectedLocation.lat}, {selectedLocation.lng}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
