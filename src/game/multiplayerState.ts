import type { FoundationBanner } from './worldData';
import type {
  RemotePlayerState,
  SharedEnemyState,
  WorldPing,
} from './multiplayerTypes';

export const DEFAULT_ROOM_CODE = 'MERIDIAN-OPEN';
export const DEFAULT_PING_TTL_MS = 14_000;
export const COOP_HEAL_RADIUS = 12.5;
export const COOP_HEAL_RATIO = 0.75;

const ROOM_PREFIXES = ['VAEL', 'KILN', 'LOOM', 'IRON', 'SALT', 'CINDER', 'AURA', 'FROST'];
const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Sanitizes any user-entered or URL room code into a canonical uppercase token.
 * Falls back to DEFAULT_ROOM_CODE so players always land in a valid shared realm.
 */
export function normalizeRoomCode(raw?: string | null): string {
  if (!raw) return DEFAULT_ROOM_CODE;
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 18);
  return cleaned.length >= 3 ? cleaned : DEFAULT_ROOM_CODE;
}

export function normalizeCallsign(raw?: string | null, fallback = 'Waywright'): string {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 24);
  return cleaned.length >= 2 ? cleaned : fallback;
}

export function generatePrivateRoomCode(seedRand: () => number = Math.random): string {
  const prefix = ROOM_PREFIXES[Math.floor(seedRand() * ROOM_PREFIXES.length) % ROOM_PREFIXES.length];
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += ROOM_CHARS[Math.floor(seedRand() * ROOM_CHARS.length) % ROOM_CHARS.length];
  }
  return `${prefix}-${suffix}`;
}

export function parseRoomCodeFromSearch(search: string): { roomCode: string; invited: boolean } {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get('room');
    if (!raw || !raw.trim()) {
      return { roomCode: DEFAULT_ROOM_CODE, invited: false };
    }
    const normalized = normalizeRoomCode(raw);
    return { roomCode: normalized, invited: true };
  } catch {
    return { roomCode: DEFAULT_ROOM_CODE, invited: false };
  }
}

export function parseCallsignFromSearch(search: string): string | null {
  try {
    const params = new URLSearchParams(search);
    const raw = params.get('name');
    if (!raw || !raw.trim()) return null;
    return normalizeCallsign(raw, 'Waywright');
  } catch {
    return null;
  }
}

