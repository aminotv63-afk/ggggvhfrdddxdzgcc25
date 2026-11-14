/**
 * Procedural Web Audio Sound Generator (Zero external MP3 dependencies)
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private mainOutGain: GainNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;
  private _enabled: boolean = true;
  private lastStepTime = 0;

  // Continuous ambient soundscape graph
  private ambienceStarted: boolean = false;
  private ambienceMasterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private seaGain: GainNode | null = null;
  private seaFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private crowdBedGain: GainNode | null = null;
  private crowdVoiceBus: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];

  private windLfoPhase = 0;
  private seaLfoPhase = 0;
  private crowdSyllableTimer = 0;

  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(val: boolean) {
    this._enabled = val;
    if (!val && this.ambienceMasterGain && this.ctx) {
      this.ambienceMasterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    } else if (val && this.ambienceMasterGain && this.ctx) {
      this.ambienceMasterGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.15);
    }
  }

  public unlock() {
    this.init();
  }

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createSeamlessNoiseBuffer(seconds: number, warmColor: number = 0.5): AudioBuffer | null {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const len = Math.floor(sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + warmColor * 0.08 * white) / (1 + warmColor * 0.08);
      data[i] = white * (1 - warmColor * 0.72) + lastOut * (warmColor * 2.2);
    }

    // Crossfade end into start (~120ms) so looping is completely click-free
    const fadeSamples = Math.min(Math.floor(sampleRate * 0.12), Math.floor(len * 0.15));
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const tailIdx = len - fadeSamples + i;
      const blended = data[i] * t + data[tailIdx] * (1 - t);
      data[i] = blended;
      data[tailIdx] = blended;
    }

    return buffer;
  }

  private getOutputNode(): AudioNode | null {
    if (!this.ctx) return null;
    if (!this.mainOutGain) {
      const out = this.ctx.createGain();
      out.gain.setValueAtTime(1.0, this.ctx.currentTime);
      out.connect(this.ctx.destination);
      this.mainOutGain = out;
    }
    return this.mainOutGain;
  }

  public getRecordingAudioStream(): MediaStream | null {
    this.init();
    if (!this.ctx || typeof this.ctx.createMediaStreamDestination !== 'function') return null;
    const out = this.getOutputNode();
    if (!out) return null;
    if (!this.recordDest) {
      this.recordDest = this.ctx.createMediaStreamDestination();
      out.connect(this.recordDest);
    }
    return this.recordDest.stream;
  }

  private ensureAmbienceGraph() {
    if (this.ambienceStarted || !this.ctx) return;
    const ctx = this.ctx;

    try {
      const master = ctx.createGain();
      master.gain.setValueAtTime(this._enabled ? 1.0 : 0, ctx.currentTime);
      master.connect(this.getOutputNode() || ctx.destination);
      this.ambienceMasterGain = master;

      // 1. Continuous Wind Layer
      const windBuf = this.createSeamlessNoiseBuffer(3.6, 0.82);
      if (windBuf) {
        const windSrc = ctx.createBufferSource();
        windSrc.buffer = windBuf;
        windSrc.loop = true;

        const windFilter = ctx.createBiquadFilter();
        windFilter.type = 'bandpass';
        windFilter.frequency.setValueAtTime(340, ctx.currentTime);
        windFilter.Q.setValueAtTime(1.15, ctx.currentTime);

        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0, ctx.currentTime);

        windSrc.connect(windFilter);
        windFilter.connect(windGain);
        windGain.connect(master);
        windSrc.start();

        this.windFilter = windFilter;
        this.windGain = windGain;
        this.ambientNodes.push(windSrc, windFilter, windGain);
      }

      // 2. Continuous Sea Surf Layer
      const seaBuf = this.createSeamlessNoiseBuffer(4.2, 0.9);
      if (seaBuf) {
        const seaSrc = ctx.createBufferSource();
        seaSrc.buffer = seaBuf;
        seaSrc.loop = true;

        const seaFilter = ctx.createBiquadFilter();
        seaFilter.type = 'lowpass';
        seaFilter.frequency.setValueAtTime(480, ctx.currentTime);
        seaFilter.Q.setValueAtTime(0.7, ctx.currentTime);

        const seaGain = ctx.createGain();
        seaGain.gain.setValueAtTime(0, ctx.currentTime);

        seaSrc.connect(seaFilter);
        seaFilter.connect(seaGain);
        seaGain.connect(master);
        seaSrc.start();

        this.seaFilter = seaFilter;
        this.seaGain = seaGain;
        this.ambientNodes.push(seaSrc, seaFilter, seaGain);
      }

      // 3. Continuous Rain Layer (crisp shower + soft low patter)
      const rainBuf = this.createSeamlessNoiseBuffer(3.0, 0.25);
      if (rainBuf) {
        const rainSrc = ctx.createBufferSource();
        rainSrc.buffer = rainBuf;
        rainSrc.loop = true;

        const rainHp = ctx.createBiquadFilter();
        rainHp.type = 'highpass';
        rainHp.frequency.setValueAtTime(520, ctx.currentTime);

        const rainLp = ctx.createBiquadFilter();
        rainLp.type = 'lowpass';
        rainLp.frequency.setValueAtTime(5200, ctx.currentTime);

        const rainGain = ctx.createGain();
        rainGain.gain.setValueAtTime(0, ctx.currentTime);

        rainSrc.connect(rainHp);
        rainHp.connect(rainLp);
        rainLp.connect(rainGain);
        rainGain.connect(master);
        rainSrc.start();

        this.rainGain = rainGain;
        this.ambientNodes.push(rainSrc, rainHp, rainLp, rainGain);
      }

      // 4. Unintelligible Crowd Murmur Bed + Dynamic Syllable Bus
      const crowdBuf = this.createSeamlessNoiseBuffer(3.4, 0.65);
      if (crowdBuf) {
        const crowdSrc = ctx.createBufferSource();
        crowdSrc.buffer = crowdBuf;
        crowdSrc.loop = true;

        const crowdBp = ctx.createBiquadFilter();
        crowdBp.type = 'bandpass';
        crowdBp.frequency.setValueAtTime(620, ctx.currentTime);
        crowdBp.Q.setValueAtTime(1.6, ctx.currentTime);

        const crowdBedGain = ctx.createGain();
        crowdBedGain.gain.setValueAtTime(0, ctx.currentTime);

        crowdSrc.connect(crowdBp);
        crowdBp.connect(crowdBedGain);
        crowdBedGain.connect(master);
        crowdSrc.start();

        this.crowdBedGain = crowdBedGain;
        this.ambientNodes.push(crowdSrc, crowdBp, crowdBedGain);
      }

      const crowdVoiceBus = ctx.createGain();
      crowdVoiceBus.gain.setValueAtTime(1.0, ctx.currentTime);
      crowdVoiceBus.connect(master);
      this.crowdVoiceBus = crowdVoiceBus;
      this.ambientNodes.push(crowdVoiceBus);

      this.ambienceStarted = true;
    } catch {
      // ignore Web Audio init issues
    }
  }

  public stopAmbience() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.ambienceMasterGain) {
      this.ambienceMasterGain.gain.setTargetAtTime(0, now, 0.06);
    }
    if (this.windGain) this.windGain.gain.setTargetAtTime(0, now, 0.06);
    if (this.seaGain) this.seaGain.gain.setTargetAtTime(0, now, 0.06);
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(0, now, 0.06);
    if (this.crowdBedGain) this.crowdBedGain.gain.setTargetAtTime(0, now, 0.06);
  }

  public updateAmbience(
    delta: number,
    opts: {
      seaProximity: number;
      crowdProximity: number;
      rainIntensity: number;
      windBoost?: number;
    }
  ) {
    if (!this._enabled) {
      if (this.ambienceMasterGain && this.ctx) {
        this.ambienceMasterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      return;
    }

    // Wait until AudioContext exists & is running (after first user gesture)
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.ensureAmbienceGraph();
    if (!this.ambienceStarted) return;

    const now = this.ctx.currentTime;
    if (this.ambienceMasterGain) {
      this.ambienceMasterGain.gain.setTargetAtTime(1.0, now, 0.12);
    }

    // 1. Wind swell modulation
    this.windLfoPhase += delta * 0.42;
    const windSwell = 0.5 + 0.5 * Math.sin(this.windLfoPhase) * Math.cos(this.windLfoPhase * 0.37);
    const boost = Math.max(0, Math.min(1, opts.windBoost ?? 0));
    const targetWindGain = 0.024 + windSwell * 0.022 + boost * 0.045;
    if (this.windGain) {
      this.windGain.gain.setTargetAtTime(targetWindGain, now, 0.18);
    }
    if (this.windFilter) {
      this.windFilter.frequency.setTargetAtTime(260 + windSwell * 210 + boost * 320, now, 0.25);
    }

    // 2. Ocean wave surf modulation
    this.seaLfoPhase += delta * 0.95; // ~6.6s rhythmic wave wash cycle
    const waveSurge = Math.pow(0.5 + 0.5 * Math.sin(this.seaLfoPhase), 1.45);
    const seaProx = Math.max(0, Math.min(1, opts.seaProximity));
    const targetSeaGain = seaProx * (0.045 + waveSurge * 0.135);
    if (this.seaGain) {
      this.seaGain.gain.setTargetAtTime(targetSeaGain, now, 0.14);
    }
    if (this.seaFilter) {
      this.seaFilter.frequency.setTargetAtTime(320 + waveSurge * 540, now, 0.18);
    }

    // 3. Rain intensity
    const rain = Math.max(0, Math.min(1, opts.rainIntensity));
    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(rain * 0.15, now, 0.16);
    }

    // 4. Unintelligible Crowd Chatter (meaningless multi-voice background babble)
    const crowd = Math.max(0, Math.min(1, opts.crowdProximity));
    if (this.crowdBedGain) {
      this.crowdBedGain.gain.setTargetAtTime(crowd * 0.036, now, 0.18);
    }

    if (crowd > 0.06 && this.crowdVoiceBus) {
      this.crowdSyllableTimer -= delta;
      if (this.crowdSyllableTimer <= 0) {
        this.crowdSyllableTimer = (0.085 + Math.random() * 0.12) / (0.65 + crowd * 0.9);
        this.spawnBabbleSyllable(crowd);
      }
    }
  }

  /**
   * Generates a short, soft, completely unintelligible vocal murmur syllable
   * so nearby groups of citizens sound like real people chatting in the background.
   */
  private spawnBabbleSyllable(crowdStrength: number) {
    if (!this.ctx || !this.crowdVoiceBus) return;
    try {
      const now = this.ctx.currentTime;
      const dur = 0.09 + Math.random() * 0.11;
      const osc = this.ctx.createOscillator();
      const formant = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      // Mix male & softer conversational pitches with random inflection glide
      const basePitch = 112 + Math.random() * 145;
      const endPitch = basePitch * (0.86 + Math.random() * 0.28);
      osc.type = Math.random() < 0.6 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(basePitch, now);
      osc.frequency.linearRampToValueAtTime(endPitch, now + dur);

      // Vowel-like formant sweep creates speech-like cadence with zero real words
      const f1Start = 420 + Math.random() * 520;
      const f1End = 380 + Math.random() * 680;
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(f1Start, now);
      formant.frequency.linearRampToValueAtTime(f1End, now + dur);
      formant.Q.setValueAtTime(3.6 + Math.random() * 1.8, now);

      const peak = crowdStrength * (0.022 + Math.random() * 0.022);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(peak, now + dur * 0.28);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(formant);
      formant.connect(gain);
      gain.connect(this.crowdVoiceBus);

      osc.start(now);
      osc.stop(now + dur + 0.015);
    } catch {
      // ignore
    }
  }

  public playThunder() {
    if (!this._enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Sharp initial atmospheric lightning crack
      const crackDur = 0.35;
      const crackLen = Math.floor(this.ctx.sampleRate * crackDur);
      const crackBuf = this.ctx.createBuffer(1, crackLen, this.ctx.sampleRate);
      const crackData = crackBuf.getChannelData(0);
      for (let i = 0; i < crackLen; i++) {
        crackData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.075));
      }
      const crackSrc = this.ctx.createBufferSource();
      crackSrc.buffer = crackBuf;

      const crackFilter = this.ctx.createBiquadFilter();
      crackFilter.type = 'bandpass';
      crackFilter.frequency.setValueAtTime(1400, now);
      crackFilter.frequency.exponentialRampToValueAtTime(240, now + crackDur);

      const crackGain = this.ctx.createGain();
      crackGain.gain.setValueAtTime(0.36, now);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + crackDur);

      crackSrc.connect(crackFilter);
      crackFilter.connect(crackGain);
      crackGain.connect(this.getOutputNode() || this.ctx.destination);
      crackSrc.start(now);

      // 2. Deep rolling sky thunder rumble with secondary echo swell
      const rollDur = 2.85;
      const rollLen = Math.floor(this.ctx.sampleRate * rollDur);
      const rollBuf = this.ctx.createBuffer(1, rollLen, this.ctx.sampleRate);
      const rollData = rollBuf.getChannelData(0);
      let prev = 0;
      for (let i = 0; i < rollLen; i++) {
        const t = i / this.ctx.sampleRate;
        const swell =
          Math.exp(-t * 1.15) * (0.75 + 0.45 * Math.sin(t * 7.5) * Math.sin(t * 3.1));
        prev = (prev + 0.14 * (Math.random() * 2 - 1)) / 1.14;
        rollData[i] = prev * 3.4 * Math.max(0.05, swell);
      }
      const rollSrc = this.ctx.createBufferSource();
      rollSrc.buffer = rollBuf;

      const rollFilter = this.ctx.createBiquadFilter();
      rollFilter.type = 'lowpass';
      rollFilter.frequency.setValueAtTime(210, now);
      rollFilter.frequency.linearRampToValueAtTime(78, now + rollDur);

      const rollGain = this.ctx.createGain();
      rollGain.gain.setValueAtTime(0.02, now);
      rollGain.gain.linearRampToValueAtTime(0.48, now + 0.16);
      rollGain.gain.exponentialRampToValueAtTime(0.001, now + rollDur);

      rollSrc.connect(rollFilter);
      rollFilter.connect(rollGain);
      rollGain.connect(this.getOutputNode() || this.ctx.destination);
      rollSrc.start(now);
    } catch {
      // ignore
    }
  }

  public playFootstep(isRunning: boolean) {
    if (!this._enabled) return;
    this.init();
    if (!this.ctx) return;

    const nowMs = performance.now();
    const interval = isRunning ? 265 : 415;
    if (nowMs - this.lastStepTime < interval) return;
    this.lastStepTime = nowMs;

    try {
      const now = this.ctx.currentTime;

      // 1. Organic step thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      const baseFreq = isRunning ? 115 : 88;
      osc.frequency.setValueAtTime(baseFreq + Math.random() * 22, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.085);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);

      const vol = isRunning ? 0.14 : 0.095;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.095);

      // 2. Crisp ground/grass scuff noise layer
      const dur = 0.065;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.022));
      }
      const scuff = this.ctx.createBufferSource();
      scuff.buffer = buffer;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(950 + Math.random() * 380, now);
      bp.Q.setValueAtTime(1.1, now);

      const scuffGain = this.ctx.createGain();
      scuffGain.gain.setValueAtTime(isRunning ? 0.085 : 0.052, now);
      scuffGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      scuff.connect(bp);
      bp.connect(scuffGain);
      scuffGain.connect(this.getOutputNode() || this.ctx.destination);
      scuff.start(now);
    } catch {
      // Audio fallback silent
    }
  }

  public playJump() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(380, this.ctx.currentTime + 0.16);

      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.19);
    } catch {
      // ignore
    }
  }

  public playLand() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  }

  public playBoundaryBump() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      // Mystical mist chime / thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.26);
    } catch {
      // ignore
    }
  }

  public playArrestOrder() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(165, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.32);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520, now);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // ignore
    }
  }

  public playLeverPull() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(62, now + 0.16);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    } catch {
      // ignore
    }
  }

  public playRopeCreak() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(98, now);
      osc.frequency.linearRampToValueAtTime(142, now + 0.14);
      osc.frequency.linearRampToValueAtTime(86, now + 0.28);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.29);

      osc.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      // ignore
    }
  }

  public playScreamBurst() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const dur = 0.68 + Math.random() * 0.28;
      const osc = this.ctx.createOscillator();
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      const formant = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      const basePitch = 290 + Math.random() * 90;
      osc.frequency.setValueAtTime(basePitch * 0.85, now);
      osc.frequency.linearRampToValueAtTime(basePitch * 1.28, now + dur * 0.35);
      osc.frequency.exponentialRampToValueAtTime(basePitch * 0.68, now + dur);

      lfo.frequency.setValueAtTime(16 + Math.random() * 6, now);
      lfoGain.gain.setValueAtTime(24, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(820, now);
      formant.frequency.linearRampToValueAtTime(1150, now + dur * 0.4);
      formant.frequency.linearRampToValueAtTime(640, now + dur);
      formant.Q.setValueAtTime(3.2, now);

      gain.gain.setValueAtTime(0.005, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      osc.connect(formant);
      formant.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);

      lfo.start(now);
      osc.start(now);
      lfo.stop(now + dur + 0.02);
      osc.stop(now + dur + 0.02);
    } catch {
      // ignore
    }
  }

  public playDeathThud() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(105, now);
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.28);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.31);
    } catch {
      // ignore
    }
  }

  public playWaterSplash() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.65);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.22));
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(340, now + 0.6);
      filter.Q.setValueAtTime(1.1, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.64);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      noise.start(now);

      // Low plunge thump
      const plunge = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      plunge.type = 'sine';
      plunge.frequency.setValueAtTime(160, now);
      plunge.frequency.exponentialRampToValueAtTime(48, now + 0.32);
      pGain.gain.setValueAtTime(0.22, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      plunge.connect(pGain);
      pGain.connect(this.getOutputNode() || this.ctx.destination);
      plunge.start(now);
      plunge.stop(now + 0.35);
    } catch {
      // ignore
    }
  }

  public playCoinChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [987.77, 1318.51]; // B5 -> E6 crisp gold coin ring
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const t = now + idx * 0.065;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain);
        gain.connect(this.getOutputNode() || this.ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch {
      // ignore
    }
  }

  public playCannonBlast() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;

      // 1. Heavy sub-bass cannon punch
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(125, now);
      subOsc.frequency.exponentialRampToValueAtTime(24, now + 0.55);
      subGain.gain.setValueAtTime(0.42, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
      subOsc.connect(subGain);
      subGain.connect(this.getOutputNode() || this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.64);

      // 2. Concussive gunpowder blast noise burst
      const dur = 0.95;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.24));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 0.85);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.45, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.getOutputNode() || this.ctx.destination);
      noise.start(now);

      // 3. Ascending skyward shell whistle tail
      const whistle = this.ctx.createOscillator();
      const wGain = this.ctx.createGain();
      whistle.type = 'sine';
      whistle.frequency.setValueAtTime(520, now + 0.05);
      whistle.frequency.exponentialRampToValueAtTime(210, now + 0.72);
      wGain.gain.setValueAtTime(0.06, now + 0.05);
      wGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      whistle.connect(wGain);
      wGain.connect(this.getOutputNode() || this.ctx.destination);
      whistle.start(now + 0.05);
      whistle.stop(now + 0.76);
    } catch {
      // ignore
    }
  }

  public playDistantExplosion() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(82, now);
      osc.frequency.exponentialRampToValueAtTime(22, now + 0.75);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.82);
      osc.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.85);

      const dur = 0.85;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.28));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(95, now + dur);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.22, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.getOutputNode() || this.ctx.destination);
      noise.start(now);
    } catch {
      // ignore
    }
  }

  public playSwordDraw() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1150, now);
      osc.frequency.exponentialRampToValueAtTime(2650, now + 0.16);
      osc.frequency.exponentialRampToValueAtTime(1920, now + 0.32);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.37);

      const dur = 0.2;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.07));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(3200, now);
      hp.Q.setValueAtTime(2.4, now);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.14, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(hp);
      hp.connect(nGain);
      nGain.connect(this.getOutputNode() || this.ctx.destination);
      noise.start(now);
    } catch {
      // ignore
    }
  }

  public playSwordSlash() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const dur = 0.22;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.055));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1900, now);
      filter.frequency.exponentialRampToValueAtTime(480, now + dur);
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.24, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.getOutputNode() || this.ctx.destination);
      noise.start(now);

      const clink = this.ctx.createOscillator();
      const cGain = this.ctx.createGain();
      clink.type = 'sine';
      clink.frequency.setValueAtTime(2200, now + 0.04);
      clink.frequency.exponentialRampToValueAtTime(1180, now + 0.16);
      cGain.gain.setValueAtTime(0.08, now + 0.04);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      clink.connect(cGain);
      cGain.connect(this.getOutputNode() || this.ctx.destination);
      clink.start(now + 0.04);
      clink.stop(now + 0.19);
    } catch {
      // ignore
    }
  }

  public playLionRoar() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(118, now);
      osc.frequency.linearRampToValueAtTime(152, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(58, now + 0.92);

      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(620, now);
      lp.frequency.exponentialRampToValueAtTime(210, now + 0.92);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.26, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

      osc.connect(lp);
      lp.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.96);
    } catch {
      // ignore
    }
  }

  public playStoneGrind() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const dur = 1.1;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (0.4 + 0.6 * Math.sin((i / bufSize) * Math.PI));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      noise.start(now);
    } catch {
      // ignore
    }
  }

  public playSwordPullStrain(progress01: number) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const base = 340 + progress01 * 520;
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.18);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.getOutputNode() || this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    } catch {
      // ignore
    }
  }

  public playWarHorn() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [146.83, 196.0, 220.0, 293.66];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const start = now + idx * 0.19;
        const dur = idx === notes.length - 1 ? 0.72 : 0.24;
        const osc = this.ctx.createOscillator();
        const lp = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, start);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(920, start);
        lp.frequency.exponentialRampToValueAtTime(420, start + dur);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.18, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(lp);
        lp.connect(gain);
        gain.connect(this.getOutputNode() || this.ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      });
    } catch {
      // ignore
    }
  }

  public playBattleOutcome(victory: boolean) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const seq = victory
        ? [523.25, 659.25, 783.99, 1046.5]
        : [293.66, 261.63, 220.0, 174.61];
      seq.forEach((freq, idx) => {
        if (!this.ctx) return;
        const t = now + idx * 0.16;
        const dur = idx === seq.length - 1 ? 0.55 : 0.22;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = victory ? 'triangle' : 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(victory ? 0.18 : 0.14, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(this.getOutputNode() || this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur + 0.02);
      });
    } catch {
      // ignore
    }
  }
}

export const soundManager = new SoundManager();
