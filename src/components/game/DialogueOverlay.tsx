import React, { useState } from 'react';
import { BANNED_FANTASY_TROPES, type DialogueChoice, type GameNpc } from '../../game/worldData';
import { isStaticPagesHost, resolvePublicUrl } from '../../utils/publicUrl';

interface DialogueOverlayProps {
  npc: GameNpc;
  realmName?: string;
  usedMotifs: string[];
  onSelectChoice: (npc: GameNpc, choice: DialogueChoice) => void;
  onClose: () => void;
}

interface SpokenTurn {
  speaker: 'npc' | 'player';
  text: string;
  thought?: string;
}

export const DialogueOverlay: React.FC<DialogueOverlayProps> = ({
  npc,
  realmName,
  usedMotifs,
  onSelectChoice,
  onClose,
}) => {
  const [history, setHistory] = useState<SpokenTurn[]>([
    { speaker: 'npc', text: npc.greeting },
  ]);
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [customLine, setCustomLine] = useState('');
  const [thinking, setThinking] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);

  const handleChoice = (choice: DialogueChoice) => {
    setSelectedChoiceIds((prev) => (prev.includes(choice.id) ? prev : [...prev, choice.id]));
    setHistory((prev) => [
      ...prev,
      { speaker: 'player', text: choice.label },
      { speaker: 'npc', text: choice.reply, thought: choice.thought },
    ]);
    onSelectChoice(npc, choice);
  };

  const handleSendCustom = async (lineOverride?: string) => {
    const prompt = (lineOverride ?? customLine).trim();
    if (!prompt || thinking) return;
    setCustomLine('');
    setHistory((prev) => [...prev, { speaker: 'player', text: prompt }]);
    setThinking(true);

    try {
      if (isStaticPagesHost()) {
        setHistory((prev) => [
          ...prev,
          {
            speaker: 'npc',
            text: `${npc.name} considers your words thoughtfully. "${npc.beliefs[0] || npc.cognitiveDrive}"`,
            thought: npc.cognitiveDrive,
          },
        ]);
        return;
      }
      const res = await fetch('/api/verdant/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'dialogue',
          prompt,
          bannedTropes: BANNED_FANTASY_TROPES,
          usedMotifs,
          npcContext: {
            name: npc.name,
            epithet: npc.title,
            faction: npc.guildName,
            cognitiveDrive: npc.cognitiveDrive,
            concealedSecret: npc.concealedSecret,
            speechCadence: npc.speechCadence,
            beliefGraph: npc.beliefs,
          },
        }),
      });
      const json = await res.json();
      if (json.ok && json.data?.reply) {
        setHistory((prev) => [
          ...prev,
          {
            speaker: 'npc',
            text: json.data.reply,
            thought: json.data.cognitiveThought,
          },
        ]);
        if (Array.isArray(json.data.suggestedFollowUps)) {
          setFollowUps(json.data.suggestedFollowUps.slice(0, 2));
        }
      } else {
        setHistory((prev) => [
          ...prev,
          {
            speaker: 'npc',
            text: `${npc.name} pauses, measuring your question against the weight of the frontier. "${npc.beliefs[0]}"`,
          },
        ]);
      }
    } catch {
      setHistory((prev) => [
        ...prev,
        {
          speaker: 'npc',
          text: `${npc.name} listens intently. "Keep your compass steady, Waywright—we will settle this once the foundations hold."`,
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const latestNpcTurn = [...history].reverse().find((h) => h.speaker === 'npc');

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-4 sm:p-8 bg-[#0b0e13]/68">
      <div className="w-full max-w-4xl bg-[#131820] border border-[#d4a253]/45 rounded-sm shadow-[0_24px_64px_rgba(0,0,0,0.78)] overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[210px_1fr]">
          {/* NPC Portrait & Identity Column */}
          <div className="bg-[#0f131a] border-b md:border-b-0 md:border-r border-white/10 p-4 flex md:flex-col items-center md:items-start gap-4">
            <img
              src={resolvePublicUrl(npc.portraitUrl)}
              alt={npc.name}
              className="w-20 h-20 md:w-full md:h-44 object-cover rounded-sm border border-[#d4a253]/40 shrink-0"
            />
            <div className="min-w-0 space-y-1.5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-[#d4a253] font-semibold">
                  {npc.guildName}
                </p>
                <h2 className="font-display text-base font-bold text-[#f3efe6] mt-0.5 leading-snug">
                  {npc.name}
                </h2>
                <p className="text-xs text-[#9ca7b5] mt-0.5">{npc.title}</p>
              </div>
              {npc.appearance?.traitSummary && (
                <p
                  data-testid="npc-trait-summary"
                  className="text-[10px] leading-snug text-[#9eb2c6] pt-1.5 border-t border-white/10"
                >
                  {npc.appearance.traitSummary
                    .split('·')
                    .map((seg) =>
                      seg
                        .trim()
                        .split('-')
                        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ''))
                        .join(' '),
                    )
                    .join(' · ')}
                </p>
              )}
              <p className="text-[10px] italic text-[#7e91a3] leading-snug">
                {npc.speechCadence}
              </p>
            </div>
          </div>

          {/* Spoken Dialogue & Choices Column */}
          <div className="p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <span className="text-[10px] uppercase tracking-[0.18em] text-[#9aa5b3] font-semibold">
                  Conversation
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-[#b5bfcc] hover:text-[#f3efe6] uppercase tracking-[0.12em] font-semibold cursor-pointer"
                >
                  Farewell [Esc]
                </button>
              </div>

              <div className="max-h-44 overflow-y-auto pr-1 space-y-3">
                {history.slice(-4).map((turn, idx) => (
                  <div
                    key={idx}
                    className={
                      turn.speaker === 'player'
                        ? 'pl-3 border-l-2 border-[#5ea38c]/70 text-xs text-[#b5c4be]'
                        : 'text-sm leading-relaxed text-[#f0ebe2]'
                    }
                  >
                    <p>{turn.text}</p>
                  </div>
                ))}
                {thinking && (
                  <p className="text-xs italic text-[#d4a253]">
                    {npc.name} considers your words...
                  </p>
                )}
              </div>

              {latestNpcTurn?.thought && (
                <p className="mt-3 text-[11px] italic text-[#8ea0b2] border-t border-white/8 pt-2">
                  Insight: {latestNpcTurn.thought}
                </p>
              )}
            </div>

            {/* Grounded Story Choices */}
            <div className="space-y-2">
              {npc.choices.map((choice) => {
                const used = selectedChoiceIds.includes(choice.id);
                return (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => handleChoice(choice)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-sm border text-xs sm:text-[13px] transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                      used
                        ? 'bg-[#171d26] border-white/10 text-[#96a1ae]'
                        : 'bg-[#1a222d] hover:bg-[#222d3b] border-[#d4a253]/35 text-[#f2eee5]'
                    }`}
                  >
                    <span>{choice.label}</span>
                    {choice.advancesQuestId && !used && (
                      <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-[#d4a253] font-semibold">
                        Charter
                      </span>
                    )}
                  </button>
                );
              })}

              {followUps.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {followUps.map((q, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={thinking}
                      onClick={() => void handleSendCustom(q)}
                      className="px-3 py-1.5 rounded-sm bg-[#162024] hover:bg-[#1e2d32] border border-[#5ea38c]/40 text-[#c9e6dc] text-[11px] cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* Free-form Intelligent Dialogue Input */}
              <form
                className="flex items-center gap-2 pt-2 border-t border-white/10"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendCustom();
                }}
              >
                <input
                  type="text"
                  value={customLine}
                  onChange={(e) => setCustomLine(e.target.value)}
                  placeholder={`Ask ${npc.name.split(' ')[0]} about ${realmName || 'this frontier'}...`}
                  className="flex-1 bg-[#0e1218] border border-white/15 focus:border-[#d4a253] rounded-sm px-3 py-2 text-xs text-[#f0ebe2] placeholder:text-[#738090] outline-none"
                />
                <button
                  type="submit"
                  disabled={thinking || !customLine.trim()}
                  className="px-4 py-2 rounded-sm bg-[#d4a253] hover:bg-[#e1b366] disabled:opacity-45 text-[#14110b] font-display text-xs font-bold uppercase tracking-[0.1em] cursor-pointer"
                >
                  Speak
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
