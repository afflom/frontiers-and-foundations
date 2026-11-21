import type { FoundationBanner, GearSlotId, RegionId } from './worldData';
import type {
  CoopHealEvent,
  PartySummon,
  RealmInitPayload,
  RealmSyncPayload,
  RemoteActionEvent,
  RemotePlayerState,
  RemoteWaterPosture,
  SharedEnemyState,
  WorldChatMessage,
  WorldPing,
  WorldPingKind,
} from './multiplayerTypes';
import { DEFAULT_ROOM_CODE, normalizeRoomCode } from './multiplayerState';
import { isStaticPagesHost } from '../utils/publicUrl';

export interface RealmSocketHandlers {
  onConnected: (connected: boolean) => void;
  onInit: (payload: RealmInitPayload) => void;
  onRealmSync?: (payload: RealmSyncPayload) => void;
  onPlayerUpsert: (player: RemotePlayerState) => void;
  onPlayerLeave: (playerId: string) => void;
  onPlayerAction?: (event: RemoteActionEvent) => void;
  onEnemySync?: (payload: {
    realmSlug: string;
    enemy: SharedEnemyState;
    attackerId: string;
    attackerName: string;
    killedNow: boolean;
  }) => void;
  onInteractableActivated?: (payload: {
    realmSlug: string;
    interactableId: string;
    interactableName: string;
    activatorId: string;
    activatorName: string;
  }) => void;
  onCoopHealed?: (event: CoopHealEvent) => void;
  onWorldPing?: (ping: WorldPing) => void;
  onPartySummon?: (summon: PartySummon) => void;
  onBannerPlanted: (banner: FoundationBanner) => void;
  onGuildProsperity: (prosperity: Record<string, number>) => void;
  onChatMessage: (message: WorldChatMessage) => void;
}

export interface RealmClientProfile {
  name: string;
  guildId: string;
  roomCode?: string;
  realmSlug?: string;
  realmName?: string;
}

/**
 * Real WebSocket client connecting to the server-authoritative Meridian Realm (/ws/realm).
 * Supports party room isolation, realm-scoped combat/interactable/ping synchronization,
 * co-op lantern healing, party dungeon summons, heartbeat keepalive, and exponential backoff.
 */
export class VaelmorRealmClient {
  private ws: WebSocket | null = null;
  private handlers: RealmSocketHandlers;
  private disposed = false;
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private reconnectAttempts = 0;
  private lastMoveSentAt = 0;
  private profile: {
    name: string;
    guildId: string;
    roomCode: string;
    realmSlug: string;
    realmName: string;
  };
  private lastCoords: {
    x: number;
    z: number;
    yaw: number;
    hp: number;
    maxHp: number;
    waterPosture: RemoteWaterPosture;
    activeGear: GearSlotId;
    regionId: RegionId;
  } = {
    x: 0,
    z: 17.5,
    yaw: Math.PI,
    hp: 100,
    maxHp: 100,
    waterPosture: 'dry',
    activeGear: 'hookblade',
    regionId: 'southern-terrace',
  };

  constructor(profile: RealmClientProfile, handlers: RealmSocketHandlers) {
    this.profile = {
      name: profile.name,
      guildId: profile.guildId,
      roomCode: normalizeRoomCode(profile.roomCode ?? DEFAULT_ROOM_CODE),
      realmSlug: profile.realmSlug ?? 'vaelmor',
      realmName: profile.realmName ?? 'Vaelmor Meridian',
    };
    this.handlers = handlers;
    this.connect();
  }

