import type { FoundationBanner, GearSlotId, RegionId } from './worldData';
import type {
  RealmInitPayload,
  RemotePlayerState,
  WorldChatMessage,
} from './multiplayerTypes';

export interface RealmSocketHandlers {
  onConnected: (connected: boolean) => void;
  onInit: (payload: RealmInitPayload) => void;
  onPlayerUpsert: (player: RemotePlayerState) => void;
  onPlayerLeave: (playerId: string) => void;
  onBannerPlanted: (banner: FoundationBanner) => void;
  onGuildProsperity: (prosperity: Record<string, number>) => void;
  onChatMessage: (message: WorldChatMessage) => void;
}

/**
 * Real WebSocket client connecting to the server-authoritative Vaelmor Realm (/ws/realm).
 * Handles automatic reconnection, throttled movement sync, and clean teardown.
 */
export class VaelmorRealmClient {
  private ws: WebSocket | null = null;
  private handlers: RealmSocketHandlers;
  private disposed = false;
  private reconnectTimer: number | null = null;
  private lastMoveSentAt = 0;
  private profile: { name: string; guildId: string };
  private lastCoords: { x: number; z: number; yaw: number; activeGear: GearSlotId; regionId: RegionId } = {
    x: 0,
    z: 17.5,
    yaw: Math.PI,
    activeGear: 'hookblade',
    regionId: 'southern-terrace',
  };

  constructor(profile: { name: string; guildId: string }, handlers: RealmSocketHandlers) {
    this.profile = profile;
    this.handlers = handlers;
    this.connect();
  }

  private getWsUrl(): string {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws/realm`;
  }

  private connect(): void {
    if (this.disposed) return;
    try {
      const ws = new WebSocket(this.getWsUrl());
      this.ws = ws;

      ws.onopen = () => {
        if (this.disposed) return;
        this.handlers.onConnected(true);
        this.send({
          type: 'player:join',
          name: this.profile.name,
          guildId: this.profile.guildId,
          ...this.lastCoords,
        });
      };

      ws.onmessage = (event) => {
        if (this.disposed) return;
        try {
          const msg = JSON.parse(String(event.data));
          switch (msg.type) {
            case 'realm:init':
              this.handlers.onInit(msg.payload as RealmInitPayload);
              break;
            case 'player:upsert':
              this.handlers.onPlayerUpsert(msg.player as RemotePlayerState);
              break;
            case 'player:leave':
              this.handlers.onPlayerLeave(String(msg.playerId));
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
        this.ws = null;
        this.handlers.onConnected(false);
        if (!this.disposed) {
          this.reconnectTimer = window.setTimeout(() => this.connect(), 2400);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      this.handlers.onConnected(false);
    }
  }

  private send(payload: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public updateProfile(name: string, guildId: string): void {
    this.profile = { name, guildId };
    this.send({ type: 'guild:pledge', name, guildId });
  }

  public sendMove(
    x: number,
    z: number,
    yaw: number,
    activeGear: GearSlotId,
    regionId: RegionId,
  ): void {
    this.lastCoords = { x, z, yaw, activeGear, regionId };
    const now = performance.now();
    if (now - this.lastMoveSentAt < 120) return;
    this.lastMoveSentAt = now;
    this.send({ type: 'player:move', x, z, yaw, activeGear, regionId });
  }

  public sendAction(activeGear: GearSlotId): void {
    this.send({ type: 'player:action', activeGear });
  }

  public sendBannerPlant(banner: FoundationBanner): void {
    this.send({ type: 'banner:plant', banner });
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
