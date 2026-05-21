import type { ElementType } from 'react';
import { AlertTriangle, CheckCircle, Clock, MapPin, Package, Truck, XCircle } from 'lucide-react';

export interface RecyclePoint {
    id: number;
    regionUz: string;
    regionRu: string;
    cityUz: string;
    cityRu: string;
    phone: string;
    status: string;
    color: string;
    address?: string;
    lat?: number | null;
    lng?: number | null;
    _count?: { requests: number };
    createdAt: string;
}

export interface RecycleRequest {
    id: number;
    name: string;
    phone: string;
    pointId: number;
    point?: RecyclePoint;
    material: string | null;
    volume: number | null;
    pickupType: string;
    status: string;
    address?: string | null;
    customerTgId?: string | null;
    supervisorId?: number | null;
    supervisor?: { id: number; name: string } | null;
    assignedDriverId?: number | null;
    assignedDriver?: { id: number; name: string; phone: string } | null;
    dispatchedAt?: string | null;
    assignedAt?: string | null;
    driverEnRouteAt?: string | null;
    driverArrivedAt?: string | null;
    collectedAt?: string | null;
    confirmedAt?: string | null;
    completedAt?: string | null;
    collections?: { id: number }[];
    complaints?: { id: number }[];
    createdAt: string;
}

export interface RecyclingSupervisor {
    id: number;
    name: string;
    phone: string;
    pointId: number | null;
}

export type AdminRecyclingTab =
    | 'dashboard'
    | 'map'
    | 'points'
    | 'requests'
    | 'supervisors'
    | 'drivers'
    | 'collections'
    | 'finance'
    | 'payouts'
    | 'complaints'
    | 'journal'
    | 'bot-events';

export const STATUS_COLORS: Record<string, { bg: string; text: string; icon: ElementType }> = {
    new:         { bg: 'bg-blue-100',    text: 'text-blue-700',    icon: Clock },
    dispatched:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  icon: Package },
    assigned:    { bg: 'bg-purple-100',  text: 'text-purple-700',  icon: Truck },
    en_route:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    icon: Truck },
    arrived:     { bg: 'bg-teal-100',    text: 'text-teal-700',    icon: MapPin },
    collecting:  { bg: 'bg-amber-100',   text: 'text-amber-700',   icon: Package },
    collected:   { bg: 'bg-orange-100',  text: 'text-orange-700',  icon: Package },
    confirmed:   { bg: 'bg-lime-100',    text: 'text-lime-700',    icon: CheckCircle },
    completed:   { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: CheckCircle },
    disputed:    { bg: 'bg-pink-100',    text: 'text-pink-700',    icon: AlertTriangle },
    processing:  { bg: 'bg-yellow-100',  text: 'text-yellow-700',  icon: Package },
    cancelled:   { bg: 'bg-red-100',     text: 'text-red-700',     icon: XCircle },
};

export const POINT_COLORS = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-orange-500',
    'bg-red-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
    'bg-cyan-500', 'bg-lime-500', 'bg-yellow-500', 'bg-violet-500',
];

export const STATUS_LABELS: Record<string, string> = {
    new: 'Yangi',
    dispatched: 'Yo\'naltirildi',
    assigned: 'Tayinlandi',
    en_route: 'Yo\'lda',
    arrived: 'Yetib keldi',
    collecting: 'Yig\'ilmoqda',
    collected: 'Yig\'ildi',
    confirmed: 'Tasdiqlandi',
    completed: 'Bajarildi',
    disputed: 'Bahsli',
    processing: 'Jarayonda',
    cancelled: 'Bekor',
};

export type PointFormState = {
    regionUz: string;
    regionRu: string;
    cityUz: string;
    cityRu: string;
    phone: string;
    address: string;
    lat: string;
    lng: string;
    status: string;
    color: string;
};

export const EMPTY_POINT: PointFormState = {
    regionUz: '',
    regionRu: '',
    cityUz: '',
    cityRu: '',
    phone: '',
    address: '',
    lat: '',
    lng: '',
    status: 'planned',
    color: 'bg-blue-500',
};

export function getPointName(points: RecyclePoint[], pointId: number): string {
    const point = points.find(p => p.id === pointId);
    return point ? point.regionUz : `#${pointId}`;
}

export function computeRecyclingStats(points: RecyclePoint[], requests: RecycleRequest[]) {
    return {
        totalPoints: points.length,
        activePoints: points.filter(p => p.status === 'active').length,
        totalRequests: requests.length,
        newRequests: requests.filter(r => r.status === 'new').length,
        processingRequests: requests.filter(r => r.status === 'processing').length,
        completedRequests: requests.filter(r => r.status === 'completed').length,
        totalVolume: requests.reduce((acc, r) => acc + (r.volume || 0), 0),
    };
}
