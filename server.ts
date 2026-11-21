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
import {
  DEFAULT_PING_TTL_MS,
  DEFAULT_ROOM_CODE,
  applyAuthoritativeEnemyDamage,
  computeCoopHealRecipients,
  mergeWorldPing,
  normalizeCallsign,
  normalizeRoomCode,
  pruneExpiredPings,
} from './src/game/multiplayerState.ts';
import type {
  PartySummon,
  SharedEnemyState,
  WorldPing,
  WorldPingKind,
} from './src/game/multiplayerTypes.ts';

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
        'abyssal-grotto',
        'echo-tomb',
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

  // Automated Verdant HD World & Portrait-Matched Character Refinement Pass
  app.post('/api/verdant/refine-hd', async (req, res) => {
    try {
      const { realmSlug } = req.body ?? {};
      const result = await verdantMcp.handleToolCall(
        'verdant_refine_world_hd',
        typeof realmSlug === 'string' && realmSlug.trim() ? { realmSlug: realmSlug.trim() } : {},
        createGeminiClient(),
      );
      res.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verdant HD refinement failed.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Uniform Model-of-Models API (inspect root, 8 canonical parts, or specific model)
  app.get('/api/verdant/model', async (req, res) => {
    try {
      const partSlot = typeof req.query.partSlot === 'string' ? req.query.partSlot.trim() : undefined;
      const includeTree = req.query.includeTree === '1' || req.query.includeTree === 'true';
      const result = await verdantMcp.handleToolCall(
        'verdant_inspect_model_of_models',
        { ...(partSlot ? { partSlot } : {}), includeTree },
        null,
      );
      res.json({ ok: true, ...(result as Record<string, unknown>) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to inspect Frontiers Model-of-Models.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  app.get('/api/verdant/model/:modelId', async (req, res) => {
    try {
      const modelId = decodeURIComponent(String(req.params.modelId ?? '')).trim();
      const result = (await verdantMcp.handleToolCall(
        'verdant_inspect_model_of_models',
        { modelId },
        null,
      )) as { model?: unknown };
      if (!result.model) {
        res.status(404).json({ ok: false, error: `Model not found: ${modelId}` });
        return;
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to inspect model.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Extended Verdant Observer/Manager Pattern — 10 Diversity & Cohesion KPIs + 21-Manager VSM Registry
  app.get('/api/verdant/observer/kpis', async (req, res) => {
    try {
      const includeManagers = req.query.managers !== '0';
      const result = await verdantMcp.handleToolCall(
        'verdant_observer_diversity_kpis',
        { includeManagers },
        null,
      );
      res.json({ ok: true, ...(result as Record<string, unknown>) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to evaluate Verdant Observer KPIs.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // M16 Verdant Observer Refinement Agenda (prioritized proposals across 8 parts & 21 VSM S1-S5 managers)
  app.get('/api/verdant/observer/agenda', async (req, res) => {
    try {
      const includeManagers = req.query.managers !== '0';
      const result = await verdantMcp.handleToolCall(
        'verdant_observer_refinement_agenda',
        { includeManagers },
        null,
      );
      res.json({ ok: true, ...(result as Record<string, unknown>) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to synthesize Verdant Observer agenda.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // M16 Verdant Observer Ratchet Cycle — Execute Agenda Proposals & Advance Watermark
  app.post('/api/verdant/observer/ratchet', async (req, res) => {
    try {
      const { targetTier, partSlot, reason } = req.body ?? {};
      const result = await verdantMcp.handleToolCall(
        'verdant_run_ratchet_cycle',
        {
          ...(typeof targetTier === 'number' ? { targetTier } : {}),
          ...(typeof partSlot === 'string' && partSlot.trim() ? { partSlot: partSlot.trim() } : {}),
          ...(typeof reason === 'string' && reason.trim() ? { reason: reason.trim() } : {}),
        },
        null,
      );
      res.json({ ok: true, ...(result as Record<string, unknown>) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verdant Observer ratchet cycle failed.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // M16/M17 Verdant Lifecycle Gate — 6 Structural & Semantic Closure Checks
  app.get('/api/verdant/observer/lifecycle-gate', async (_req, res) => {
    try {
      const result = await verdantMcp.handleToolCall('verdant_lifecycle_gate', {}, null);
      res.json({ ok: true, ...(result as Record<string, unknown>) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verdant Lifecycle Gate failed.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // M16/M17 Verdant Automate Pipeline — Diagnose -> Ratchet -> Lifecycle Gate -> Watermark Ratchet
  app.post('/api/verdant/observer/automate', async (req, res) => {
    try {
      const { targetTier, partSlot, reason } = req.body ?? {};
      const result = await verdantMcp.handleToolCall(
        'verdant_automate',
        {
          ...(typeof targetTier === 'number' ? { targetTier } : {}),
          ...(typeof partSlot === 'string' && partSlot.trim() ? { partSlot: partSlot.trim() } : {}),
          ...(typeof reason === 'string' && reason.trim() ? { reason: reason.trim() } : {}),
        },
        null,
      );
      res.json({ ok: true, ...(result as Record<string, unknown>) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Verdant Automate pipeline failed.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Uniform Refinement API — Escalate Definition & Resolution + Auto-Diversify Colliding Siblings
  app.post('/api/verdant/model/refine', async (req, res) => {
    try {
      const { targetTier, partSlot, modelId, enforceDiversity, reason } = req.body ?? {};
      const result = await verdantMcp.handleToolCall(
        'verdant_refine_model_api',
        {
          ...(typeof targetTier === 'number' ? { targetTier } : {}),
          ...(typeof partSlot === 'string' && partSlot.trim() ? { partSlot: partSlot.trim() } : {}),
          ...(typeof modelId === 'string' && modelId.trim() ? { modelId: modelId.trim() } : {}),
          ...(typeof enforceDiversity === 'boolean' ? { enforceDiversity } : {}),
          ...(typeof reason === 'string' && reason.trim() ? { reason: reason.trim() } : {}),
        },
        null,
      );
      res.json({ ok: true, ...(result as Record<string, unknown>) });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Uniform model refinement failed.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Boundless Procedural UniverseCell Synthesizer (continuous border terrain + WASM-verified GLB + synthesized NPCs)
  app.get('/api/verdant/cell/:cx/:cz', async (req, res) => {
    try {
      const cx = Math.trunc(Number(req.params.cx));
      const cz = Math.trunc(Number(req.params.cz));
      if (!Number.isFinite(cx) || !Number.isFinite(cz)) {
        res.status(400).json({ ok: false, error: 'Cell coordinates cx and cz must be integers.' });
        return;
      }
      const result = await verdantMcp.handleToolCall(
        'verdant_synthesize_universe_cell',
        { cx, cz },
        createGeminiClient(),
      );
      res.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to synthesize UniverseCell.';
      res.status(500).json({ ok: false, error: message });
    }
  });

  // Procedural Differentiated Character Synthesizer (complete characteristics + 1:1 SVG portrait + WASM rig registration)
  app.post('/api/verdant/characters/synthesize', async (req, res) => {
    try {
      const { theme, realmName, roleHint, seed } = req.body ?? {};
      const result = await verdantMcp.handleToolCall(
        'verdant_synthesize_character',
        {
          ...(typeof theme === 'string' ? { theme } : {}),
          ...(typeof realmName === 'string' ? { realmName } : {}),
          ...(typeof roleHint === 'string' ? { roleHint } : {}),
          ...(typeof seed === 'number' ? { seed } : {}),
        },
        createGeminiClient(),
      );
      res.json({ ok: true, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to synthesize Verdant character.';
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
        if (filePath.endsWith('.wasm')) {
          res.setHeader('Content-Type', 'application/wasm');
          res.setHeader('Cache-Control', 'public, max-age=3600');
        } else if (filePath.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'public, max-age=3600');
        } else if (filePath.endsWith('.glb')) {
          res.setHeader('Content-Type', 'model/gltf-binary');
          res.setHeader('Cache-Control', 'public, max-age=3600');
        } else if (filePath.endsWith('.vdnt')) {
          res.setHeader('Content-Type', 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=3600');
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.png')) {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
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

  // Real-time Server-Authoritative Room & Realm-Scoped Multiplayer State
  interface ServerPlayer {
    id: string;
    name: string;
    guildId: string;
    roomCode: string;
    realmSlug: string;
    realmName: string;
    x: number;
    z: number;
    yaw: number;
    hp: number;
    maxHp: number;
    waterPosture: 'dry' | 'wading' | 'swimming';
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
    realmSlug: string;
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
  interface RoomState {
    code: string;
    sockets: Map<string, WebSocket>;
    players: Map<string, ServerPlayer>;
    bannersByRealm: Map<string, ServerBanner[]>;
    enemiesByRealm: Map<string, Map<string, SharedEnemyState>>;
    activatedByRealm: Map<string, Set<string>>;
    pingsByRealm: Map<string, WorldPing[]>;
    guildProsperity: Record<string, number>;
    chatHistory: ServerChat[];
    activeSummon: PartySummon | null;
    lastActiveAt: number;
  }

  const rooms = new Map<string, RoomState>();

  const getOrCreateRoom = (rawCode?: string): RoomState => {
    const code = normalizeRoomCode(rawCode);
    let room = rooms.get(code);
    if (!room) {
      room = {
        code,
        sockets: new Map(),
        players: new Map(),
        bannersByRealm: new Map(),
        enemiesByRealm: new Map(),
        activatedByRealm: new Map(),
        pingsByRealm: new Map(),
        guildProsperity: {
          'guild-causeway': 64,
          'guild-tideloom': 52,
          'guild-kiln': 58,
        },
        chatHistory: [],
        activeSummon: null,
        lastActiveAt: Date.now(),
      };
      rooms.set(code, room);
    }
    room.lastActiveAt = Date.now();
    return room;
  };

  // Ensure the open public room always exists
  getOrCreateRoom(DEFAULT_ROOM_CODE);

  // Public multiplayer room directory summary (registered before SPA catch-all)
  app.get('/api/multiplayer/rooms', (_req, res) => {
    const openRoom = rooms.get(DEFAULT_ROOM_CODE);
    let totalOnline = 0;
    let activeRoomCount = 0;
    for (const r of rooms.values()) {
      if (r.players.size > 0) {
        totalOnline += r.players.size;
        activeRoomCount += 1;
      }
    }
    res.json({
      ok: true,
      defaultRoomCode: DEFAULT_ROOM_CODE,
      openRoomPlayers: openRoom?.players.size ?? 0,
      totalOnline,
      activeRoomCount,
    });
  });

  const distDir = path.resolve(process.cwd(), 'dist');
  const distIndex = path.join(distDir, 'index.html');
  // In AI Studio preview (DISABLE_HMR=true), serving the compiled dist/ bundle reduces
  // initial page-load HTTP requests from ~54 unbundled ESM files down to ~8 requests,
  // preventing Cloud Run preview proxy 429 ("Rate exceeded") burst rejections and white screens.
  const serveBuiltDist =
    IS_PROD || (process.env.DISABLE_HMR === 'true' && fs.existsSync(distIndex));

  app.get('/favicon.ico', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(204).end();
  });

  if (!serveBuiltDist) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      }),
    );
    app.use(
      '/src/assets',
      express.static(path.join(distDir, 'src', 'assets'), {
        maxAge: '1h',
      }),
    );
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    app.get('*', (_req, res) => {
      if (fs.existsSync(distIndex)) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(distIndex);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  const server = http.createServer(app);

  // Real-time Server-Authoritative Room & Realm-Scoped Multiplayer (/ws/realm)
  const wss = new WebSocketServer({ server, path: '/ws/realm' });

  const getRealmSnapshot = (room: RoomState, realmSlug: string, now: number) => {
    const banners = room.bannersByRealm.get(realmSlug) ?? [];
    const enemyMap = room.enemiesByRealm.get(realmSlug);
    const realmEnemies: Record<string, SharedEnemyState> = {};
    if (enemyMap) {
      for (const [id, st] of enemyMap.entries()) {
        realmEnemies[id] = st;
      }
    }
    const activatedInteractables = Array.from(room.activatedByRealm.get(realmSlug) ?? []);
    const rawPings = room.pingsByRealm.get(realmSlug) ?? [];
    const pings = pruneExpiredPings(rawPings, now);
    room.pingsByRealm.set(realmSlug, pings);
    return { banners, realmEnemies, activatedInteractables, pings };
  };

  const broadcastToRoom = (
    room: RoomState,
    payload: Record<string, unknown>,
    excludePlayerId?: string,
    onlyRealmSlug?: string,
  ) => {
    const encoded = JSON.stringify(payload);
    for (const [pid, client] of room.sockets.entries()) {
      if (excludePlayerId && pid === excludePlayerId) continue;
      if (client.readyState !== WebSocket.OPEN) continue;
      if (onlyRealmSlug) {
        const peer = room.players.get(pid);
        if (!peer || peer.realmSlug !== onlyRealmSlug) continue;
      }
      client.send(encoded);
    }
  };

  const appendRoomEvent = (room: RoomState, eventMsg: ServerChat) => {
    room.chatHistory.push(eventMsg);
    if (room.chatHistory.length > 50) room.chatHistory.shift();
    broadcastToRoom(room, { type: 'world:chat', message: eventMsg });
  };

  const detachPlayerFromRoom = (playerId: string, currentRoomCode: string | null) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;
    const removed = room.players.get(playerId);
    room.sockets.delete(playerId);
    if (room.players.delete(playerId)) {
      broadcastToRoom(room, { type: 'player:leave', playerId });
      if (removed) {
        appendRoomEvent(room, {
          id: `ev-leave-${Date.now()}-${Math.round(Math.random() * 999)}`,
          senderId: playerId,
          senderName: removed.name,
          guildId: removed.guildId,
          text: `${removed.name} departed the expedition.`,
          kind: 'event',
          timestamp: Date.now(),
        });
      }
    }
    if (room.code !== DEFAULT_ROOM_CODE && room.players.size === 0) {
      // Retain private room state briefly only if active; clean immediately when empty & stale
      if (room.bannersByRealm.size === 0 && room.chatHistory.length === 0) {
        rooms.delete(room.code);
      }
    }
  };

  wss.on('connection', (ws) => {
    const playerId = `ww-${crypto.randomBytes(4).toString('hex')}`;
    let activeRoomCode: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        const now = Date.now();

        if (msg.type === 'ping') {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong', ts: now }));
          }
          return;
        }

        if (msg.type === 'player:join') {
          const targetCode = normalizeRoomCode(msg.roomCode);
          if (activeRoomCode && activeRoomCode !== targetCode) {
            detachPlayerFromRoom(playerId, activeRoomCode);
          }
          const room = getOrCreateRoom(targetCode);
          activeRoomCode = room.code;
          const realmSlug = String(msg.realmSlug || 'vaelmor').slice(0, 64);
          const realmName = String(msg.realmName || 'Vaelmor Meridian').slice(0, 64);
          const hp = Math.max(0, Math.min(999, Number(msg.hp) || 100));
          const maxHp = Math.max(1, Math.min(999, Number(msg.maxHp) || 100));
          const posture =
            msg.waterPosture === 'swimming' || msg.waterPosture === 'wading'
              ? msg.waterPosture
              : 'dry';

          const player: ServerPlayer = {
            id: playerId,
            name: normalizeCallsign(msg.name, `Waywright-${playerId.slice(-4).toUpperCase()}`),
            guildId: String(msg.guildId || 'guild-causeway').slice(0, 40),
            roomCode: room.code,
            realmSlug,
            realmName,
            x: Math.max(-104, Math.min(104, Number(msg.x) || 0)),
            z: Math.max(-104, Math.min(104, Number(msg.z) || 17.5)),
            yaw: Number(msg.yaw) || Math.PI,
            hp,
            maxHp,
            waterPosture: posture,
            activeGear: String(msg.activeGear || 'hookblade').slice(0, 24),
            regionId: String(msg.regionId || 'southern-terrace').slice(0, 48),
            lastSeen: now,
          };

          const alreadyInRoom = room.players.has(playerId);
          room.sockets.set(playerId, ws);
          room.players.set(playerId, player);

          const snap = getRealmSnapshot(room, realmSlug, now);
          const freshSummon =
            room.activeSummon && now - room.activeSummon.createdAt < 90_000
              ? room.activeSummon
              : null;

          ws.send(
            JSON.stringify({
              type: 'realm:init',
              payload: {
                selfId: playerId,
                roomCode: room.code,
                realmSlug,
                players: Array.from(room.players.values()).filter((p) => p.id !== playerId),
                banners: snap.banners,
                guildProsperity: room.guildProsperity,
                chatHistory: room.chatHistory,
                realmEnemies: snap.realmEnemies,
                activatedInteractables: snap.activatedInteractables,
                pings: snap.pings,
                activeSummon: freshSummon && freshSummon.senderId !== playerId ? freshSummon : null,
              },
            }),
          );

          broadcastToRoom(room, { type: 'player:upsert', player }, playerId);

          if (!alreadyInRoom && room.players.size > 1) {
            appendRoomEvent(room, {
              id: `ev-join-${now}-${Math.round(Math.random() * 999)}`,
              senderId: playerId,
              senderName: player.name,
              guildId: player.guildId,
              text: `${player.name} joined ${realmName}.`,
              kind: 'event',
              timestamp: now,
            });
          }
          return;
        }

        if (!activeRoomCode) return;
        const room = rooms.get(activeRoomCode);
        if (!room) return;
        const existing = room.players.get(playerId);
        if (!existing) return;
        existing.lastSeen = now;
        room.lastActiveAt = now;

        if (msg.type === 'player:move') {
          existing.x = Math.max(-104, Math.min(104, Number(msg.x) || 0));
          existing.z = Math.max(-104, Math.min(104, Number(msg.z) || 0));
          existing.yaw = Number(msg.yaw) || 0;
          existing.activeGear = String(msg.activeGear || existing.activeGear).slice(0, 24);
          existing.regionId = String(msg.regionId || existing.regionId).slice(0, 48);
          if (typeof msg.hp === 'number' && Number.isFinite(msg.hp)) {
            existing.hp = Math.max(0, Math.min(999, Math.round(msg.hp)));
          }
          if (typeof msg.maxHp === 'number' && Number.isFinite(msg.maxHp)) {
            existing.maxHp = Math.max(1, Math.min(999, Math.round(msg.maxHp)));
          }
          if (msg.waterPosture === 'swimming' || msg.waterPosture === 'wading' || msg.waterPosture === 'dry') {
            existing.waterPosture = msg.waterPosture;
          }
          if (typeof msg.realmSlug === 'string' && msg.realmSlug.trim()) {
            existing.realmSlug = msg.realmSlug.trim().slice(0, 64);
          }
          broadcastToRoom(room, { type: 'player:upsert', player: existing }, playerId);
        } else if (msg.type === 'player:realm') {
          const nextSlug = String(msg.realmSlug || 'vaelmor').slice(0, 64);
          const nextName = String(msg.realmName || nextSlug).slice(0, 64);
          existing.realmSlug = nextSlug;
          existing.realmName = nextName;
          if (typeof msg.x === 'number') existing.x = Math.max(-104, Math.min(104, msg.x));
          if (typeof msg.z === 'number') existing.z = Math.max(-104, Math.min(104, msg.z));
          if (typeof msg.yaw === 'number') existing.yaw = msg.yaw;

          const snap = getRealmSnapshot(room, nextSlug, now);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'realm:sync',
                payload: {
                  realmSlug: nextSlug,
                  banners: snap.banners,
                  realmEnemies: snap.realmEnemies,
                  activatedInteractables: snap.activatedInteractables,
                  pings: snap.pings,
                },
              }),
            );
          }
          broadcastToRoom(room, { type: 'player:upsert', player: existing }, playerId);
        } else if (msg.type === 'player:action') {
          existing.activeGear = String(msg.activeGear || existing.activeGear).slice(0, 24);
          if (typeof msg.x === 'number') existing.x = Math.max(-104, Math.min(104, msg.x));
          if (typeof msg.z === 'number') existing.z = Math.max(-104, Math.min(104, msg.z));
          if (typeof msg.yaw === 'number') existing.yaw = msg.yaw;
          existing.actionPulseAt = now;
          broadcastToRoom(room, { type: 'player:upsert', player: existing }, playerId);
          broadcastToRoom(
            room,
            {
              type: 'player:action',
              event: {
                playerId,
                playerName: existing.name,
                activeGear: existing.activeGear,
                realmSlug: existing.realmSlug,
                x: existing.x,
                z: existing.z,
                yaw: existing.yaw,
                timestamp: now,
              },
            },
            playerId,
            existing.realmSlug,
          );
        } else if (msg.type === 'combat:damage') {
          const realmSlug = String(msg.realmSlug || existing.realmSlug).slice(0, 64);
          const enemyId = String(msg.enemyId || '').slice(0, 80);
          if (!enemyId) return;
          const damage = Math.max(1, Math.min(500, Number(msg.damage) || 15));
          const maxHp = Math.max(1, Math.min(5000, Number(msg.maxHp) || 100));
          const enemyName = String(msg.enemyName || 'Frontier Threat').slice(0, 64);
          const archetype = String(msg.archetype || 'stalker').slice(0, 32);

          let enemyMap = room.enemiesByRealm.get(realmSlug);
          if (!enemyMap) {
            enemyMap = new Map();
            room.enemiesByRealm.set(realmSlug, enemyMap);
          }
          const { state, killedNow } = applyAuthoritativeEnemyDamage(
            enemyMap,
            enemyId,
            damage,
            maxHp,
            existing.name,
            now,
          );
          broadcastToRoom(
            room,
            {
              type: 'combat:enemy_sync',
              realmSlug,
              enemy: state,
              attackerId: playerId,
              attackerName: existing.name,
              killedNow,
            },
            playerId,
            realmSlug,
          );
          if (killedNow && archetype === 'colossus') {
            appendRoomEvent(room, {
              id: `ev-boss-${now}-${Math.round(Math.random() * 999)}`,
              senderId: playerId,
              senderName: existing.name,
              guildId: existing.guildId,
              text: `${existing.name} felled ${enemyName} in ${existing.realmName}!`,
              kind: 'event',
              timestamp: now,
            });
          }
        } else if (msg.type === 'interactable:activate') {
          const realmSlug = String(msg.realmSlug || existing.realmSlug).slice(0, 64);
          const interactableId = String(msg.interactableId || '').slice(0, 96);
          if (!interactableId) return;
          let set = room.activatedByRealm.get(realmSlug);
          if (!set) {
            set = new Set();
            room.activatedByRealm.set(realmSlug, set);
          }
          if (!set.has(interactableId)) {
            set.add(interactableId);
            broadcastToRoom(
              room,
              {
                type: 'interactable:activated',
                realmSlug,
                interactableId,
                interactableName: String(msg.interactableName || 'Waystone').slice(0, 64),
                activatorId: playerId,
                activatorName: existing.name,
              },
              playerId,
              realmSlug,
            );
          }
        } else if (msg.type === 'coop:heal') {
          const realmSlug = String(msg.realmSlug || existing.realmSlug).slice(0, 64);
          const amount = Math.max(8, Math.min(120, Math.round(Number(msg.amount) || 26)));
          const hx = typeof msg.x === 'number' ? msg.x : existing.x;
          const hz = typeof msg.z === 'number' ? msg.z : existing.z;
          const recipients = computeCoopHealRecipients(
            { id: playerId, realmSlug, x: hx, z: hz },
            Array.from(room.players.values()),
          );
          const healPayload = JSON.stringify({
            type: 'coop:healed',
            event: {
              id: `heal-${now}-${Math.round(Math.random() * 999)}`,
              healerId: playerId,
              healerName: existing.name,
              amount,
              realmSlug,
              x: hx,
              z: hz,
              timestamp: now,
            },
          });
          for (const ally of recipients) {
            const allySocket = room.sockets.get(ally.id);
            if (allySocket && allySocket.readyState === WebSocket.OPEN) {
              allySocket.send(healPayload);
            }
          }
        } else if (msg.type === 'world:ping') {
          const realmSlug = String(msg.realmSlug || existing.realmSlug).slice(0, 64);
          const kind: WorldPingKind =
            msg.kind === 'danger' || msg.kind === 'loot' ? msg.kind : 'rally';
          const label = String(
            msg.label || (kind === 'danger' ? 'Threat Spotted' : kind === 'loot' ? 'Relic / Vault' : 'Rally Here'),
          ).slice(0, 40);
          const px = Math.max(-100, Math.min(100, Number(msg.x) || existing.x));
          const pz = Math.max(-100, Math.min(100, Number(msg.z) || existing.z));
          const ping: WorldPing = {
            id: `ping-${now}-${Math.round(Math.random() * 999)}`,
            senderId: playerId,
            senderName: existing.name,
            guildId: existing.guildId,
            realmSlug,
            x: px,
            z: pz,
            kind,
            label,
            createdAt: now,
            expiresAt: now + DEFAULT_PING_TTL_MS,
          };
          const currentPings = room.pingsByRealm.get(realmSlug) ?? [];
          room.pingsByRealm.set(realmSlug, mergeWorldPing(currentPings, ping, now));
          broadcastToRoom(room, { type: 'world:pinged', ping }, undefined, realmSlug);
        } else if (msg.type === 'party:summon') {
          const realmSlug = String(msg.realmSlug || existing.realmSlug).slice(0, 64);
          const realmName = String(msg.realmName || existing.realmName).slice(0, 64);
          const isDungeon = Boolean(msg.isDungeon);
          const cell =
            Array.isArray(msg.cell) && msg.cell.length === 3
              ? ([Number(msg.cell[0]) || 0, Number(msg.cell[1]) || 0, Number(msg.cell[2]) || 0] as [
                  number,
                  number,
                  number,
                ])
              : undefined;
          const summon: PartySummon = {
            id: `summon-${now}-${Math.round(Math.random() * 999)}`,
            senderId: playerId,
            senderName: existing.name,
            realmSlug,
            realmName,
            isDungeon,
            x: Math.max(-96, Math.min(96, Number(msg.x) || existing.x)),
            z: Math.max(-96, Math.min(96, Number(msg.z) || existing.z)),
            cell,
            createdAt: now,
          };
          room.activeSummon = summon;
          broadcastToRoom(room, { type: 'party:summoned', summon }, playerId);
          appendRoomEvent(room, {
            id: `ev-summon-${now}-${Math.round(Math.random() * 999)}`,
            senderId: playerId,
            senderName: existing.name,
            guildId: existing.guildId,
            text: `${existing.name} summoned the party to ${realmName}.`,
            kind: 'event',
            timestamp: now,
          });
        } else if (msg.type === 'guild:pledge') {
          existing.guildId = String(msg.guildId || existing.guildId).slice(0, 40);
          if (msg.name) existing.name = normalizeCallsign(msg.name, existing.name);
          broadcastToRoom(room, { type: 'player:upsert', player: existing }, playerId);
        } else if (msg.type === 'banner:plant' && msg.banner) {
          const incoming = msg.banner as ServerBanner;
          const realmSlug = String(incoming.realmSlug || existing.realmSlug).slice(0, 64);
          const list = room.bannersByRealm.get(realmSlug) ?? [];
          if (!list.some((b) => b.id === incoming.id)) {
            const cleanBanner: ServerBanner = {
              id: String(incoming.id),
              name: String(incoming.name || 'Frontier Waymark').slice(0, 48),
              guildId: String(incoming.guildId || existing.guildId),
              builderName: existing.name,
              position: [Number(incoming.position?.[0]) || existing.x, Number(incoming.position?.[1]) || existing.z],
              plantedAt: now,
              realmSlug,
              remote: true,
            };
            list.unshift(cleanBanner);
            if (list.length > 40) list.pop();
            room.bannersByRealm.set(realmSlug, list);
            room.guildProsperity[cleanBanner.guildId] = Math.min(
              100,
              (room.guildProsperity[cleanBanner.guildId] ?? 50) + 3,
            );
            broadcastToRoom(room, { type: 'banner:planted', banner: cleanBanner }, playerId, realmSlug);
            broadcastToRoom(room, { type: 'guild:prosperity', prosperity: room.guildProsperity });
            appendRoomEvent(room, {
              id: `ev-ban-${now}-${Math.round(Math.random() * 999)}`,
              senderId: playerId,
              senderName: existing.name,
              guildId: cleanBanner.guildId,
              text: `${existing.name} raised ${cleanBanner.name} in ${existing.realmName}.`,
              kind: 'event',
              timestamp: now,
            });
          }
        } else if (msg.type === 'quest:complete') {
          const gId = String(msg.guildId || existing.guildId);
          const title = String(msg.questTitle || 'a Frontier Charter').slice(0, 64);
          room.guildProsperity[gId] = Math.min(100, (room.guildProsperity[gId] ?? 50) + 5);
          broadcastToRoom(room, { type: 'guild:prosperity', prosperity: room.guildProsperity });
          appendRoomEvent(room, {
            id: `ev-q-${now}-${Math.round(Math.random() * 999)}`,
            senderId: playerId,
            senderName: existing.name,
            guildId: gId,
            text: `${existing.name} completed "${title}".`,
            kind: 'event',
            timestamp: now,
          });
        } else if (msg.type === 'world:chat') {
          const text = String(msg.text || '').trim().slice(0, 180);
          if (!text) return;
          appendRoomEvent(room, {
            id: `chat-${now}-${Math.round(Math.random() * 999)}`,
            senderId: playerId,
            senderName: existing.name,
            guildId: existing.guildId,
            text,
            kind: 'chat',
            timestamp: now,
          });
        }
      } catch {
        // ignore malformed frames
      }
    });

    ws.on('close', () => {
      detachPlayerFromRoom(playerId, activeRoomCode);
      activeRoomCode = null;
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
