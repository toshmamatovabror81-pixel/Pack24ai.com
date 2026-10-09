import L from 'leaflet';

/** Rasm fayllarsiz (bundler yo'li muammosiz) belgilar: divIcon */

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
export const esc = escapeHtml;

/** Punkt: rangli "pin" */
export function pinIcon(hex: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${hex};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"><div style="position:absolute;inset:7px;border-radius:50%;background:#fff;opacity:.9"></div></div>`,
  });
}

/** Haydovchi: yuk mashinasi belgisi */
export function truckIcon(active: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
    html: `<div style="width:34px;height:34px;border-radius:50%;background:${active ? '#0f172a' : '#64748b'};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1">🚛</div>`,
  });
}
