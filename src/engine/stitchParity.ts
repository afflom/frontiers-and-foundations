/**
 * Verdant Stitch 2-of-3 XOR Parity Sharding & Integrity Verification (`STCH`).
 * Mirrors afflom/verdant-engine `crates/verdant-core/src/network.rs` parity custody:
 * Splits any canonical world snapshot into Data Shard A, Data Shard B, and Parity Shard P = A ^ B,
 * tagged with SHA-256 digests so any 2 of the 3 shards recover the bit-exact original payload.
 */

export type StitchShardSlot = 'A' | 'B' | 'P';

export interface StitchShard {
  slot: StitchShardSlot;
  magic: 'STCH';
  originalByteLength: number;
  halfLength: number;
  sha256: string;
  payloadHash: string;
  dataHex: string;
}

export interface StitchCustodyBundle {
  bundleId: string;
  sealedAtIso: string;
  originalByteLength: number;
  payloadSha256: string;
  shards: [StitchShard, StitchShard, StitchShard];
}

export interface StitchRecoveryResult {
  ok: boolean;
  recoveredText?: string;
  recoveredSha256?: string;
  usedSlots: StitchShardSlot[];
  droppedSlot: StitchShardSlot | null;
  diagnostic: string;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) {
    throw new Error('Invalid hex string length for Stitch shard.');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const digest = await subtle.digest('SHA-256', copy.buffer);
    return bytesToHex(new Uint8Array(digest));
  }
  // Fallback deterministic FNV-1a 256-bit folding only if subtle is unavailable in legacy runtimes
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (bytes[i] + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`.repeat(4);
}

export async function sealStitchParityBundle(payloadText: string): Promise<StitchCustodyBundle> {
  const encoder = new TextEncoder();
  const raw = encoder.encode(payloadText);
  const originalByteLength = raw.byteLength;
  const halfLength = Math.ceil(originalByteLength / 2);

  const shardABytes = new Uint8Array(halfLength);
  const shardBBytes = new Uint8Array(halfLength);
  const shardPBytes = new Uint8Array(halfLength);

  shardABytes.set(raw.subarray(0, halfLength));
  if (originalByteLength > halfLength) {
    shardBBytes.set(raw.subarray(halfLength));
  }
  for (let i = 0; i < halfLength; i++) {
    shardPBytes[i] = shardABytes[i] ^ shardBBytes[i];
  }

  const [payloadSha256, hashA, hashB, hashP] = await Promise.all([
    sha256Hex(raw),
    sha256Hex(shardABytes),
    sha256Hex(shardBBytes),
    sha256Hex(shardPBytes),
  ]);

  const makeShard = (slot: StitchShardSlot, sha256: string, bytes: Uint8Array): StitchShard => ({
    slot,
    magic: 'STCH',
    originalByteLength,
    halfLength,
    sha256,
    payloadHash: payloadSha256,
    dataHex: bytesToHex(bytes),
  });

  return {
    bundleId: `stch-${payloadSha256.slice(0, 12)}`,
    sealedAtIso: new Date().toISOString(),
    originalByteLength,
    payloadSha256,
    shards: [
      makeShard('A', hashA, shardABytes),
      makeShard('B', hashB, shardBBytes),
      makeShard('P', hashP, shardPBytes),
    ],
  };
}

export async function recoverFromStitchShards(
  availableShards: StitchShard[],
): Promise<StitchRecoveryResult> {
  if (availableShards.length < 2) {
    return {
      ok: false,
      usedSlots: availableShards.map((s) => s.slot),
      droppedSlot: null,
      diagnostic: `Insufficient shards: 2-of-3 required, only ${availableShards.length} provided.`,
    };
  }

  const bySlot = new Map<StitchShardSlot, StitchShard>();
  for (const shard of availableShards) {
    if (shard.magic !== 'STCH') {
      return {
        ok: false,
        usedSlots: [],
        droppedSlot: null,
        diagnostic: `Shard ${shard.slot} failed STCH magic header verification.`,
      };
    }
    const bytes = hexToBytes(shard.dataHex);
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== shard.sha256) {
      return {
        ok: false,
        usedSlots: [shard.slot],
        droppedSlot: null,
        diagnostic: `Tamper detected on Shard ${shard.slot}: SHA-256 mismatch.`,
      };
    }
    bySlot.set(shard.slot, shard);
  }

  const ref = availableShards[0];
  const halfLength = ref.halfLength;
  const originalByteLength = ref.originalByteLength;

  let shardABytes: Uint8Array;
  let shardBBytes: Uint8Array;
  let usedSlots: StitchShardSlot[];
  let droppedSlot: StitchShardSlot | null = null;

  if (bySlot.has('A') && bySlot.has('B')) {
    shardABytes = hexToBytes(bySlot.get('A')!.dataHex);
    shardBBytes = hexToBytes(bySlot.get('B')!.dataHex);
    usedSlots = ['A', 'B'];
    droppedSlot = bySlot.has('P') ? null : 'P';
  } else if (bySlot.has('A') && bySlot.has('P')) {
    shardABytes = hexToBytes(bySlot.get('A')!.dataHex);
    const shardPBytes = hexToBytes(bySlot.get('P')!.dataHex);
    shardBBytes = new Uint8Array(halfLength);
    for (let i = 0; i < halfLength; i++) {
      shardBBytes[i] = shardABytes[i] ^ shardPBytes[i];
    }
    usedSlots = ['A', 'P'];
    droppedSlot = 'B';
  } else if (bySlot.has('B') && bySlot.has('P')) {
    shardBBytes = hexToBytes(bySlot.get('B')!.dataHex);
    const shardPBytes = hexToBytes(bySlot.get('P')!.dataHex);
    shardABytes = new Uint8Array(halfLength);
    for (let i = 0; i < halfLength; i++) {
      shardABytes[i] = shardBBytes[i] ^ shardPBytes[i];
    }
    usedSlots = ['B', 'P'];
    droppedSlot = 'A';
  } else {
    return {
      ok: false,
      usedSlots: [],
      droppedSlot: null,
      diagnostic: 'Need at least two distinct Stitch shard slots (A, B, or P).',
    };
  }

  const combined = new Uint8Array(halfLength * 2);
  combined.set(shardABytes, 0);
  combined.set(shardBBytes, halfLength);
  const trimmed = combined.subarray(0, originalByteLength);

  const recoveredSha256 = await sha256Hex(trimmed);
  if (recoveredSha256 !== ref.payloadHash) {
    return {
      ok: false,
      usedSlots,
      droppedSlot,
      recoveredSha256,
      diagnostic: 'Recovered payload hash does not match sealed Stitch digest.',
    };
  }

  const decoder = new TextDecoder();
  return {
    ok: true,
    recoveredText: decoder.decode(trimmed),
    recoveredSha256,
    usedSlots,
    droppedSlot,
    diagnostic: droppedSlot
      ? `Bit-exact recovery verified from shards [${usedSlots.join(' + ')}] after dropping Shard ${droppedSlot}.`
      : `Bit-exact integrity verified across full Stitch shard quorum [${usedSlots.join(' + ')}].`,
  };
}