export function buildInviteUrl(origin: string, pathname: string, roomCode: string): string {
  const code = normalizeRoomCode(roomCode);
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${cleanOrigin}${cleanPath}?room=${encodeURIComponent(code)}`;
}

export function filterSameRealmPlayers(
  players: RemotePlayerState[],
  realmSlug: string,
): RemotePlayerState[] {
  return players.filter((p) => (p.realmSlug || 'vaelmor') === realmSlug);
}

export function filterSameRealmBanners(
  banners: FoundationBanner[],
  realmSlug: string,
): FoundationBanner[] {
  return banners.filter((b) => (b.realmSlug || 'vaelmor') === realmSlug);
}

export interface RemoteVisualPose {
  x: number;
  z: number;
  yaw: number;
  speed: number;
}

function shortestYawDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * Smoothly interpolates remote Waywright position, yaw, and derived locomotion speed
 * so 3D allies glide and stride naturally between 120ms network snapshots.
 */
export function interpolateRemotePlayer(
  current: RemoteVisualPose | undefined,
  target: { x: number; z: number; yaw: number },
  dt: number,
): RemoteVisualPose {
  if (!current) {
    return { x: target.x, z: target.z, yaw: target.yaw, speed: 0 };
  }
  const dist = Math.hypot(target.x - current.x, target.z - current.z);
  // Snap immediately on large teleports or fast-travel jumps (> 14m)
  if (dist > 14.0) {
    return { x: target.x, z: target.z, yaw: target.yaw, speed: 0 };
  }
  const safeDt = Math.max(0.004, Math.min(0.1, dt));
  const alpha = 1 - Math.exp(-11.5 * safeDt);
  const nextX = current.x + (target.x - current.x) * alpha;
  const nextZ = current.z + (target.z - current.z) * alpha;
  const nextYaw = current.yaw + shortestYawDelta(current.yaw, target.yaw) * (1 - Math.exp(-13.0 * safeDt));
  const instSpeed = Math.hypot(nextX - current.x, nextZ - current.z) / safeDt;
  const smoothedSpeed = current.speed * 0.72 + Math.min(9.5, instSpeed) * 0.28;
  return {
    x: nextX,
    z: nextZ,
    yaw: nextYaw,
    speed: smoothedSpeed < 0.08 ? 0 : smoothedSpeed,
  };
}

/**
 * Server-authoritative shared enemy damage reducer.
 * Idempotently clamps HP to [0, maxHp] and flags whether this exact hit felled the foe.
 */
export function applyAuthoritativeEnemyDamage(
  enemies: Map<string, SharedEnemyState>,
  enemyId: string,
  damage: number,
  maxHp: number,
  attackerName: string,
  now: number,
): { state: SharedEnemyState; killedNow: boolean } {
  const safeMax = Math.max(1, Math.round(maxHp));
  const safeDmg = Math.max(1, Math.min(safeMax * 2, Math.round(damage)));
  const existing = enemies.get(enemyId);
  const prevHp = existing ? existing.hp : safeMax;
  const wasDefeated = existing ? existing.defeated : false;
  const nextHp = wasDefeated ? 0 : Math.max(0, prevHp - safeDmg);
  const defeated = wasDefeated || nextHp <= 0;
  const killedNow = !wasDefeated && defeated;

  const nextState: SharedEnemyState = {
    id: enemyId,
    hp: nextHp,
    maxHp: Math.max(safeMax, existing?.maxHp ?? safeMax),
    defeated,
    lastHitBy: attackerName,
    lastHitAt: now,
  };
  enemies.set(enemyId, nextState);
  return { state: nextState, killedNow };
}

/**
 * Determines which allies in the same realm are within Mortar Lantern co-op healing range.
 */
export function computeCoopHealRecipients<
  T extends { id: string; realmSlug?: string; x: number; z: number },
>(
  healer: { id: string; realmSlug: string; x: number; z: number },
  peers: T[],
  radius = COOP_HEAL_RADIUS,
): T[] {
  const r2 = radius * radius;
  return peers.filter((p) => {
    if (p.id === healer.id) return false;
    if ((p.realmSlug || 'vaelmor') !== healer.realmSlug) return false;
    const dx = p.x - healer.x;
    const dz = p.z - healer.z;
    return dx * dx + dz * dz <= r2;
  });
}

export function computeCoopHealAmount(casterHealAmount: number): number {
  return Math.max(12, Math.round(casterHealAmount * COOP_HEAL_RATIO));
}

export function mergeWorldPing(
  existing: WorldPing[],
  incoming: WorldPing,
  now = Date.now(),
): WorldPing[] {
  const active = existing.filter((p) => p.expiresAt > now && p.id !== incoming.id);
  if (incoming.expiresAt <= now) return active;
  // Keep at most one active ping per sender so beacons never spam the scene
  const dedupSender = active.filter((p) => p.senderId !== incoming.senderId);
  return [...dedupSender, incoming].slice(-12);
}

export function pruneExpiredPings(pings: WorldPing[], now = Date.now()): WorldPing[] {
  const next = pings.filter((p) => p.expiresAt > now);
  return next.length === pings.length ? pings : next;
}

/**
 * Projects a 3D world-space coordinate through a column-major 4x4 WebGL MVP matrix
 * into CSS viewport pixel coordinates for crisp floating ally nameplates.
 */
export function projectWorldToScreen(
  worldPos: [number, number, number],
  mvp: ArrayLike<number>,
  viewportWidth: number,
  viewportHeight: number,
): { screenX: number; screenY: number; visible: boolean } {
  const [x, y, z] = worldPos;
  const clipX = mvp[0] * x + mvp[4] * y + mvp[8] * z + mvp[12];
  const clipY = mvp[1] * x + mvp[5] * y + mvp[9] * z + mvp[13];
  const clipZ = mvp[2] * x + mvp[6] * y + mvp[10] * z + mvp[14];
  const clipW = mvp[3] * x + mvp[7] * y + mvp[11] * z + mvp[15];

  if (clipW <= 0.15) {
    return { screenX: -999, screenY: -999, visible: false };
  }
  const ndcX = clipX / clipW;
  const ndcY = clipY / clipW;
  const ndcZ = clipZ / clipW;
  const inFrustum = ndcX >= -1.08 && ndcX <= 1.08 && ndcY >= -1.08 && ndcY <= 1.08 && ndcZ >= -1 && ndcZ <= 1;
  return {
    screenX: (ndcX * 0.5 + 0.5) * viewportWidth,
    screenY: (0.5 - ndcY * 0.5) * viewportHeight,
    visible: inFrustum,
  };
}
