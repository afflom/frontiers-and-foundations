import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { auditAntiTropeNovelty } from './src/engine/cognitiveNovelty.ts';
import { VerdantMcpHost, VERDANT_MCP_TOOLS } from './src/verdant/verdantMcpHost.ts';
import type { DungeonArchitecturalStyle, RealmThemeId } from './src/verdant/realmModelSchema.ts';
import type { MusicalModeId } from './src/verdant/verdantScoreSchema.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Real headless verdant-uorc.wasm-backed Model-Centric MCP Host
const verdantMcp = new VerdantMcpHost(process.cwd());

async function generateStructuredContent(params: {
  category: 'npc' | 'item' | 'quest' | 'biome' | 'guild_event' | 'dialogue';
  prompt: string;
  existingTitles?: string[];
  bannedTropes?: string[];
  usedMotifs?: string[];
  npcContext?: {
    name: string;
    epithet: string;
    faction: string;
    cognitiveDrive: string;
    concealedSecret: string;
    speechCadence: string;
    beliefGraph: string[];
  };
}) {
  const ai = createGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in server secrets. Configure GEMINI_API_KEY in Settings > Secrets to run autonomous Gemini synthesis.',
    );
  }

  const bannedList = (params.bannedTropes ?? []).join(', ');
  const usedList = (params.usedMotifs ?? []).join(', ');
  const existingList = (params.existingTitles ?? []).join(', ');

  const worldBible = `You are the autonomous cognitive director for "Frontiers and Foundations", a bespoke 3D open-world fantasy RPG built on Verdant Studio and the Verdant Stitch network.
Setting: The Shattered Meridian of Vaelmor — divided between monolithic basalt masonry Foundations and shifting living Frontiers (Ironwood Reaches, Salt Loom Archipelago, Cinder Fen Basin).
Strict constraints:
1. NEVER use default verdant-studio content (no Sunspire, Observatory, Glasshouse, Starfall, Explorer/Archivist).
2. NEVER use banned clichés: ${bannedList || 'amnesiac chosen one, dark lord, prophecy scroll, tavern rats'}.
3. NEVER repeat already-used motifs: ${usedList || 'none'}.
4. NEVER duplicate existing names: ${existingList || 'none'}.
5. Ground every idea in practical craft, civic engineering, ecology, acoustics, geology, or federated guild diplomacy.`;

  if (params.category === 'dialogue' && params.npcContext) {
    const npc = params.npcContext;
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Player says to ${npc.name}: "${params.prompt}"`,
      config: {
        systemInstruction: `${worldBible}
Roleplay authentically as ${npc.name} (${npc.epithet}, faction: ${npc.faction}).
Drive: ${npc.cognitiveDrive}
Concealed secret (hint subtly, never blurt out): ${npc.concealedSecret}
Speech cadence: ${npc.speechCadence}
Beliefs: ${npc.beliefGraph.join(' | ')}
Respond in JSON with an in-character spoken reply (2-4 crisp sentences), an internal cognitive state note, a trust shift (-10 to +10), and 2 grounded follow-up player prompts.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            cognitiveThought: { type: Type.STRING },
            trustDelta: { type: Type.INTEGER },
            suggestedFollowUps: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['reply', 'cognitiveThought', 'trustDelta', 'suggestedFollowUps'],
        },
      },
    });
    return JSON.parse((response.text ?? '{}').trim());
  }

  if (params.category === 'npc') {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Design a brand-new, memorable, non-cliché NPC for Frontiers and Foundations matching this brief: ${params.prompt}`,
      config: {
        systemInstruction: worldBible,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            epithet: { type: Type.STRING },
            faction: { type: Type.STRING },
            sectorId: { type: Type.STRING },
            cognitiveDrive: { type: Type.STRING },
            concealedSecret: { type: Type.STRING },
            speechCadence: { type: Type.STRING },
            beliefGraph: { type: Type.ARRAY, items: { type: Type.STRING } },
            antiTropeTags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'name',
            'epithet',
            'faction',
            'sectorId',
            'cognitiveDrive',
            'concealedSecret',
            'speechCadence',
            'beliefGraph',
            'antiTropeTags',
          ],
        },
      },
    });
    return JSON.parse((response.text ?? '{}').trim());
  }

  if (params.category === 'item') {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Design a practical, fun, utility-first weapon, survey relic, or instrument for Frontiers and Foundations matching this brief: ${params.prompt}`,
      config: {
        systemInstruction: worldBible,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            rarity: { type: Type.STRING },
            primaryFunction: { type: Type.STRING },
            frontierSynergy: { type: Type.STRING },
            materialFinish: { type: Type.STRING },
            weightKg: { type: Type.NUMBER },
            resonanceHz: { type: Type.INTEGER },
            craftedBy: { type: Type.STRING },
          },
          required: [
            'name',
            'category',
            'rarity',
            'primaryFunction',
            'frontierSynergy',
            'materialFinish',
            'weightKg',
            'resonanceHz',
            'craftedBy',
          ],
        },
      },
    });
    return JSON.parse((response.text ?? '{}').trim());
  }

  if (params.category === 'quest') {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Design a fresh, non-cliché StoryAutomaton chapter node for Frontiers and Foundations matching this brief: ${params.prompt}`,
      config: {
        systemInstruction: worldBible,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            act: { type: Type.INTEGER },
            sectorId: { type: Type.STRING },
            summary: { type: Type.STRING },
            motif: { type: Type.STRING },
            edgeConditionFromOrigin: { type: Type.STRING },
            edgeConditionToResolution: { type: Type.STRING },
          },
          required: [
            'title',
            'act',
            'sectorId',
            'summary',
            'motif',
            'edgeConditionFromOrigin',
            'edgeConditionToResolution',
          ],
        },
      },
    });
    return JSON.parse((response.text ?? '{}').trim());
  }

  // biome or guild_event
  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Design a bespoke ${params.category} for Frontiers and Foundations matching this brief: ${params.prompt}`,
    config: {
      systemInstruction: worldBible,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          charterDomain: { type: Type.STRING },
          homeSectorId: { type: Type.STRING },
          currentExpedition: { type: Type.STRING },
          custodyPolicy: { type: Type.STRING },
          activeMembers: { type: Type.INTEGER },
          federatedNodes: { type: Type.INTEGER },
        },
        required: [
          'name',
          'charterDomain',
          'homeSectorId',
          'currentExpedition',
          'custodyPolicy',
          'activeMembers',
          'federatedNodes',
        ],
      },
    },
  });
  return JSON.parse((response.text ?? '{}').trim());
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  void verdantMcp.ensureReady().catch((err) => {
    console.warn('[VerdantMcpHost] Deferred initialization warning:', err);
  });

  app.get('/api/verdant/health', async (_req, res) => {
    const realms = await verdantMcp.listRealms().catch(() => []);
    res.json({
      ok: true,
      project: 'frontiers-and-foundations',
      engineOrigin: 'github.com/afflom/verdant-engine',
      wasmMcpActive: true,
      mcpTools: VERDANT_MCP_TOOLS.length,
      realmsCount: realms.length,
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  // Federated Meridian Realms & 3D Dungeons Directory
  app.get('/api/verdant/realms', async (_req, res) => {
    try {
      const realms = await verdantMcp.listRealms();
      const overworldRealms = realms.filter((r) => !r.isDungeon);
      const dungeons = realms.filter((r) => Boolean(r.isDungeon));
      res.json({ ok: true, realms, overworldRealms, dungeons });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to list Verdant Realms.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Automated Verdant Model-Centric Realm Generator (imports external CC0 3D models + PBR + HDRI + Stitch + Prism)
  app.post('/api/verdant/realms/generate', async (req, res) => {
    try {
      const { name, cell, theme, brief } = req.body ?? {};
      const cleanName = String(name ?? '').trim();
      if (!cleanName || cleanName.length < 3) {
        res.status(400).json({ ok: false, error: 'Please provide a Realm name (at least 3 characters).' });
        return;
      }
      const parsedCell =
        Array.isArray(cell) && cell.length === 3
          ? ([Number(cell[0]) || 0, Number(cell[1]) || 0, Number(cell[2]) || 0] as [number, number, number])
          : undefined;
      const validThemes: RealmThemeId[] = [
        'citadel-highlands',
        'sunken-aqueducts',
        'obsidian-crucible',
        'pelagic-spires',
        'amber-steppe',
        'glacial-spire',
      ];
      const cleanTheme = validThemes.includes(theme) ? (theme as RealmThemeId) : undefined;
      const result = await verdantMcp.generateNewRealm({
        name: cleanName,
        cell: parsedCell,
        theme: cleanTheme,
        brief: typeof brief === 'string' ? brief : undefined,
        ai: createGeminiClient(),
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compile Frontier Realm.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Automated 3D Dungeon Delve Compiler
  app.post('/api/verdant/dungeons/generate', async (req, res) => {
    try {
      const { name, parentRealmSlug, style, tier, brief } = req.body ?? {};
      const cleanName = String(name ?? '').trim();
      if (!cleanName || cleanName.length < 3) {
        res.status(400).json({ ok: false, error: 'Please provide a Dungeon name (at least 3 characters).' });
        return;
      }
      const validStyles: DungeonArchitecturalStyle[] = [
        'catacomb-vault',
        'geothermal-depths',
        'sunken-cistern',
        'glacial-crypt',
      ];
      const cleanStyle = validStyles.includes(style) ? (style as DungeonArchitecturalStyle) : 'catacomb-vault';
      const cleanTier = Math.max(1, Math.min(5, Number(tier) || 2));
      const result = await verdantMcp.generateNewDungeon({
        name: cleanName,
        parentRealmSlug: typeof parentRealmSlug === 'string' ? parentRealmSlug : 'vaelmor',
        style: cleanStyle,
        tier: cleanTier,
        brief: typeof brief === 'string' ? brief : undefined,
        ai: createGeminiClient(),
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compile 3D Dungeon Delve.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Model-Centric Orchestral Score Composer (registers MusicComposition Project Model in Wasm)
  app.post('/api/verdant/scores/compose', async (req, res) => {
    try {
      const { realmSlug, brief, mode, bpm } = req.body ?? {};
      const validModes: MusicalModeId[] = [
        'dorian',
        'lydian',
        'phrygian-dominant',
        'mixolydian',
        'aeolian',
        'harmonic-minor',
        'pentatonic-major',
      ];
      const result = await verdantMcp.composeSoundtrack({
        realmSlug: typeof realmSlug === 'string' ? realmSlug : 'vaelmor',
        brief: typeof brief === 'string' ? brief : undefined,
        mode: validModes.includes(mode) ? (mode as MusicalModeId) : undefined,
        bpm: typeof bpm === 'number' ? bpm : undefined,
        ai: createGeminiClient(),
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to compose orchestral score.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Multi-Stage Anti-Trope Questline Synthesizer
  app.post('/api/verdant/questlines/generate', async (req, res) => {
    try {
      const { realmSlug, brief } = req.body ?? {};
      const result = await verdantMcp.generateQuestline({
        realmSlug: typeof realmSlug === 'string' ? realmSlug : 'vaelmor',
        brief: typeof brief === 'string' ? brief : undefined,
        ai: createGeminiClient(),
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to synthesize questline.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Autonomous World Frontier Expansion Orchestrator (Realm + Linked Dungeon + Score + Questline)
  app.post('/api/verdant/world/expand', async (req, res) => {
    try {
      const { name, theme, brief } = req.body ?? {};
      const cleanName = String(name ?? '').trim();
      if (!cleanName || cleanName.length < 3) {
        res.status(400).json({ ok: false, error: 'Please provide a Frontier name (at least 3 characters).' });
        return;
      }
      const result = await verdantMcp.expandWorldFrontier({
        name: cleanName,
        theme: theme as RealmThemeId | undefined,
        brief: typeof brief === 'string' ? brief : undefined,
        ai: createGeminiClient(),
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'World frontier expansion failed.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Live External CC0 3D Asset Catalog Search (Poly Haven models / textures / HDRIs)
  app.get('/api/verdant/catalog/search', async (req, res) => {
    try {
      const q = String(req.query.q ?? '');
      const rawType = String(req.query.type ?? 'models');
      const assetType =
        rawType === 'textures' || rawType === 'hdris' ? rawType : 'models';
      const limit = Number(req.query.limit) || 12;
      const result = await verdantMcp.searchExternalCatalog(q, assetType, limit);
      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Catalog search failed.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // In-game emergent frontier quest synthesis (anti-trope guarded behind the scenes)
  app.post('/api/game/emergent-quest', async (req, res) => {
    try {
      const { existingTitles, usedMotifs, bannedTropes, playerGuild } = req.body ?? {};
      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          ok: false,
          error: 'Dynamic world narrator requires GEMINI_API_KEY in server secrets.',
        });
        return;
      }
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Generate one brand-new, captivating open-world frontier quest for a Waywright allied with ${String(playerGuild || 'Charter of the Southern Causeway')} in the Shattered Meridian of Vaelmor.
Avoid all banned clichés (${(bannedTropes ?? []).join(', ')}) and never repeat these used motifs (${(usedMotifs ?? []).join(', ')}) or existing quest titles (${(existingTitles ?? []).join(', ')}).
Return JSON with: title, regionId (one of high-causeway, ironwood-reaches, ashen-kiln, salt-loom), summary (2 crisp sentences), motif (3-5 words), targetName (a specific frontier landmark or resonant cairn), objectiveDescription, and renownReward (integer 100-220).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              regionId: { type: Type.STRING },
              summary: { type: Type.STRING },
              motif: { type: Type.STRING },
              targetName: { type: Type.STRING },
              objectiveDescription: { type: Type.STRING },
              renownReward: { type: Type.INTEGER },
            },
            required: [
              'title',
              'regionId',
              'summary',
              'motif',
              'targetName',
              'objectiveDescription',
              'renownReward',
            ],
          },
        },
      });
      const data = JSON.parse((response.text ?? '{}').trim());
      res.json({ ok: true, quest: data });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to generate emergent frontier quest.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // In-game emergent relic forge (anti-trope crafted relics with mechanical combat bonuses)
  app.post('/api/game/forge-relic', async (req, res) => {
    try {
      const { existingNames, bannedTropes, playerGuild, regionName } = req.body ?? {};
      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          ok: false,
          error: 'Arcane Relic Forge requires GEMINI_API_KEY in server secrets.',
        });
        return;
      }
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Forge one practical, non-cliché survey relic or craftsman talisman for a Waywright of ${String(
          playerGuild || 'Charter of the Southern Causeway',
        )} forged in ${String(regionName || 'High Basalt Citadel')} of Vaelmor.
Avoid banned tropes (${(bannedTropes ?? []).join(', ')}) and never duplicate existing names (${(
          existingNames ?? []
        ).join(', ')}).
Return JSON with: name, origin (short region or guild phrase), description (1-2 crisp sentences grounded in geology, acoustics, or silicate craft), bonusKind (one of maxHp, damagePct, speedPct, staminaRegenPct, healPower), and bonusValue (integer: 15-30 for maxHp, 10-20 for damagePct/speedPct/staminaRegenPct, 12-22 for healPower).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              origin: { type: Type.STRING },
              description: { type: Type.STRING },
              bonusKind: { type: Type.STRING },
              bonusValue: { type: Type.INTEGER },
            },
            required: ['name', 'origin', 'description', 'bonusKind', 'bonusValue'],
          },
        },
      });
      const relic = JSON.parse((response.text ?? '{}').trim());
      res.json({ ok: true, relic });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to forge emergent relic.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Autonomous cognitive synthesis endpoint
  app.post('/api/verdant/generate', async (req, res) => {
    try {
      const { category, prompt, existingTitles, bannedTropes, usedMotifs, npcContext } = req.body ?? {};
      if (!category || !prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Both category and a non-empty prompt are required.' });
        return;
      }
      const data = await generateStructuredContent({
        category,
        prompt: prompt.trim(),
        existingTitles,
        bannedTropes,
        usedMotifs,
        npcContext,
      });

      const auditText = JSON.stringify(data);
      const noveltyAudit = auditAntiTropeNovelty(
        auditText,
        Array.isArray(bannedTropes) ? bannedTropes : [],
        Array.isArray(usedMotifs) ? usedMotifs : [],
      );

      res.json({ ok: true, category, data, noveltyAudit });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Autonomous generation failed.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Real verdant-uorc.wasm-backed Verdant Engine MCP JSON-RPC 2.0 Server Endpoint
  app.post('/api/verdant/mcp', async (req, res) => {
    const rpc = req.body ?? {};
    const id = rpc.id ?? null;
    const method = rpc.method;
    const params = rpc.params ?? {};

    const replyOk = (result: unknown) => {
      res.json({ jsonrpc: '2.0', id, result });
    };
    const replyErr = (code: number, message: string) => {
      res.status(200).json({ jsonrpc: '2.0', id, error: { code, message } });
    };

    if (rpc.jsonrpc !== '2.0' || typeof method !== 'string') {
      replyErr(-32600, 'Invalid JSON-RPC 2.0 request envelope.');
      return;
    }

    if (method === 'initialize') {
      await verdantMcp.ensureReady().catch(() => {});
      replyOk({
        protocolVersion: '2025-03-26',
        serverInfo: {
          name: 'verdant-operator-wasm-mcp',
          version: '2.0.0',
          origin: 'github.com/afflom/verdant-engine',
        },
        capabilities: { tools: { listChanged: true } },
      });
      return;
    }

    if (method === 'tools/list') {
      replyOk({ tools: VERDANT_MCP_TOOLS });
      return;
    }

    if (method === 'tools/call') {
      const toolName = String(params.name ?? '');
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await verdantMcp.handleToolCall(toolName, args, createGeminiClient());
        replyOk({
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Verdant MCP tool execution error';
        replyErr(-32000, msg);
        return;
      }
    }

    replyErr(-32601, `Unsupported MCP method: ${method}`);
  });

  // Serve real Verdant Engine Wasm, HD renderer, AudioWorklet, GLB world, and Prism manifest directly
  const verdantPublicDir = path.resolve(process.cwd(), 'public', 'verdant');
  app.use(
    '/verdant',
    express.static(verdantPublicDir, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm');
        else if (filePath.endsWith('.mjs')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        else if (filePath.endsWith('.glb')) res.setHeader('Content-Type', 'model/gltf-binary');
        else if (filePath.endsWith('.vdnt')) res.setHeader('Content-Type', 'application/octet-stream');
      },
    }),
  );

  app.get('/api/verdant/manifest', (_req, res) => {
    const manifestPath = path.join(verdantPublicDir, 'prism-world-manifest.json');
    if (!fs.existsSync(manifestPath)) {
      res.status(404).json({ ok: false, error: 'Prism world manifest not generated yet.' });
      return;
    }
    res.type('application/json').send(fs.readFileSync(manifestPath, 'utf8'));
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const server = http.createServer(app);

  // Real-time Server-Authoritative Vaelmor Multiplayer Realm (/ws/realm)
  const wss = new WebSocketServer({ server, path: '/ws/realm' });
  interface ServerPlayer {
    id: string;
    name: string;
    guildId: string;
    x: number;
    z: number;
    yaw: number;
    activeGear: string;
    regionId: string;
    actionPulseAt?: number;
    lastSeen: number;
  }
  interface ServerBanner {
    id: string;
    name: string;
    guildId: string;
    builderName: string;
    position: [number, number];
    plantedAt: number;
    remote?: boolean;
  }
  interface ServerChat {
    id: string;
    senderId: string;
    senderName: string;
    guildId: string;
    text: string;
    kind: 'chat' | 'event';
    timestamp: number;
  }

  const realmPlayers = new Map<string, ServerPlayer>();
  const realmBanners: ServerBanner[] = [];
  const realmGuildProsperity: Record<string, number> = {
    'guild-causeway': 64,
    'guild-tideloom': 52,
    'guild-kiln': 58,
  };
  const realmChat: ServerChat[] = [];

  const broadcast = (payload: Record<string, unknown>, exclude?: WebSocket) => {
    const encoded = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client !== exclude && client.readyState === WebSocket.OPEN) {
        client.send(encoded);
      }
    }
  };

  wss.on('connection', (ws) => {
    const playerId = `ww-${crypto.randomBytes(4).toString('hex')}`;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        const now = Date.now();

        if (msg.type === 'player:join') {
          const player: ServerPlayer = {
            id: playerId,
            name: String(msg.name || `Waywright-${playerId.slice(-4).toUpperCase()}`).slice(0, 28),
            guildId: String(msg.guildId || 'guild-causeway'),
            x: Number(msg.x) || 0,
            z: Number(msg.z) || 17.5,
            yaw: Number(msg.yaw) || Math.PI,
            activeGear: String(msg.activeGear || 'hookblade'),
            regionId: String(msg.regionId || 'southern-terrace'),
            lastSeen: now,
          };
          realmPlayers.set(playerId, player);

          // Initial full realm snapshot to newly joined player
          ws.send(
            JSON.stringify({
              type: 'realm:init',
              payload: {
                selfId: playerId,
                players: Array.from(realmPlayers.values()).filter((p) => p.id !== playerId),
                banners: realmBanners,
                guildProsperity: realmGuildProsperity,
                chatHistory: realmChat,
              },
            }),
          );

          // Notify other connected players
          broadcast({ type: 'player:upsert', player }, ws);
          return;
        }

        const existing = realmPlayers.get(playerId);
        if (!existing) return;
        existing.lastSeen = now;

        if (msg.type === 'player:move') {
          existing.x = Math.max(-104, Math.min(104, Number(msg.x) || 0));
          existing.z = Math.max(-104, Math.min(104, Number(msg.z) || 0));
          existing.yaw = Number(msg.yaw) || 0;
          existing.activeGear = String(msg.activeGear || existing.activeGear);
          existing.regionId = String(msg.regionId || existing.regionId);
          broadcast({ type: 'player:upsert', player: existing }, ws);
        } else if (msg.type === 'player:action') {
          existing.activeGear = String(msg.activeGear || existing.activeGear);
          existing.actionPulseAt = now;
          broadcast({ type: 'player:upsert', player: existing }, ws);
        } else if (msg.type === 'guild:pledge') {
          existing.guildId = String(msg.guildId || existing.guildId);
          if (msg.name) existing.name = String(msg.name).slice(0, 28);
          broadcast({ type: 'player:upsert', player: existing }, ws);
        } else if (msg.type === 'banner:plant' && msg.banner) {
          const incoming = msg.banner as ServerBanner;
          if (!realmBanners.some((b) => b.id === incoming.id)) {
            const cleanBanner: ServerBanner = {
              id: String(incoming.id),
              name: String(incoming.name || 'Frontier Waymark').slice(0, 48),
              guildId: String(incoming.guildId || existing.guildId),
              builderName: existing.name,
              position: [Number(incoming.position?.[0]) || existing.x, Number(incoming.position?.[1]) || existing.z],
              plantedAt: now,
              remote: true,
            };
            realmBanners.unshift(cleanBanner);
            if (realmBanners.length > 40) realmBanners.pop();
            realmGuildProsperity[cleanBanner.guildId] = Math.min(
              100,
              (realmGuildProsperity[cleanBanner.guildId] ?? 50) + 3,
            );
            broadcast({ type: 'banner:planted', banner: cleanBanner }, ws);
            broadcast({ type: 'guild:prosperity', prosperity: realmGuildProsperity });

            const eventMsg: ServerChat = {
              id: `ev-${now}-${Math.round(Math.random() * 999)}`,
              senderId: playerId,
              senderName: existing.name,
              guildId: cleanBanner.guildId,
              text: `${existing.name} raised ${cleanBanner.name} on the frontier.`,
              kind: 'event',
              timestamp: now,
            };
            realmChat.push(eventMsg);
            if (realmChat.length > 40) realmChat.shift();
            broadcast({ type: 'world:chat', message: eventMsg });
          }
        } else if (msg.type === 'quest:complete') {
          const gId = String(msg.guildId || existing.guildId);
          const title = String(msg.questTitle || 'a Frontier Charter').slice(0, 64);
          realmGuildProsperity[gId] = Math.min(100, (realmGuildProsperity[gId] ?? 50) + 5);
          broadcast({ type: 'guild:prosperity', prosperity: realmGuildProsperity });
          const eventMsg: ServerChat = {
            id: `ev-${now}-${Math.round(Math.random() * 999)}`,
            senderId: playerId,
            senderName: existing.name,
            guildId: gId,
            text: `${existing.name} completed "${title}".`,
            kind: 'event',
            timestamp: now,
          };
          realmChat.push(eventMsg);
          if (realmChat.length > 40) realmChat.shift();
          broadcast({ type: 'world:chat', message: eventMsg });
        } else if (msg.type === 'world:chat') {
          const text = String(msg.text || '').trim().slice(0, 180);
          if (!text) return;
          const chatMsg: ServerChat = {
            id: `chat-${now}-${Math.round(Math.random() * 999)}`,
            senderId: playerId,
            senderName: existing.name,
            guildId: existing.guildId,
            text,
            kind: 'chat',
            timestamp: now,
          };
          realmChat.push(chatMsg);
          if (realmChat.length > 40) realmChat.shift();
          broadcast({ type: 'world:chat', message: chatMsg });
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('close', () => {
      if (realmPlayers.delete(playerId)) {
        broadcast({ type: 'player:leave', playerId });
      }
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Frontiers and Foundations running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Frontiers and Foundations server:', err);
  process.exit(1);
});
