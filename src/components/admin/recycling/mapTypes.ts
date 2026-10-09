/** Admin xaritasi uchun server → client JSON ma'lumotlar */
export type MapPoint = {
  id: number;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  hex: string;
  pricePerKg: number;
  driverRatePerKg: number;
  status: 'active' | 'planned';
  isAccepting: boolean;
  supervisors: string[];
};

export type MapRequest = {
  id: number;
  name: string;
  phone: string;
  lat: number;
  lng: number;
  volume: number | null;
  material: string | null;
  status: string;
  statusLabel: string;
  hex: string;
  driver: string | null;
  point: string;
};

export type MapDriver = {
  id: number;
  name: string;
  phone: string;
  vehicle: string | null;
  lat: number;
  lng: number;
  lastSeen: string;
  status: string;
};

export type AdminMapData = { points: MapPoint[]; requests: MapRequest[]; drivers: MapDriver[] };
