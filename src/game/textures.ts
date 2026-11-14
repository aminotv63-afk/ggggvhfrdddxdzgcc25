import * as THREE from 'three';

/**
 * Procedural canvas textures generator with automatic canvas/texture caching
 * so heavy textures are drawn and uploaded to GPU only once (zero visual change, lower RAM & startup load).
 */

const _sharedTextureCache = new Map<string, THREE.CanvasTexture>();
const _sharedCanvasCache = new Map<string, HTMLCanvasElement>();

function getOrCreateSharedTexture(
  key: string,
  builder: () => THREE.CanvasTexture
): THREE.CanvasTexture {
  const existing = _sharedTextureCache.get(key);
  if (existing) return existing;
  const tex = builder();
  // Retain shared cached textures across scene retries/disposals so GPU uploads aren't corrupted
  tex.dispose = () => {};
  _sharedTextureCache.set(key, tex);
  return tex;
}

function getOrCreateCanvas(
  key: string,
  width: number,
  height: number,
  painter: (ctx: CanvasRenderingContext2D) => void
): HTMLCanvasElement {
  const existing = _sharedCanvasCache.get(key);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    painter(ctx);
  }
  _sharedCanvasCache.set(key, canvas);
  return canvas;
}

export function createCrackedGreyTexture(): THREE.CanvasTexture {
  const canvas = getOrCreateCanvas('cracked_grey_512', 512, 512, (ctx) => {
    // Base neutral cracked stone grey
    ctx.fillStyle = '#85888d';
    ctx.fillRect(0, 0, 512, 512);

    // Mineral grain & subtle grey stone patches
    for (let i = 0; i < 4500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 0.8 + Math.random() * 2.6;
      const pick = Math.random();
      if (pick < 0.35) {
        ctx.fillStyle = '#94979c';
      } else if (pick < 0.7) {
        ctx.fillStyle = '#73767b';
      } else {
        ctx.fillStyle = '#65686d';
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Seamless cracked grid network (wrapped across 512x512 edges)
    const cells = 6;
    const step = 512 / cells;
    const pts: { x: number; y: number }[][] = [];
    for (let gy = 0; gy <= cells; gy++) {
      pts[gy] = [];
      for (let gx = 0; gx <= cells; gx++) {
        // Periodic jitter so edges tile cleanly
        const baseX = gx % cells;
        const baseY = gy % cells;
        const seed = (baseX * 73856093) ^ (baseY * 19349663);
        const jx = (((Math.sin(seed) * 10000) % 1) - 0.5) * step * 0.55;
        const jy = (((Math.cos(seed * 1.7) * 10000) % 1) - 0.5) * step * 0.55;
        pts[gy][gx] = {
          x: gx * step + jx,
          y: gy * step + jy,
        };
      }
    }

    const drawJaggedCrack = (x1: number, y1: number, x2: number, y2: number, width: number) => {
      const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * 14;
      const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * 14;

      // Subtle light bevel edge beside crack
      ctx.strokeStyle = 'rgba(185, 190, 196, 0.35)';
      ctx.lineWidth = width + 1.8;
      ctx.beginPath();
      ctx.moveTo(x1 + 1, y1 + 1);
      ctx.lineTo(midX + 1, midY + 1);
      ctx.lineTo(x2 + 1, y2 + 1);
      ctx.stroke();

      // Deep dark grey crack fissure
      ctx.strokeStyle = '#3c3f44';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(midX, midY);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    for (let gy = 0; gy < cells; gy++) {
      for (let gx = 0; gx < cells; gx++) {
        const p = pts[gy][gx];
        const pRight = pts[gy][gx + 1];
        const pDown = pts[gy + 1][gx];
        drawJaggedCrack(p.x, p.y, pRight.x, pRight.y, 2.2 + Math.random() * 1.2);
        drawJaggedCrack(p.x, p.y, pDown.x, pDown.y, 2.2 + Math.random() * 1.2);

        // Occasional fine secondary hairline crack
        if (Math.random() > 0.45) {
          const pDiag = pts[gy + 1][gx + 1];
          drawJaggedCrack(p.x, p.y, (p.x + pDiag.x) / 2, (p.y + pDiag.y) / 2, 1.3);
        }
      }
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(50, 50);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBrownRoadTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('brown_road', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Rich warm brown packed dirt road base
    ctx.fillStyle = '#7c5333';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle worn wheel/path tracks & tonal variation
    const trackGrad = ctx.createLinearGradient(0, 0, 512, 0);
    trackGrad.addColorStop(0, '#623f24');
    trackGrad.addColorStop(0.18, '#7a5233');
    trackGrad.addColorStop(0.5, '#8c603e');
    trackGrad.addColorStop(0.82, '#7a5233');
    trackGrad.addColorStop(1, '#623f24');
    ctx.fillStyle = trackGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Fine brown soil speckles & small road pebbles
    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 0.8 + Math.random() * 2.5;
      const pick = Math.random();
      if (pick < 0.35) {
        ctx.fillStyle = '#996d49';
      } else if (pick < 0.7) {
        ctx.fillStyle = '#5c3b21';
      } else {
        ctx.fillStyle = '#a37b56';
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 14);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createCobblestoneTexture(): THREE.CanvasTexture {
  const canvas = getOrCreateCanvas('cobblestone_512', 512, 512, (ctx) => {
    ctx.fillStyle = '#7a7670';
    ctx.fillRect(0, 0, 512, 512);

    const tileSize = 64;
    for (let y = 0; y < 512; y += tileSize) {
      const rowOffset = (Math.floor(y / tileSize) % 2) * (tileSize / 2);
      for (let x = -tileSize; x < 512 + tileSize; x += tileSize) {
        const stoneX = x + rowOffset + (Math.random() - 0.5) * 6;
        const stoneY = y + (Math.random() - 0.5) * 6;
        const w = tileSize - 8 + (Math.random() - 0.5) * 6;
        const h = tileSize - 8 + (Math.random() - 0.5) * 6;

        const shade = 140 + Math.floor(Math.random() * 45);
        ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 12})`;
        ctx.beginPath();
        ctx.roundRect(stoneX, stoneY, w, h, 8);
        ctx.fill();

        // Shadow border
        ctx.strokeStyle = '#4a4642';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createSmokeParticleTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('smoke_particle', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
    grad.addColorStop(0, 'rgba(235, 240, 245, 0.9)');
    grad.addColorStop(0.35, 'rgba(215, 224, 232, 0.5)');
    grad.addColorStop(0.7, 'rgba(190, 202, 212, 0.15)');
    grad.addColorStop(1, 'rgba(190, 202, 212, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createRadialShadowTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('radial_shadow', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
    grad.addColorStop(0, 'rgba(10, 20, 10, 0.65)');
    grad.addColorStop(0.5, 'rgba(10, 20, 10, 0.35)');
    grad.addColorStop(1, 'rgba(10, 20, 10, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createRoyalPatternTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('royal_pattern', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Royal Emerald base
    ctx.fillStyle = '#0f4c3a';
    ctx.fillRect(0, 0, 256, 256);

    // Gold ornate damask filigree
    ctx.strokeStyle = '#dfb141';
    ctx.fillStyle = '#f3ca65';
    ctx.lineWidth = 2;

    // Diamond repeats
    const step = 64;
    for (let x = 0; x <= 256; x += step) {
      for (let y = 0; y <= 256; y += step) {
        ctx.beginPath();
        ctx.moveTo(x, y - 16);
        ctx.lineTo(x + 16, y);
        ctx.lineTo(x, y + 16);
        ctx.lineTo(x - 16, y);
        ctx.closePath();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createSunGlowTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('sun_glow', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const grad = ctx.createRadialGradient(128, 128, 6, 128, 128, 126);
    grad.addColorStop(0, 'rgba(255, 232, 24, 1.0)');
    grad.addColorStop(0.26, 'rgba(255, 212, 0, 0.85)');
    grad.addColorStop(0.55, 'rgba(255, 190, 0, 0.36)');
    grad.addColorStop(0.82, 'rgba(255, 168, 0, 0.08)');
    grad.addColorStop(1, 'rgba(255, 168, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createMoonGlowTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('moon_glow', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
    grad.addColorStop(0, 'rgba(235, 245, 255, 0.95)');
    grad.addColorStop(0.28, 'rgba(195, 222, 255, 0.65)');
    grad.addColorStop(0.58, 'rgba(130, 178, 245, 0.24)');
    grad.addColorStop(0.85, 'rgba(85, 130, 210, 0.06)');
    grad.addColorStop(1, 'rgba(85, 130, 210, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createStoneMasonryTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('stone_masonry', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#6d6963';
    ctx.fillRect(0, 0, 256, 256);

    const rows = 6;
    const rowH = 256 / rows;
    for (let r = 0; r < rows; r++) {
      const cols = 4;
      const colW = 256 / cols;
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        const shade = 122 + Math.floor(Math.random() * 32);
        ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 10})`;
        ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
        ctx.strokeStyle = '#4f4b45';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, colW - 4, rowH - 4);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 1);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createWoodPlankTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('wood_plank', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#6b4426';
    ctx.fillRect(0, 0, 256, 256);

    const plankH = 32;
    for (let y = 0; y < 256; y += plankH) {
      const shade = (Math.random() - 0.5) * 18;
      ctx.fillStyle = `rgb(${112 + shade}, ${72 + shade * 0.7}, ${41 + shade * 0.5})`;
      ctx.fillRect(0, y + 1, 256, plankH - 2);

      ctx.strokeStyle = 'rgba(46, 26, 12, 0.45)';
      ctx.lineWidth = 1.5;
      for (let g = 0; g < 6; g++) {
        const gy = y + 5 + g * 4;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(256, gy + (Math.random() - 0.5) * 3);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createRoofShingleTexture(baseHex: string = '#8e2b24'): THREE.CanvasTexture {
  return getOrCreateSharedTexture(`roof_shingle_${baseHex}`, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    const rows = 8;
    const rowH = 256 / rows;
    const cols = 8;
    const colW = 256 / cols;

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (colW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * colW + offset;
        const y = r * rowH;
        const alpha = 0.06 + Math.random() * 0.14;
        ctx.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha * 0.6})` : `rgba(0,0,0,${alpha})`;
        ctx.fillRect(x + 1, y + 1, colW - 2, rowH - 2);
        ctx.strokeStyle = 'rgba(20, 12, 10, 0.32)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 1, y + 1, colW - 2, rowH - 2);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 2);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createWellWaterTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('well_water', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.55, '#0284c7');
    grad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Concentric bright water ripple rings
    ctx.lineWidth = 2.2;
    for (let r = 20; r <= 110; r += 22) {
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.42)';
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sparkling water glints
    ctx.fillStyle = 'rgba(224, 242, 254, 0.72)';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const rad = 18 + (i % 4) * 24;
      ctx.beginPath();
      ctx.arc(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createLushGrassTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('lush_grass', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Rich emerald-sage royal meadow base
    ctx.fillStyle = '#4c8044';
    ctx.fillRect(0, 0, 512, 512);

    // Soft mossy variation patches
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 18 + Math.random() * 34;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(94, 145, 72, 0.25)' : 'rgba(56, 102, 48, 0.25)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crisp grass blade flecks & tiny meadow wildflowers
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const pick = Math.random();
      if (pick < 0.45) {
        ctx.fillStyle = '#629b52';
      } else if (pick < 0.88) {
        ctx.fillStyle = '#3b6b35';
      } else if (pick < 0.96) {
        ctx.fillStyle = '#89ba68';
      } else {
        ctx.fillStyle = '#f3df7c'; // subtle buttercup clover speck
      }
      ctx.fillRect(x, y, 2, 4);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(34, 34);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createOrchardLandTexture(): THREE.CanvasTexture {
  const canvas = getOrCreateCanvas('orchard_land_256', 256, 256, (ctx) => {
    ctx.fillStyle = '#8c6b43';
    ctx.fillRect(0, 0, 256, 256);

    // Neat plowed orchard rows
    for (let y = 0; y < 256; y += 32) {
      ctx.fillStyle = '#755632';
      ctx.fillRect(0, y, 256, 12);
      ctx.fillStyle = '#9d7a4f';
      ctx.fillRect(0, y + 14, 256, 8);
    }

    // Subtle green clover/sprouts along rows
    for (let i = 0; i < 650; i++) {
      ctx.fillStyle = Math.random() > 0.3 ? '#6b4d2c' : '#73994e';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBrokenGroundTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('broken_ground', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Fade outer edge smoothly into transparent/turf border with radial shattered core
    ctx.clearRect(0, 0, 512, 512);

    const grad = ctx.createRadialGradient(256, 256, 25, 256, 256, 248);
    grad.addColorStop(0.0, 'rgba(68, 56, 46, 0.98)');
    grad.addColorStop(0.55, 'rgba(92, 82, 72, 0.94)');
    grad.addColorStop(0.82, 'rgba(104, 96, 86, 0.72)');
    grad.addColorStop(1.0, 'rgba(76, 128, 68, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Shattered stone slab polygons around the center
    for (let i = 0; i < 42; i++) {
      const angle = (i / 42) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
      const rad = 28 + Math.random() * 175;
      const cx = 256 + Math.cos(angle) * rad;
      const cy = 256 + Math.sin(angle) * rad;
      const size = 12 + Math.random() * 24;
      const tone = 92 + Math.floor(Math.random() * 44);

      ctx.fillStyle = `rgba(${tone}, ${tone - 5}, ${tone - 12}, 0.86)`;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.6, cy - size * 0.3);
      ctx.lineTo(cx + size * 0.4, cy - size * 0.55);
      ctx.lineTo(cx + size * 0.65, cy + size * 0.35);
      ctx.lineTo(cx - size * 0.3, cy + size * 0.55);
      ctx.closePath();
      ctx.fill();
    }

    // Deep radial & branching ground cracks
    for (let ray = 0; ray < 18; ray++) {
      let x = 256 + (Math.random() - 0.5) * 26;
      let y = 256 + (Math.random() - 0.5) * 26;
      let angle = (ray / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const steps = 6 + Math.floor(Math.random() * 5);

      ctx.strokeStyle = '#1f1914';
      ctx.lineWidth = 4.2 + Math.random() * 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < steps; s++) {
        angle += (Math.random() - 0.5) * 0.7;
        const seg = 20 + Math.random() * 26;
        x += Math.cos(angle) * seg;
        y += Math.sin(angle) * seg;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Gravel pebbles & dirt grit
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 225;
      const gx = 256 + Math.cos(a) * r;
      const gy = 256 + Math.sin(a) * r;
      ctx.fillStyle = Math.random() > 0.45 ? 'rgba(42, 34, 28, 0.7)' : 'rgba(148, 138, 124, 0.65)';
      ctx.fillRect(gx, gy, 3, 3);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export function createBeachSandTexture(): THREE.CanvasTexture {
  return getOrCreateSharedTexture('beach_sand', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Warm Mediterranean golden coastal sand base
    ctx.fillStyle = '#e5cf9b';
    ctx.fillRect(0, 0, 512, 512);

    // Gentle wind & tide ripple bands
    for (let y = 0; y < 512; y += 24) {
      ctx.fillStyle = y % 48 === 0 ? 'rgba(210, 182, 125, 0.22)' : 'rgba(248, 232, 188, 0.22)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) {
        ctx.lineTo(x, y + Math.sin((x / 512) * Math.PI * 4) * 4);
      }
      ctx.lineTo(512, y + 14);
      ctx.lineTo(0, y + 14);
      ctx.closePath();
      ctx.fill();
    }

    // Fine sand grains & tiny seashells/pebbles
    for (let i = 0; i < 4200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 0.7 + Math.random() * 1.8;
      const pick = Math.random();
      if (pick < 0.42) {
        ctx.fillStyle = '#d3b679';
      } else if (pick < 0.8) {
        ctx.fillStyle = '#f2e0b4';
      } else if (pick < 0.96) {
        ctx.fillStyle = '#b99b62';
      } else {
        ctx.fillStyle = '#f8f1df'; // tiny bleached shell fleck
      }
      ctx.fillRect(x, y, r, r);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 42);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}
