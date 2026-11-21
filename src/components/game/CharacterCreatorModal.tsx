import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Compass,
  Flame,
  Plus,
  RefreshCw,
  Shield,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type {
  CharacterAttributeKey,
  CharacterBeardStyle,
  CharacterClassId,
  CharacterGarmentStyle,
  CharacterHairStyle,
  CharacterSatchelStyle,
  CharacterSpeciesId,
  PlayerCharacterProfile,
} from '../../verdant/verdantCharacterTypes';
import {
  CHARACTER_ATTRIBUTE_META,
  CHARACTER_CLASSES,
  CHARACTER_SPECIES,
  CHARACTER_UNIVERSAL_INVARIANTS,
  WORLDVIEW_DIRECTIVES,
  computeCharacterCombatStats,
  computeCharacterProgression,
  evaluateGearAffinity,
  evaluateRelicAffinity,
  getClassSpec,
  getDirectiveSpec,
  getEthnicitySpec,
  getSpeciesSpec,
  normalizePlayerProfile,
} from '../../verdant/verdantCharacterOntology';
import { compilePlayerCharacterAppearance } from '../../verdant/verdantCharacterCompiler';
import { GEAR_LOADOUT } from '../../game/worldData';
import type { EquippedRelic, GearUpgradeTiers } from '../../game/multiplayerTypes';

type CreatorTabId = 'lineage' | 'class' | 'progression' | 'appearance';

interface CharacterCreatorModalProps {
  mode: 'create' | 'customize';
  initialProfile: PlayerCharacterProfile;
  slotLabel?: string;
  renown: number;
  completedQuestsCount: number;
  defeatedCount: number;
  gearTiers: GearUpgradeTiers;
  relics: EquippedRelic[];
  onConfirm: (profile: PlayerCharacterProfile) => void;
  onCancel: () => void;
}

const GARMENT_OPTIONS: Array<{ id: CharacterGarmentStyle; label: string }> = [
  { id: 'waywright-longcoat', label: 'Waywright Longcoat' },
  { id: 'guild-waywright', label: 'Chartered Guild Coat' },
  { id: 'hooded-cloak', label: 'Surveyor Hooded Cloak' },
  { id: 'oilskin-coat', label: 'Pelagic Oilskin Coat' },
  { id: 'smith-apron', label: 'Foundry Leather Apron' },
  { id: 'herbalist-coat', label: 'Rootward Herbalist Coat' },
  { id: 'archon-vestments', label: 'Astromancer Vestments' },
  { id: 'ranger-brigandine', label: 'Crucible Brigandine' },
];

const HAIR_OPTIONS: Array<{ id: CharacterHairStyle; label: string }> = [
  { id: 'waywright-swept', label: 'Waywright Swept' },
  { id: 'braided-crown', label: 'Braided Crown' },
  { id: 'windswept', label: 'Frontier Windswept' },
  { id: 'cropped-grey', label: 'Cropped Field Cut' },
  { id: 'braided-locs', label: 'Layered Braided Locs' },
  { id: 'scholar-bun', label: 'Archivist Topknot' },
  { id: 'twin-braids', label: 'Twin Meridian Braids' },
  { id: 'horned-circlet', label: 'Circlet Crest' },
];

const BEARD_OPTIONS: Array<{ id: CharacterBeardStyle; label: string }> = [
  { id: 'none', label: 'Clean-Shaven' },
  { id: 'trimmed-grey', label: 'Trimmed Field Beard' },
  { id: 'full-smith', label: 'Full Foundry Beard' },
  { id: 'goatee', label: 'Surveyor Goatee' },
  { id: 'braided-beard', label: 'Braided Ancestral' },
];

const SATCHEL_OPTIONS: Array<{ id: CharacterSatchelStyle; label: string }> = [
  { id: 'waywright-bandolier', label: 'Waywright Bandolier' },
  { id: 'twin-scroll', label: 'Twin Scroll Case' },
  { id: 'chart-satchel', label: 'Brass Chart Satchel' },
  { id: 'smith-belt', label: 'Tongs & Bell Belt' },
  { id: 'herb-satchel', label: 'Apothecary Satchel' },
  { id: 'none', label: 'Minimalist Rig' },
];