  private getWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/realm`;
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private connect(): void {
    if (this.disposed) return;
    if (isStaticPagesHost()) {
      this.handlers.onConnected(false);
      return;
    }
    try {
      const ws = new WebSocket(this.getWsUrl());
      this.ws = ws;

      ws.onopen = () => {
        if (this.disposed) return;
        this.reconnectAttempts = 0;
        this.handlers.onConnected(true);
        this.sendJoin();
        this.clearHeartbeat();
        this.heartbeatTimer = window.setInterval(() => {
          this.send({ type: 'ping' });
        }, 25_000);
      };

      ws.onmessage = (event) => {
        if (this.disposed) return;
        try {
          const msg = JSON.parse(String(event.data));
          switch (msg.type) {
            case 'realm:init':
              this.handlers.onInit(msg.payload as RealmInitPayload);
              break;
            case 'realm:sync':
              this.handlers.onRealmSync?.(msg.payload as RealmSyncPayload);
              break;
            case 'player:upsert':
              this.handlers.onPlayerUpsert(msg.player as RemotePlayerState);
              break;
            case 'player:leave':
              this.handlers.onPlayerLeave(String(msg.playerId));
              break;
            case 'player:action':
              if (msg.event) {
                this.handlers.onPlayerAction?.(msg.event as RemoteActionEvent);
              }
              break;
            case 'combat:enemy_sync':
              if (msg.enemy) {
                this.handlers.onEnemySync?.({
                  realmSlug: String(msg.realmSlug || 'vaelmor'),
                  enemy: msg.enemy as SharedEnemyState,
                  attackerId: String(msg.attackerId || ''),
                  attackerName: String(msg.attackerName || 'Ally'),
                  killedNow: Boolean(msg.killedNow),
                });
              }
              break;
            case 'interactable:activated':
              this.handlers.onInteractableActivated?.({
                realmSlug: String(msg.realmSlug || 'vaelmor'),
                interactableId: String(msg.interactableId || ''),
                interactableName: String(msg.interactableName || 'Waystone'),
                activatorId: String(msg.activatorId || ''),
                activatorName: String(msg.activatorName || 'Ally'),
              });
              break;
            case 'coop:healed':
              if (msg.event) {
                this.handlers.onCoopHealed?.(msg.event as CoopHealEvent);
              }
              break;
            case 'world:pinged':
              if (msg.ping) {
                this.handlers.onWorldPing?.(msg.ping as WorldPing);
              }
              break;
            case 'party:summoned':
              if (msg.summon) {
                this.handlers.onPartySummon?.(msg.summon as PartySummon);
              }
              break;
            case 'banner:planted':
              this.handlers.onBannerPlanted(msg.banner as FoundationBanner);
              break;
            case 'guild:prosperity':
              this.handlers.onGuildProsperity(msg.prosperity as Record<string, number>);
              break;
            case 'world:chat':
              this.handlers.onChatMessage(msg.message as WorldChatMessage);
              break;
            default:
              break;
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        this.clearHeartbeat();
        this.ws = null;
        this.handlers.onConnected(false);
        if (!this.disposed && this.reconnectAttempts < 6) {
          const delayMs = Math.min(30000, 3000 * Math.pow(2, this.reconnectAttempts));
          this.reconnectAttempts += 1;
          this.reconnectTimer = window.setTimeout(() => this.connect(), delayMs);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      this.handlers.onConnected(false);
    }
  }

  private sendJoin(): void {
    this.send({
      type: 'player:join',
      roomCode: this.profile.roomCode,
      realmSlug: this.profile.realmSlug,
      realmName: this.profile.realmName,
      name: this.profile.name,
      guildId: this.profile.guildId,
      ...this.lastCoords,
    });
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public getRoomCode(): string {
    return this.profile.roomCode;
  }

  public switchRoom(nextRoomCode: string): string {
    const normalized = normalizeRoomCode(nextRoomCode);
    this.profile.roomCode = normalized;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendJoin();
    } else if (!this.disposed) {
      this.reconnectAttempts = 0;
      this.connect();
    }
    return normalized;
  }

  public updateProfile(name: string, guildId: string): void {
    this.profile.name = name;
    this.profile.guildId = guildId;
    this.send({ type: 'guild:pledge', name, guildId });
  }

  public sendRealmChange(
    realmSlug: string,
    realmName: string,
    x: number,
    z: number,
    yaw: number,
  ): void {
    this.profile.realmSlug = realmSlug;
    this.profile.realmName = realmName;
    this.lastCoords = { ...this.lastCoords, x, z, yaw };
    this.send({ type: 'player:realm', realmSlug, realmName, x, z, yaw });
  }

  public sendMove(
    x: number,
    z: number,
    yaw: number,
    activeGear: GearSlotId,
    regionId: RegionId,
    hp?: number,
    maxHp?: number,
    waterPosture?: RemoteWaterPosture,
  ): void {
    this.lastCoords = {
      x,
      z,
      yaw,
      activeGear,
      regionId,
      hp: hp ?? this.lastCoords.hp,
      maxHp: maxHp ?? this.lastCoords.maxHp,
      waterPosture: waterPosture ?? this.lastCoords.waterPosture,
    };
    const now = performance.now();
    if (now - this.lastMoveSentAt < 100) return;
    this.lastMoveSentAt = now;
    this.send({
      type: 'player:move',
      realmSlug: this.profile.realmSlug,
      ...this.lastCoords,
    });
  }

  public sendAction(activeGear: GearSlotId, x?: number, z?: number, yaw?: number): void {
    this.send({
      type: 'player:action',
      activeGear,
      x: x ?? this.lastCoords.x,
      z: z ?? this.lastCoords.z,
      yaw: yaw ?? this.lastCoords.yaw,
    });
  }

  public sendEnemyDamage(payload: {
    enemyId: string;
    enemyName: string;
    archetype: string;
    damage: number;
    maxHp: number;
    realmSlug?: string;
  }): void {
    this.send({
      type: 'combat:damage',
      ...payload,
      realmSlug: payload.realmSlug ?? this.profile.realmSlug,
    });
  }

  public sendInteractableActivate(
    interactableId: string,
    interactableName: string,
    realmSlug?: string,
  ): void {
    this.send({
      type: 'interactable:activate',
      interactableId,
      interactableName,
      realmSlug: realmSlug ?? this.profile.realmSlug,
    });
  }

  public sendCoopHeal(amount: number, x: number, z: number, realmSlug?: string): void {
    this.send({
      type: 'coop:heal',
      amount,
      x,
      z,
      realmSlug: realmSlug ?? this.profile.realmSlug,
    });
  }

  public sendWorldPing(
    x: number,
    z: number,
    kind: WorldPingKind = 'rally',
    label?: string,
    realmSlug?: string,
  ): void {
    this.send({
      type: 'world:ping',
      x,
      z,
      kind,
      label,
      realmSlug: realmSlug ?? this.profile.realmSlug,
    });
  }

  public sendPartySummon(payload: {
    realmSlug: string;
    realmName: string;
    isDungeon: boolean;
    x: number;
    z: number;
    cell?: [number, number, number];
  }): void {
    this.send({
      type: 'party:summon',
      ...payload,
    });
  }

  public sendBannerPlant(banner: FoundationBanner): void {
    this.send({
      type: 'banner:plant',
      banner: { ...banner, realmSlug: banner.realmSlug ?? this.profile.realmSlug },
    });
  }

  public sendQuestCompleted(questTitle: string, guildId: string): void {
    this.send({ type: 'quest:complete', questTitle, guildId });
  }

  public sendChat(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.send({ type: 'world:chat', text: trimmed });
  }

  public dispose(): void {
    this.disposed = true;
    this.clearHeartbeat();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
