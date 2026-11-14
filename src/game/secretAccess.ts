const _SALT_PREFIX = 'sultan_realm_k9#v2:';
const _SEED_LANES = [0x811c9dc5, 0x9e3779b1, 0x85ebca6b, 0xc2b2ae35] as const;
const _PRIME_LANES = [0x01000193, 0x85ebca77, 0xc2b2ae3d, 0x27d4eb2f] as const;

// One-way salted 128-bit digests (no plaintext secret tokens stored in source)
const _AUTHORIZED_DIGESTS = new Set<string>([
  '2cd7bc1396fd0025721a40c174705f89',
  '514d2fcb0280e13b9fb7e0a78860dcb1',
]);

const _textEncoder = new TextEncoder();

function computeAccessDigest(rawInput: string): string {
  const bytes = _textEncoder.encode(_SALT_PREFIX + rawInput.trim());
  let digest = '';

  for (let lane = 0; lane < 4; lane++) {
    let h = _SEED_LANES[lane] >>> 0;
    const prime = _PRIME_LANES[lane];
    for (let i = 0; i < bytes.length; i++) {
      h = (h ^ (bytes[i] + (i + lane) * 17)) >>> 0;
      h = Math.imul(h, prime) >>> 0;
      h = (h ^ (h >>> 15)) >>> 0;
    }
    h = Math.imul((h ^ (h >>> 13)) >>> 0, 0x5bd1e995) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    digest += h.toString(16).padStart(8, '0');
  }

  return digest;
}

/**
 * Verifies whether the provided Sultan name unlocks hidden test controls
 * using a one-way salted digest comparison.
 */
export function hasTimeTestAccess(sultanName: string): boolean {
  const trimmed = sultanName.trim();
  if (!trimmed) return false;
  return _AUTHORIZED_DIGESTS.has(computeAccessDigest(trimmed));
}