const BUILD_OPTIONS: Array<{ id: PlayerCharacterProfile['buildPreset']; label: string; note: string }> = [
  { id: 'lithe', label: 'Lithe', note: 'Agile & slender stride' },
  { id: 'balanced', label: 'Balanced', note: 'Standard waywright frame' },
  { id: 'stalwart', label: 'Stalwart', note: 'Broad-shouldered & grounded' },
  { id: 'towering', label: 'Towering', note: 'Tall & commanding silhouette' },
];

const GARMENT_SWATCHES: Array<{ label: string; hex: string }> = [
  { label: 'Meridian Navy', hex: '#28454e' },
  { label: 'Basalt Charcoal', hex: '#383d47' },
  { label: 'Oakhaven Moss', hex: '#2d5c42' },
  { label: 'Kiln Crimson', hex: '#8a3028' },
  { label: 'Glasswater Teal', hex: '#236670' },
  { label: 'Amber Ochre', hex: '#94682e' },
  { label: 'Glacial Slate', hex: '#576b8f' },
  { label: 'Vaelmor Plum', hex: '#57335c' },
];

const UNDER_TUNIC_SWATCHES: Array<{ label: string; hex: string }> = [
  { label: 'Warm Parchment', hex: '#c2b394' },
  { label: 'Ash Linen', hex: '#757a85' },
  { label: 'Saddle Leather', hex: '#704d33' },
  { label: 'Deep Indigo', hex: '#2e3857' },
  { label: 'Sage Weave', hex: '#57755c' },
  { label: 'Cinder Umber', hex: '#573329' },
];

const TRIM_SWATCHES: Array<{ label: string; hex: string }> = [
  { label: 'Burnished Gold', hex: '#e0b857' },
  { label: 'Foundry Copper', hex: '#d67a3d' },
  { label: 'Verdigris Bronze', hex: '#66c7ad' },
  { label: 'Frostglass Silver', hex: '#c7e0f5' },
  { label: 'Ember Brass', hex: '#f59438' },
  { label: 'Moonstone Ivory', hex: '#e6dbc2' },
];

function sameHex(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export const CharacterCreatorModal: React.FC<CharacterCreatorModalProps> = ({
  mode,
  initialProfile,
  slotLabel,
  renown,
  completedQuestsCount,
  defeatedCount,
  gearTiers,
  relics,
  onConfirm,
  onCancel,
}) => {
  const [draft, setDraft] = useState<PlayerCharacterProfile>(() =>
    normalizePlayerProfile(initialProfile),
  );
  const [activeTab, setActiveTab] = useState<CreatorTabId>(
    mode === 'create' ? 'lineage' : 'progression',
  );
  const [showInvariants, setShowInvariants] = useState(false);
  const tabScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tabScrollRef.current) {
      tabScrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const speciesDef = getSpeciesSpec(draft.speciesId);
  const ethnicityDef = getEthnicitySpec(draft.speciesId, draft.ethnicityId);
  const classDef = getClassSpec(draft.classId);
  const directiveDef = getDirectiveSpec(draft.directiveId);

  const progression = useMemo(
    () => computeCharacterProgression(draft, renown, completedQuestsCount, defeatedCount),
    [draft, renown, completedQuestsCount, defeatedCount],
  );

  const combatStats = useMemo(
    () => computeCharacterCombatStats(draft, gearTiers, relics, progression),
    [draft, gearTiers, relics, progression],
  );

  const compiledAppearance = useMemo(
    () =>
      compilePlayerCharacterAppearance('hookblade', false, draft, progression.evolutionRank),
    [draft, progression.evolutionRank],
  );

  const handleSelectSpecies = (speciesId: CharacterSpeciesId) => {
    const sp = getSpeciesSpec(speciesId);
    const eth = sp.ethnicities[0];
    setDraft((prev) =>
      normalizePlayerProfile({
        ...prev,
        speciesId,
        ethnicityId: eth.id,
        buildPreset: sp.defaultBuildPreset,
        skinColorHex: eth.skinSwatches[0] ?? sp.skinPalette[0],
        hairColorHex: eth.hairSwatches[0] ?? sp.hairPalette[0],
        eyeColorHex: eth.eyeSwatches[0] ?? sp.eyePalette[0],
        garmentPrimaryHex: mode === 'create' ? eth.defaultGarmentPrimaryHex : prev.garmentPrimaryHex,
        garmentSecondaryHex: mode === 'create' ? eth.defaultGarmentSecondaryHex : prev.garmentSecondaryHex,
        trimColorHex: mode === 'create' ? eth.defaultTrimHex : prev.trimColorHex,
      }),
    );
  };

  const handleSelectEthnicity = (ethnicityId: string) => {
    const eth = getEthnicitySpec(draft.speciesId, ethnicityId);
    setDraft((prev) =>
      normalizePlayerProfile({
        ...prev,
        ethnicityId: eth.id,
        skinColorHex: eth.skinSwatches[0] ?? prev.skinColorHex,
        hairColorHex: eth.hairSwatches[0] ?? prev.hairColorHex,
        eyeColorHex: eth.eyeSwatches[0] ?? prev.eyeColorHex,
        garmentPrimaryHex: eth.defaultGarmentPrimaryHex,
        garmentSecondaryHex: eth.defaultGarmentSecondaryHex,
        trimColorHex: eth.defaultTrimHex,
      }),
    );
  };

  const handleSelectClass = (classId: CharacterClassId) => {
    const cls = getClassSpec(classId);
    setDraft((prev) =>
      normalizePlayerProfile({
        ...prev,
        classId,
        garmentStyle: mode === 'create' ? cls.startingGarment : prev.garmentStyle,
        satchelStyle: mode === 'create' ? cls.startingSatchel : prev.satchelStyle,
        hasPauldrons:
          mode === 'create'
            ? classId === 'crucible-vanguard' || classId === 'foundry-bellwright'
            : prev.hasPauldrons,
      }),
    );
  };

  const handleAllocatePoint = (key: CharacterAttributeKey) => {
    if (progression.unspentAttributePoints <= 0) return;
    setDraft((prev) => ({
      ...prev,
      allocatedAttributes: {
        ...prev.allocatedAttributes,
        [key]: (prev.allocatedAttributes[key] ?? 0) + 1,
      },
    }));
  };

  const handleResetAllocated = () => {
    setDraft((prev) => ({
      ...prev,
      allocatedAttributes: {
        vigor: 0,
        resonance: 0,
        wayfinding: 0,
        insight: 0,
        conviction: 0,
      },
    }));
  };

  const handleRandomizeAppearance = () => {
    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
    setDraft((prev) => {
      const sp = getSpeciesSpec(prev.speciesId);
      return normalizePlayerProfile({
        ...prev,
        garmentStyle: pick(GARMENT_OPTIONS).id,
        hairStyle: pick(HAIR_OPTIONS).id,
        beardStyle: pick(BEARD_OPTIONS).id,
        satchelStyle: pick(SATCHEL_OPTIONS).id,
        buildPreset: pick(BUILD_OPTIONS).id,
        hasPauldrons: Math.random() > 0.35,
        hasHoodDown: Math.random() > 0.45,
        skinColorHex: pick(sp.skinPalette),
        hairColorHex: pick(sp.hairPalette),
        eyeColorHex: pick(sp.eyePalette),
        garmentPrimaryHex: pick(GARMENT_SWATCHES).hex,
        garmentSecondaryHex: pick(UNDER_TUNIC_SWATCHES).hex,
        trimColorHex: pick(TRIM_SWATCHES).hex,
      });
    });
  };

  const handleConfirm = () => {
    const clean = normalizePlayerProfile({
      ...draft,
      name: draft.name.trim() || 'Waywright',
    });
    onConfirm(clean);
  };

  const totalAllocated = Object.values(draft.allocatedAttributes).reduce(
    (a: number, b: number) => a + b,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(7, 9, 14, 0.90)' }}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'create' ? 'Waywright Character Creation' : 'Character Sheet and Customization Atelier'}
    >
      <div
        className="relative flex w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-amber-500/35 text-slate-100 shadow-2xl"
        style={{
          backgroundColor: 'rgba(13, 17, 25, 0.98)',
          maxHeight: '90vh',
        }}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-amber-500/20 px-6 py-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-amber-400/90">
              {mode === 'create'
                ? `Waywright Charter Enrollment${slotLabel ? ` · ${slotLabel}` : ''}`
                : 'Waywright Dossier & Live Customization Atelier'}
            </p>
            <h2 className="mt-0.5 font-serif text-xl font-semibold tracking-wide text-amber-50">
              {mode === 'create'
                ? 'Forge Your Frontier Character'
                : `${draft.name} · ${progression.evolutionTitle}`}
            </h2>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 rounded border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-amber-400/60 hover:text-amber-100"
            aria-label="Close character customization"
          >
            <X className="h-3.5 w-3.5" />
            <span>{mode === 'create' ? 'Back' : 'Close [Esc]'}</span>
          </button>
        </div>

        {/* Main 2-Column Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[310px_1fr]">
          {/* Left Showcase Column */}
          <aside className="flex flex-col gap-3 overflow-y-auto border-b border-amber-500/20 p-4 md:border-b-0 md:border-r">
            {/* Live HD Portrait */}
            <div className="relative mx-auto w-full max-w-[236px] shrink-0 overflow-hidden rounded border border-amber-500/40 bg-slate-950">
              <img
                src={compiledAppearance.portraitUrl}
                alt={`${draft.name} HD character portrait`}
                className="block aspect-[8/9] max-h-[246px] w-full bg-[#0d1118] object-contain"
              />
              <div
                className="shrink-0 border-t border-amber-500/25 px-3 py-2 text-center"
                style={{ backgroundColor: 'rgba(11, 14, 20, 0.96)' }}
              >
                <div className="truncate font-serif text-sm font-semibold text-amber-100">
                  {draft.name || 'Unnamed Waywright'}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-slate-300">
                  {speciesDef.name} · {ethnicityDef.name}
                </div>
                <div className="mt-0.5 text-[11px] font-medium text-amber-300/90 tabular-nums">
                  Lv.{progression.level} {classDef.name} · Rank {progression.evolutionRank}
                </div>
              </div>
            </div>

            {/* Guiding Directive Banner */}
            <div className="rounded border border-slate-700/70 bg-slate-900/70 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-400/90">
                Guiding Directive
              </div>
              <div className="mt-0.5 text-sm font-medium text-slate-100">
                {directiveDef.name}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300/90">
                “{directiveDef.creed}”
              </p>
              <div className="mt-1.5 text-[11px] text-emerald-300/90">
                {directiveDef.passiveLabel}
              </div>
            </div>

            {/* Core Attributes Readout */}
            <div className="rounded border border-slate-700/70 bg-slate-900/70 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Core Attributes
                </span>
                {progression.unspentAttributePoints > 0 && (
                  <span className="text-[11px] font-semibold text-amber-300 tabular-nums">
                    +{progression.unspentAttributePoints} pts ready
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1.5">
                {(Object.keys(CHARACTER_ATTRIBUTE_META) as CharacterAttributeKey[]).map((key) => {
                  const meta = CHARACTER_ATTRIBUTE_META[key];
                  const val = progression.totalAttributes[key];
                  const isPrimary = classDef.primaryAttribute === key;
                  return (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className={isPrimary ? 'font-semibold text-amber-200' : 'text-slate-300'}>
                        {meta.label}
                        {isPrimary ? ' ★' : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-amber-100 tabular-nums">
                          {val}
                        </span>
                        {progression.unspentAttributePoints > 0 && (
                          <button
                            type="button"
                            onClick={() => handleAllocatePoint(key)}
                            className="flex h-5 w-5 items-center justify-center rounded border border-amber-400/60 bg-amber-500/20 text-amber-200 transition hover:bg-amber-500/40"
                            title={`Increase ${meta.label}`}
                            aria-label={`Increase ${meta.label}`}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Derived Combat Stats */}
            <div className="rounded border border-slate-700/70 bg-slate-900/70 px-3 py-2.5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Derived Field Stats
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs tabular-nums">
                <div className="flex justify-between">
                  <span className="text-slate-400">Vitality</span>
                  <span className="font-semibold text-emerald-300">{combatStats.maxHp} HP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Strike</span>
                  <span className="font-semibold text-amber-200">
                    {Math.round(combatStats.damageMultiplier * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Stride</span>
                  <span className="font-semibold text-sky-300">
                    {Math.round(combatStats.speedMultiplier * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ward</span>
                  <span className="font-semibold text-indigo-300">
                    {combatStats.damageReductionPct ?? 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Lantern</span>
                  <span className="font-semibold text-teal-300">
                    +{combatStats.lanternHealAmount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Bell Range</span>
                  <span className="font-semibold text-amber-300">
                    +{combatStats.bellRangeBonus.toFixed(1)}m
                  </span>
                </div>
              </div>
              <div className="mt-2 border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                Innate: <span className="text-slate-200">{speciesDef.innateTraitName}</span>
              </div>
            </div>
          </aside>

          {/* Right Tabbed Workspace */}
          <div className="flex min-h-0 flex-col">
            {/* Tab Navigation */}
            <div className="flex shrink-0 flex-nowrap items-center gap-1 overflow-x-auto border-b border-amber-500/20 px-5 pt-2.5">
              {(
                [
                  { id: 'lineage', label: '1. Lineage & Origin', icon: Compass },
                  { id: 'class', label: '2. Class & Worldview', icon: Shield },
                  { id: 'appearance', label: '3. Appearance', icon: User },
                  {
                    id: 'progression',
                    label:
                      progression.unspentAttributePoints > 0
                        ? `4. Progression (+${progression.unspentAttributePoints})`
                        : '4. Progression & Gear',
                    icon: Sparkles,
                  },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2 text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'border-amber-400 text-amber-200'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div ref={tabScrollRef} className="min-h-0 flex-1 overflow-y-auto p-5">
              {/* TAB 1: LINEAGE & ORIGIN */}
              {activeTab === 'lineage' && (
                <div className="space-y-5">
                  <div>
                    <label
                      htmlFor="waywright-name-input"
                      className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300/90"
                    >
                      Waywright Name
                    </label>
                    <input
                      id="waywright-name-input"
                      type="text"
                      maxLength={24}
                      value={draft.name}
                      onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter your Waywright name"
                      className="mt-1.5 w-full max-w-md rounded border border-amber-500/35 bg-slate-950 px-3.5 py-2 text-sm text-amber-50 placeholder-slate-500 focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                        Species of the Six Frontiers
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Shapes anatomy, worldview lens & innate traits
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {CHARACTER_SPECIES.map((sp) => {
                        const selected = draft.speciesId === sp.id;
                        const bonusText = Object.entries(sp.attributeBonuses)
                          .map(([k, v]) => `+${v} ${CHARACTER_ATTRIBUTE_META[k as CharacterAttributeKey].short}`)
                          .join(' · ');
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => handleSelectSpecies(sp.id)}
                            className={`flex flex-col rounded border p-3 text-left transition ${
                              selected
                                ? 'border-amber-400 bg-amber-500/15'
                                : 'border-slate-700/80 bg-slate-900/70 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-serif text-sm font-semibold text-amber-100">
                                {sp.name}
                              </span>
                              <span className="text-[11px] font-mono text-emerald-300 tabular-nums">
                                {bonusText}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-amber-300/80">
                              {sp.ancestralRegion}
                            </div>
                            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-300">
                              {sp.originNarrative}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Species Deep Origin + Cultural Ethnicities */}
                  <div className="rounded border border-amber-500/25 bg-slate-900/60 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                      Cultural Ethnicity & Homeland — {speciesDef.name}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">
                      {speciesDef.worldviewLens}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {speciesDef.ethnicities.map((eth) => {
                        const selected = draft.ethnicityId === eth.id;
                        return (
                          <button
                            key={eth.id}
                            type="button"
                            onClick={() => handleSelectEthnicity(eth.id)}
                            className={`rounded border p-3 text-left transition ${
                              selected
                                ? 'border-amber-400 bg-amber-500/15'
                                : 'border-slate-700/80 bg-slate-950/70 hover:border-slate-500'
                            }`}
                          >
                            <div className="font-serif text-sm font-semibold text-amber-50">
                              {eth.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-amber-300/80">
                              {eth.homeland}
                            </div>
                            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                              {eth.originSummary}
                            </p>
                            <div className="mt-2 border-t border-slate-800 pt-1.5 text-[11px] italic text-slate-400">
                              “{eth.culturalEthos}”
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CLASS & WORLDVIEW */}
              {activeTab === 'class' && (
                <div className="space-y-5">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                        Character Class & Field Discipline
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Defines base stats, inventory synergies & 4-tier evolution
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {CHARACTER_CLASSES.map((cls) => {
                        const selected = draft.classId === cls.id;
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => handleSelectClass(cls.id)}
                            className={`flex flex-col rounded border p-3 text-left transition ${
                              selected
                                ? 'border-amber-400 bg-amber-500/15'
                                : 'border-slate-700/80 bg-slate-900/70 hover:border-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-serif text-sm font-semibold text-amber-100">
                                {cls.name}
                              </span>
                              <span className="text-[11px] text-amber-300/90">
                                {CHARACTER_ATTRIBUTE_META[cls.primaryAttribute].short} /{' '}
                                {CHARACTER_ATTRIBUTE_META[cls.secondaryAttribute].short}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {cls.archetypeRole} · Preferred: {cls.preferredGear.join(', ')}
                            </div>
                            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                              {cls.summary}
                            </p>
                            <div className="mt-2 border-t border-slate-800/90 pt-1.5 text-[11px] text-emerald-300/90">
                              Signature Item: {cls.signatureItemName}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Guiding Directives / Worldviews */}
                  <div>
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                        Guiding Directive & Worldview
                      </h3>
                      <span className="text-[11px] text-slate-400">
                        Unlocks bespoke NPC dialogue choices & philosophical resonance
                      </span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {WORLDVIEW_DIRECTIVES.map((dir) => {
                        const selected = draft.directiveId === dir.id;
                        return (
                          <button
                            key={dir.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, directiveId: dir.id }))
                            }
                            className={`flex flex-col rounded border p-3 text-left transition ${
                              selected
                                ? 'border-amber-400 bg-amber-500/15'
                                : 'border-slate-700/80 bg-slate-900/70 hover:border-slate-500'
                            }`}
                          >
                            <div className="font-serif text-sm font-semibold text-amber-100">
                              {dir.name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-amber-300/80">
                              {dir.worldviewAxis}
                            </div>
                            <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                              {dir.crisisStance}
                            </p>
                            <div className="mt-2 text-[11px] text-emerald-300/90">
                              {dir.passiveLabel}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: APPEARANCE & ATTIRE */}
              {activeTab === 'appearance' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                        Live 3D Rig & Portrait Customization
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Every choice renders 1:1 on your HD portrait and 3D character mesh in real time.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRandomizeAppearance}
                      className="flex items-center gap-1.5 rounded border border-amber-500/40 bg-slate-900 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Randomize</span>
                    </button>
                  </div>

                  {/* Garment, Hair, Beard, Satchel selectors */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Garment & Coat Style
                      </label>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {GARMENT_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, garmentStyle: opt.id }))
                            }
                            className={`rounded border px-2.5 py-1.5 text-left text-xs transition ${
                              draft.garmentStyle === opt.id
                                ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Hairstyle & Crest
                      </label>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {HAIR_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, hairStyle: opt.id }))
                            }
                            className={`rounded border px-2.5 py-1.5 text-left text-xs transition ${
                              draft.hairStyle === opt.id
                                ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Facial Hair
                      </label>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {BEARD_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, beardStyle: opt.id }))
                            }
                            className={`rounded border px-2.5 py-1.5 text-left text-xs transition ${
                              draft.beardStyle === opt.id
                                ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Field Satchel & Harness
                      </label>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {SATCHEL_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, satchelStyle: opt.id }))
                            }
                            className={`rounded border px-2.5 py-1.5 text-left text-xs transition ${
                              draft.satchelStyle === opt.id
                                ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Build & Equipment Toggles */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Physical Build & Stature
                      </label>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        {BUILD_OPTIONS.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() =>
                              setDraft((prev) => ({ ...prev, buildPreset: b.id }))
                            }
                            className={`rounded border px-2.5 py-1.5 text-left transition ${
                              draft.buildPreset === b.id
                                ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                                : 'border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500'
                            }`}
                          >
                            <div className="text-xs font-semibold">{b.label}</div>
                            <div className="text-[10px] text-slate-400">{b.note}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, hasPauldrons: !prev.hasPauldrons }))
                        }
                        className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
                          draft.hasPauldrons
                            ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                            : 'border-slate-700 bg-slate-900 text-slate-400'
                        }`}
                      >
                        Pauldrons: {draft.hasPauldrons ? 'Equipped' : 'Hidden'}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({ ...prev, hasHoodDown: !prev.hasHoodDown }))
                        }
                        className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
                          draft.hasHoodDown
                            ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                            : 'border-slate-700 bg-slate-900 text-slate-400'
                        }`}
                      >
                        Traveler Hood: {draft.hasHoodDown ? 'Draped' : 'Off'}
                      </button>
                    </div>
                  </div>

                  {/* Color Swatch Palettes */}
                  <div className="grid grid-cols-1 gap-3 rounded border border-slate-800 bg-slate-950/60 p-3.5 sm:grid-cols-2 lg:grid-cols-3">
                    {(
                      [
                        {
                          label: `${speciesDef.name} Complexion`,
                          swatches: speciesDef.skinPalette.map((hex, i) => ({ label: `Tone ${i + 1}`, hex })),
                          current: draft.skinColorHex,
                          apply: (hex: string) =>
                            setDraft((p) => ({ ...p, skinColorHex: hex })),
                        },
                        {
                          label: 'Hair & Crown Tone',
                          swatches: speciesDef.hairPalette.map((hex, i) => ({ label: `Shade ${i + 1}`, hex })),
                          current: draft.hairColorHex,
                          apply: (hex: string) =>
                            setDraft((p) => ({ ...p, hairColorHex: hex })),
                        },
                        {
                          label: 'Eye Luminance',
                          swatches: speciesDef.eyePalette.map((hex, i) => ({ label: `Iris ${i + 1}`, hex })),
                          current: draft.eyeColorHex,
                          apply: (hex: string) =>
                            setDraft((p) => ({ ...p, eyeColorHex: hex })),
                        },
                        {
                          label: 'Primary Garment',
                          swatches: GARMENT_SWATCHES,
                          current: draft.garmentPrimaryHex,
                          apply: (hex: string) =>
                            setDraft((p) => ({ ...p, garmentPrimaryHex: hex })),
                        },
                        {
                          label: 'Under-Tunic',
                          swatches: UNDER_TUNIC_SWATCHES,
                          current: draft.garmentSecondaryHex,
                          apply: (hex: string) =>
                            setDraft((p) => ({ ...p, garmentSecondaryHex: hex })),
                        },
                        {
                          label: 'Metallic Trim & Clasp',
                          swatches: TRIM_SWATCHES,
                          current: draft.trimColorHex,
                          apply: (hex: string) =>
                            setDraft((p) => ({ ...p, trimColorHex: hex })),
                        },
                      ] as const
                    ).map((group) => (
                      <div key={group.label}>
                        <div className="text-[11px] font-medium text-slate-300">
                          {group.label}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {group.swatches.map((sw) => {
                            const active = sameHex(group.current, sw.hex);
                            return (
                              <button
                                key={`${group.label}-${sw.hex}`}
                                type="button"
                                onClick={() => group.apply(sw.hex)}
                                title={sw.label}
                                aria-label={`${group.label}: ${sw.label}`}
                                className={`h-6 w-6 rounded-full border-2 transition ${
                                  active
                                    ? 'scale-110 border-amber-300 ring-2 ring-amber-400/50'
                                    : 'border-slate-700 hover:border-slate-400'
                                }`}
                                style={{ backgroundColor: sw.hex }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: PROGRESSION, ATTRIBUTES & INVENTORY SYNERGY */}
              {activeTab === 'progression' && (
                <div className="space-y-5">
                  {/* Level, XP & 4-Tier Evolution Track */}
                  <div className="rounded border border-amber-500/25 bg-slate-900/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400">
                          Level {progression.level} · {classDef.name}
                        </div>
                        <div className="font-serif text-base font-semibold text-amber-50">
                          {progression.evolutionTitle} (Tier {progression.evolutionRank}/4)
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-300 tabular-nums">
                        <div>
                          XP: <span className="font-semibold text-amber-200">{progression.totalXp}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {progression.xpIntoLevel} / {progression.xpForNextLevel} to Lv.
                          {Math.min(20, progression.level + 1)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded bg-slate-800">
                      <div
                        className="h-full bg-amber-400 transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round((progression.xpIntoLevel / Math.max(1, progression.xpForNextLevel)) * 100),
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
                      {classDef.evolutionPath.map((stage) => {
                        const unlocked = progression.level >= stage.minLevel;
                        return (
                          <div
                            key={stage.rank}
                            className={`rounded border p-2.5 ${
                              unlocked
                                ? 'border-amber-400/50 bg-amber-500/10'
                                : 'border-slate-800 bg-slate-950/60 opacity-70'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                              <span className={unlocked ? 'text-amber-200' : 'text-slate-400'}>
                                Rank {stage.rank}
                              </span>
                              <span className="text-slate-400 tabular-nums">Lv.{stage.minLevel}+</span>
                            </div>
                            <div className="mt-0.5 text-xs font-semibold text-slate-100">
                              {stage.title}
                            </div>
                            <p className="mt-1 text-[11px] leading-snug text-slate-300">
                              {stage.unlockDescription}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Attribute Allocation */}
                  <div className="rounded border border-slate-700/80 bg-slate-900/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                          Attribute Points & Class Scaling
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Earn +2 Attribute Points each level through Renown, Quests, and Frontier victories.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-amber-200 tabular-nums">
                          Unspent: {progression.unspentAttributePoints}
                        </span>
                        {totalAllocated > 0 && (
                          <button
                            type="button"
                            onClick={handleResetAllocated}
                            className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:border-amber-400 hover:text-amber-100"
                          >
                            Reset Points
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(Object.keys(CHARACTER_ATTRIBUTE_META) as CharacterAttributeKey[]).map((key) => {
                        const meta = CHARACTER_ATTRIBUTE_META[key];
                        const val = progression.totalAttributes[key];
                        const alloc = draft.allocatedAttributes[key] ?? 0;
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/70 px-3 py-2"
                          >
                            <div className="pr-2">
                              <div className="text-xs font-semibold text-slate-100">
                                {meta.label}{' '}
                                {alloc > 0 && (
                                  <span className="text-[11px] text-emerald-300 tabular-nums">
                                    (+{alloc} trained)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">{meta.gameplayEffect}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-base font-bold text-amber-100 tabular-nums">
                                {val}
                              </span>
                              <button
                                type="button"
                                disabled={progression.unspentAttributePoints <= 0}
                                onClick={() => handleAllocatePoint(key)}
                                className="flex h-7 w-7 items-center justify-center rounded border border-amber-400/60 bg-amber-500/20 text-amber-100 transition hover:bg-amber-500/35 disabled:cursor-not-allowed disabled:opacity-35"
                                aria-label={`Spend attribute point on ${meta.label}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inventory-to-Character Class & Lineage Synergy */}
                  <div className="rounded border border-slate-700/80 bg-slate-900/70 p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                      Inventory & Relic Resonance for {classDef.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Equipment scales directly with your Class discipline, Core Attributes, and Species origin.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {GEAR_LOADOUT.map((gear) => {
                        const aff = evaluateGearAffinity(draft, gear.id);
                        return (
                          <div
                            key={gear.id}
                            className={`rounded border px-3 py-2 ${
                              aff.rating === 'resonant'
                                ? 'border-amber-400/50 bg-amber-500/10'
                                : 'border-slate-800 bg-slate-950/60'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-100">
                                {gear.name} (Tier {gearTiers[gear.id] ?? 1})
                              </span>
                              <span
                                className={`font-semibold tabular-nums ${
                                  aff.rating === 'resonant' ? 'text-amber-300' : 'text-slate-400'
                                }`}
                              >
                                {aff.label}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                              {aff.reason}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {relics.filter((r) => r.equipped).length > 0 && (
                      <div className="mt-3 border-t border-slate-800 pt-2.5">
                        <div className="text-[11px] font-semibold text-slate-300">
                          Equipped Relics
                        </div>
                        <div className="mt-1.5 space-y-1.5">
                          {relics
                            .filter((r) => r.equipped)
                            .map((r) => {
                              const rAff = evaluateRelicAffinity(draft, r);
                              return (
                                <div
                                  key={r.id}
                                  className="flex items-center justify-between text-xs text-slate-300"
                                >
                                  <span>{r.name}</span>
                                  <span
                                    className={
                                      rAff.rating === 'resonant' ? 'text-emerald-300' : 'text-slate-400'
                                    }
                                  >
                                    {rAff.label}
                                  </span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Universal Character Invariants (Collapsible Charter) */}
                  <div className="rounded border border-slate-700/70 bg-slate-950/70 p-3.5">
                    <button
                      type="button"
                      onClick={() => setShowInvariants((v) => !v)}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
                        Verdant Character Model · 7 Universal Invariants
                      </span>
                      <span className="text-xs text-amber-300">
                        {showInvariants ? 'Hide' : 'Inspect'}
                      </span>
                    </button>
                    {showInvariants && (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {CHARACTER_UNIVERSAL_INVARIANTS.map((inv) => (
                          <div
                            key={inv.id}
                            className="rounded border border-slate-800 bg-slate-900/70 p-2.5"
                          >
                            <div className="text-xs font-semibold text-amber-200">
                              {inv.label}
                            </div>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
                              {inv.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-500/20 px-6 py-3.5">
          <div className="text-xs text-slate-400">
            {speciesDef.name} ({ethnicityDef.name}) · {classDef.name} · {directiveDef.name}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex items-center gap-2 rounded border border-amber-400 bg-amber-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-amber-400"
            >
              {mode === 'create' ? (
                <>
                  <Flame className="h-3.5 w-3.5" />
                  <span>Seal Charter & Launch Prologue</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save & Apply Live</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
