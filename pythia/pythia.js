window.onload = () => {
    // ── DOM refs ──────────────────────────────────────────────────────────────
    const controlInput       = document.getElementById('control-input');
    const sourceInput        = document.getElementById('source-input');
    const sourceInputGroup   = document.getElementById('source-input-group');
    const playButton         = document.getElementById('play-button');
    const recordButton       = document.getElementById('record-button');
    const recordingsList     = document.getElementById('recordings-list');
    const selfSampleCheckbox = document.getElementById('self-sample-checkbox');
    const sourceDryCheckbox  = document.getElementById('source-dry-checkbox');
    const monitorCtrlCheckbox = document.getElementById('monitor-control-checkbox');
    const gateCheckbox       = document.getElementById('gate-checkbox');
    const pingPongCheckbox   = document.getElementById('ping-pong-checkbox');
    const timeGroup          = document.getElementById('time-group');
    const loopRadios         = document.querySelectorAll('input[name="loopmode"]');
    const thresholdGroup     = document.getElementById('threshold-group');
    const levelMeter         = document.getElementById('level-meter');

    // Viz
    const vizToggle          = document.getElementById('viz-toggle');
    const bufferSizeSelect   = document.getElementById('buffer-size');
    const vizPanel           = document.getElementById('viz-panel');
    const controlCanvas      = document.getElementById('control-canvas');
    const delayCanvas        = document.getElementById('delay-canvas');
    const sourceCanvas       = document.getElementById('source-canvas');
    const controlFileDisplay = document.getElementById('control-file-display');
    const sourceFileDisplay  = document.getElementById('source-file-display');

    // State toolbar
    const windowSelect   = document.getElementById('window-type');
    const presetSelect   = document.getElementById('preset-select');
    const saveStateBtn   = document.getElementById('save-state');
    const loadStateInput = document.getElementById('load-state');
    const timeSyncSelect = document.getElementById('time-sync');
    const timeSyncValue  = document.getElementById('time-sync-value');

    const sliders = {
        sidechainLookahead: document.getElementById('sidechain-lookahead'),
        threshold:     document.getElementById('threshold'),
        polarity:      document.getElementById('polarity'),
        grainSize:     document.getElementById('grain-size'),
        grainDensity:  document.getElementById('grain-density'),
        time:          document.getElementById('time'),
        bpm:           document.getElementById('bpm'),
        pitch:         document.getElementById('pitch'),
        pitchSpray:    document.getElementById('pitch-spray'),
        panSpray:      document.getElementById('pan-spray'),
        mix:           document.getElementById('mix'),
        scatter:       document.getElementById('scatter'),
        feedback:      document.getElementById('feedback'),
        damping:       document.getElementById('damping'),
        feedbackGrain: document.getElementById('feedback-grain'),
        densityJitter: document.getElementById('density-jitter'),
        envelopeShape: document.getElementById('envelope-shape'),
    };
    const valueSpans = {
        sidechainLookahead: document.getElementById('sidechain-lookahead-value'),
        threshold:     document.getElementById('threshold-value'),
        polarity:      document.getElementById('polarity-value'),
        grainSize:     document.getElementById('grain-size-value'),
        grainDensity:  document.getElementById('grain-density-value'),
        time:          document.getElementById('time-value'),
        bpm:           document.getElementById('bpm-value'),
        pitch:         document.getElementById('pitch-value'),
        pitchSpray:    document.getElementById('pitch-spray-value'),
        panSpray:      document.getElementById('pan-spray-value'),
        mix:           document.getElementById('mix-value'),
        scatter:       document.getElementById('scatter-value'),
        feedback:      document.getElementById('feedback-value'),
        damping:       document.getElementById('damping-value'),
        feedbackGrain: document.getElementById('feedback-grain-value'),
        densityJitter: document.getElementById('density-jitter-value'),
        envelopeShape: document.getElementById('envelope-shape-value'),
    };

    // ── Web Audio ─────────────────────────────────────────────────────────────
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let controlBuffer        = null;
    let sourceBuffer         = null;
    let externalSourceBuffer = null;
    let controlSourceNode    = null;
    let sourceNode           = null;   // continuous source playback for the clean tap
    let analyserNode         = null;
    let controlRmsEnvelope   = [];

    const dryGain   = audioContext.createGain();
    const wetGain   = audioContext.createGain();
    const masterOut = audioContext.createGain();

    // ── Dry bus ────────────────────────────────────────────────────────────────
    // Dry is what a producer means by "dry": the source. Control is optional and
    // demoted to a sidechain — audible only via the separate Monitor Control tap.
    // Both feed dryBus, which then passes through the existing dry/wet mix gain.
    const dryBus            = audioContext.createGain();
    const sourceDryGain     = audioContext.createGain();   // gated by "Source in Dry"
    const controlMonitorGain = audioContext.createGain();  // gated by "Monitor Control"
    sourceDryGain.gain.value      = 1;   // default on: dry = source
    controlMonitorGain.gain.value = 0;   // default off
    sourceDryGain.connect(dryBus);
    controlMonitorGain.connect(dryBus);
    dryBus.connect(dryGain);

    // ── Master safety limiter ─────────────────────────────────────────────────
    // Guardrail against feedback runaway: a fast compressor catches the approach to
    // 0 dBFS, and a tanh soft-clip is the hard wall — output cannot exceed the
    // ceiling (~ -0.2 dBFS). Transparent at normal levels. This is a *causal* rail
    // on the realtime preview — by the suite's own thesis, honestly a cheat; the
    // offline bounce will do the true acausal peak ceiling instead.
    const safetyComp = audioContext.createDynamicsCompressor();
    safetyComp.threshold.value = -1;
    safetyComp.knee.value      = 0;
    safetyComp.ratio.value     = 12;
    safetyComp.attack.value    = 0.003;
    safetyComp.release.value   = 0.25;
    const safetyClip = audioContext.createWaveShaper();
    {
        const C = 0.977, N = 1024, curve = new Float32Array(N);   // C ≈ -0.2 dBFS
        for (let i = 0; i < N; i++) { const x = (i / (N - 1)) * 2 - 1; curve[i] = C * Math.tanh(x / C); }
        safetyClip.curve = curve;
        safetyClip.oversample = '4x';
    }
    masterOut.connect(safetyComp);
    safetyComp.connect(safetyClip);
    safetyClip.connect(audioContext.destination);

    // ── Wet-path readers ──────────────────────────────────────────────────────
    // Two readers of the same delayed-source concept, blended by the Scatter axis:
    //   • granGain     — the granulator bus (scattered grains)
    //   • cleanDelay → cleanTapGain — a pristine DelayNode tap (regular delay)
    // Scatter = 0 -> pure clean tap; Scatter = 1 -> full-clip granular reads.
    const granGain     = audioContext.createGain();
    const cleanTapGain = audioContext.createGain();
    const preEchoGain  = audioContext.createGain();
    const cleanDelay   = audioContext.createDelay(5);   // maxDelay matches Time range
    preEchoGain.gain.value = 0;
    granGain.connect(wetGain);
    cleanDelay.connect(cleanTapGain);
    cleanTapGain.connect(wetGain);
    preEchoGain.connect(wetGain);

    // Feedback loop on the whole wet bus (regeneration). The cycle is legal because
    // it contains a DelayNode. feedbackGain < 1 and the safety limiter bound runaway.
    // Works at any Scatter: whatever is in the wet (clean and/or granular) recircs,
    // darkened a little more each pass by the damping lowpass.
    const fbDelay      = audioContext.createDelay(5);
    const dampingLPF   = audioContext.createBiquadFilter();
    dampingLPF.type = 'lowpass';
    dampingLPF.frequency.value = 20000;
    const feedbackGain = audioContext.createGain();
    feedbackGain.gain.value = 0;
    wetGain.connect(fbDelay);
    fbDelay.connect(dampingLPF);
    const fbDirectGain = audioContext.createGain();
    const fbSwapGain   = audioContext.createGain();
    const fbSplitter   = audioContext.createChannelSplitter(2);
    const fbMerger     = audioContext.createChannelMerger(2);
    fbDirectGain.gain.value = 1;
    fbSwapGain.gain.value   = 0;
    dampingLPF.connect(fbDirectGain);
    fbDirectGain.connect(feedbackGain);
    dampingLPF.connect(fbSwapGain);
    fbSwapGain.connect(fbSplitter);
    fbSplitter.connect(fbMerger, 0, 1);
    fbSplitter.connect(fbMerger, 1, 0);
    fbMerger.connect(feedbackGain);
    feedbackGain.connect(wetGain);

    // ── Playback state ────────────────────────────────────────────────────────
    let isPlaying      = false;
    let isBouncing     = false;
    let isSelfSampling = !!selfSampleCheckbox.checked;
    let startTime      = 0;
    let transportPosition = 0;
    let nextGrainInterval = 0;

    const DEFAULT_PARAMS = {
        sidechainLookahead: 0, threshold: 0.1, polarity: 1, grainSize: 150,
        grainDensity: 20, time: 0, bpm: 120, mix: 0.7, scatter: 1,
        pitch: 0, pitchSpray: 0, panSpray: 0,
        feedback: 0, damping: 0, feedbackGrain: 0,
        densityJitter: 0, envelopeShape: 0.5,
    };
    const params = { ...DEFAULT_PARAMS };
    // Clip loop mode: true = ouroboros wrap; false = unlooped edges. Clean reads
    // outside [0, D] go silent; scattered grains expand inward from the edge.
    let loopClip = true;
    // Sidechain shape: false = continuous (grain amplitude tracks the envelope
    // every grain), true = gated (fire full-amplitude grains only when the
    // envelope crosses the threshold; direction flips with polarity's sign).
    let gateEnabled = false;
    // Dry-bus routing flags (see dryBus above).
    let sourceDry      = true;
    let monitorControl = false;
    let timeSync       = 'free';
    let applyingTimeSync = false;
    let applyingPreset = false;
    let pingPong       = false;
    let liveGrainIndex = 0;
    // Grain amplitude window: 'linear' = the classic attack/decay ramps (default,
    // preserves current sound); 'hann' = a true raised-cosine window (no click at
    // short grain sizes). Hann ignores envelopeShape by construction.
    let windowType = 'linear';

    // ── Audio-clock scheduler ─────────────────────────────────────────────────
    // Grains are scheduled ahead against audioContext.currentTime rather than fired
    // at "now" from requestAnimationFrame. This decouples grain timing from the
    // frame rate (no jitter, no background-tab throttle) — a correctness fix with
    // no intended change to the sound.
    const SCHEDULE_AHEAD     = 0.1;   // seconds of lookahead window
    const SCHEDULER_INTERVAL = 25;    // ms between scheduler wakeups
    let schedulerTimer = null;
    let nextGrainTime  = 0;

    // Unit Hann window, sampled once; scaled per-grain by amplitude.
    const HANN_POINTS = 256;
    const hannUnit = new Float32Array(HANN_POINTS);
    for (let i = 0; i < HANN_POINTS; i++) {
        hannUnit[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (HANN_POINTS - 1)));
    }

    // ── Viz state ─────────────────────────────────────────────────────────────
    let vizEnabled           = true;
    let activeGrains         = [];
    let currentAmplitude     = 0;        // live amplitude, for dot opacity scaling
    let controlWaveformCache = null;     // offscreen canvas — teal
    let ampWaveformCache     = null;     // offscreen canvas — ember sidechain read view
    let sourceWaveformCache  = null;
    let preEchoPreviewNodes  = [];
    let controlFileName      = '';
    let externalSourceFileName = '';

    // Shared viz timeline [vizT0, vizT1] in seconds. The original clip is [0, D];
    // head = pre-echo room (negative time), tail = feedback ring-out estimate. The
    // clip is drawn into a sub-range so head/tail extension zones are visible.
    let vizT0 = 0, vizT1 = 1;
    const computeVizWindow = () => {
        const D = controlBuffer ? controlBuffer.duration : 1;
        let head = Math.max(0, -params.time);
        let tail = Math.max(0, params.time);
        if (params.feedback > 0.01) {
            const f       = Math.min(0.95, params.feedback);
            const repeats = Math.log(0.001) / Math.log(f);          // passes to -60 dB
            const step    = Math.max(0.05, Math.abs(params.time));
            const room    = Math.min(8, repeats * step);
            if (params.time < 0) head += room;
            else tail += room;
        }
        vizT0 = -head;
        vizT1 = D + tail;
    };
    const tToX = (t, w) => ((t - vizT0) / (vizT1 - vizT0)) * w;
    const xToT = (x, w) => vizT0 + (x / Math.max(1, w)) * (vizT1 - vizT0);
    const wrapSeconds = (t, d) => d > 0 ? ((t % d) + d) % d : 0;
    const boundSeconds = (t, d) => {
        const maxStart = Math.max(0, d - 1 / Math.max(1, audioContext.sampleRate));
        return d > 0 ? Math.max(0, Math.min(maxStart, t)) : 0;
    };
    const clampTransportTime = (t) => {
        if (!controlBuffer) return 0;
        const maxT = Math.max(0, controlBuffer.duration - (1 / audioContext.sampleRate));
        return Math.max(0, Math.min(maxT, t));
    };
    const currentTransportTime = () => {
        if (!controlBuffer) return 0;
        return isPlaying
            ? wrapSeconds(audioContext.currentTime - startTime, controlBuffer.duration)
            : clampTransportTime(transportPosition);
    };

    // ── Pre-computation ───────────────────────────────────────────────────────
    const analyzeControlBuffer = () => {
        if (!controlBuffer) return;
        controlRmsEnvelope = [];
        const data = controlBuffer.getChannelData(0);
        const windowSize = 256;
        for (let i = 0; i < data.length; i += windowSize) {
            let sumSq = 0;
            const end = Math.min(i + windowSize, data.length);
            for (let j = i; j < end; j++) sumSq += data[j] * data[j];
            controlRmsEnvelope.push(Math.sqrt(sumSq / windowSize));
        }
    };

    const rawRmsAtTime = (t) => {
        if (!controlRmsEnvelope.length) return 0;
        const idx = Math.max(0, Math.min(
            controlRmsEnvelope.length - 1,
            Math.floor(t * audioContext.sampleRate / 256)
        ));
        return controlRmsEnvelope[idx];
    };

    // ── Waveform cache ────────────────────────────────────────────────────────
    // Builds an offscreen canvas from buffer data. Canvas sizing is handled by
    // refreshWaveformCaches — this function only draws.
    // fitClip = true draws the buffer into the shared-timeline clip sub-range and
    // shades the head/tail extension zones with boundary markers. fitClip = false
    // remains for any future full-width cache that intentionally owns its geometry.
    const buildWaveformCache = (buffer, w, h, waveColor = 'rgba(88,178,168,0.5)', fitClip = true) => {
        const off = document.createElement('canvas');
        off.width  = w;
        off.height = h;
        const ctx  = off.getContext('2d');

        const Dref   = controlBuffer ? controlBuffer.duration : buffer.duration;
        const xStart = fitClip ? Math.max(0, tToX(0, w))    : 0;
        const xEnd   = fitClip ? Math.min(w, tToX(Dref, w)) : w;
        const cw     = Math.max(1, xEnd - xStart);

        // Backgrounds: extension zones darker, clip region normal
        ctx.fillStyle = '#0c0d06';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#111209';
        ctx.fillRect(xStart, 0, cw, h);
        if (fitClip) {
            ctx.fillStyle = 'rgba(216,104,64,0.06)';   // faint ember on head/tail
            if (xStart > 0) ctx.fillRect(0, 0, xStart, h);
            if (xEnd < w)   ctx.fillRect(xEnd, 0, w - xEnd, h);
        }

        // centre line
        ctx.strokeStyle = 'rgba(51,55,32,0.7)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        // waveform into the clip sub-range: min/max per pixel column
        const data = buffer.getChannelData(0);
        const step = Math.max(1, Math.floor(data.length / cw));

        ctx.strokeStyle = waveColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let px = 0; px < cw; px++) {
            let min = 1, max = -1;
            const base = Math.floor((px / cw) * data.length);
            const end  = Math.min(base + step, data.length);
            for (let i = base; i < end; i++) {
                if (data[i] < min) min = data[i];
                if (data[i] > max) max = data[i];
            }
            const x    = xStart + px + 0.5;
            const yTop = ((1 - max) / 2) * h;
            const yBot = ((1 - min) / 2) * h;
            ctx.moveTo(x, yTop);
            ctx.lineTo(x, yBot);
        }
        ctx.stroke();

        // clip boundary markers (where the original file starts and ends)
        if (fitClip) {
            ctx.strokeStyle = 'rgba(194,220,50,0.45)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(xStart + 0.5, 0); ctx.lineTo(xStart + 0.5, h);
            ctx.moveTo(xEnd + 0.5, 0);   ctx.lineTo(xEnd + 0.5, h);
            ctx.stroke();
        }

        return off;
    };

    const refreshWaveformCaches = () => {
        if (!vizEnabled) return;
        computeVizWindow();
        if (controlBuffer && controlCanvas) {
            const w = controlCanvas.offsetWidth  || 800;
            const h = controlCanvas.offsetHeight || 72;
            controlCanvas.width  = w;
            controlCanvas.height = h;
            controlWaveformCache = buildWaveformCache(controlBuffer, w, h, 'rgba(88,178,168,0.5)');

            // Amp view: same ctrl data, ember colour, same shared timeline.
            if (delayCanvas) {
                delayCanvas.width  = w;
                delayCanvas.height = h;
                ampWaveformCache   = buildWaveformCache(controlBuffer, w, h, 'rgba(216,104,64,0.6)');
            }
        }
        if (sourceBuffer && sourceCanvas) {
            const w = sourceCanvas.offsetWidth  || 800;
            const h = sourceCanvas.offsetHeight || 72;
            sourceCanvas.width  = w;
            sourceCanvas.height = h;
            sourceWaveformCache = buildWaveformCache(sourceBuffer, w, h, 'rgba(88,178,168,0.5)');
        }
    };

    // ── Per-frame canvas rendering ────────────────────────────────────────────
    const renderControlCanvas = () => {
        if (!controlWaveformCache || !controlCanvas || !controlBuffer) return;
        const w   = controlCanvas.width;
        const h   = controlCanvas.height;
        const ctx = controlCanvas.getContext('2d');

        ctx.drawImage(controlWaveformCache, 0, 0);

        const t = currentTransportTime();
        const x = tToX(t, w);

        // Playhead line — acid green
        ctx.strokeStyle = 'rgba(194,220,50,0.85)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        // Top marker triangle
        ctx.fillStyle = '#c2dc32';
        ctx.beginPath();
        ctx.moveTo(x - 4, 0);
        ctx.lineTo(x + 4, 0);
        ctx.lineTo(x,     6);
        ctx.closePath();
        ctx.fill();
    };

    // Sidechain-lookahead / amplitude canvas.
    // This track shares the ctrl/src timeline. The waveform stays fixed; the ember
    // readhead shows which control envelope point shapes the grain at playback time.
    const renderDelayCanvas = () => {
        if (!ampWaveformCache || !delayCanvas || !controlBuffer) return;
        const w   = delayCanvas.width;
        const h   = delayCanvas.height;
        const ctx = delayCanvas.getContext('2d');

        ctx.drawImage(ampWaveformCache, 0, 0);

        const t = currentTransportTime();
        const readT = ((t - params.sidechainLookahead) % controlBuffer.duration
                       + controlBuffer.duration) % controlBuffer.duration;
        const x     = tToX(t, w);
        const readX = tToX(readT, w);

        // Current transport time, same coordinate as ctrl/src.
        ctx.strokeStyle = 'rgba(194,220,50,0.32)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();

        // Sidechain readhead: this is the envelope sample actually shaping grains.
        ctx.strokeStyle = 'rgba(216,104,64,0.85)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(readX, 0);
        ctx.lineTo(readX, h);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(216,104,64,0.28)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(x, h - 7);
        ctx.lineTo(readX, h - 7);
        ctx.stroke();

        ctx.fillStyle = '#d86840';
        ctx.beginPath();
        ctx.moveTo(readX - 4, 0);
        ctx.lineTo(readX + 4, 0);
        ctx.lineTo(readX,     6);
        ctx.closePath();
        ctx.fill();
    };

    const renderSourceCanvas = () => {
        if (!sourceWaveformCache || !sourceCanvas || !sourceBuffer) return;
        const w   = sourceCanvas.width;
        const h   = sourceCanvas.height;
        const ctx = sourceCanvas.getContext('2d');
        const now = audioContext.currentTime;

        ctx.drawImage(sourceWaveformCache, 0, 0);

        const playheadX = tToX(currentTransportTime(), w);
        ctx.strokeStyle = 'rgba(194,220,50,0.32)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.stroke();

        if (!isPlaying) return;

        // Prune expired grains
        activeGrains = activeGrains.filter(g => (now - g.firedAt) < g.duration);

        for (const g of activeGrains) {
            const age    = (now - g.firedAt) / g.duration;
            const ampFactor = Math.min(1, Math.max(0, g.amplitude ?? currentAmplitude));
            const alpha  = (1 - age) * 0.9 * ampFactor;
            const radius = 2.5 + (1 - age) * 4.5;
            // Map the source read offset into the shared-timeline clip sub-range
            const cs     = tToX(0, w);
            const ce     = tToX(controlBuffer ? controlBuffer.duration : sourceBuffer.duration, w);
            const x      = cs + (g.startOffset / sourceBuffer.duration) * (ce - cs);
            const idealX = g.idealOffset === undefined
                ? x
                : cs + (g.idealOffset / sourceBuffer.duration) * (ce - cs);
            const jitterRatio = g.jitterRange > 0
                ? Math.max(-1, Math.min(1, (g.jitter || 0) / g.jitterRange))
                : 0;
            const cy = h / 2 + jitterRatio * h * 0.28;

            if (Math.abs(x - idealX) > 0.75) {
                ctx.beginPath();
                ctx.moveTo(idealX, h / 2);
                ctx.lineTo(x, cy);
                ctx.strokeStyle = `rgba(194,220,50,${alpha * 0.22})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            // Outer glow
            ctx.beginPath();
            ctx.arc(x, cy, radius + 4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(194,220,50,${alpha * 0.15})`;
            ctx.fill();

            // Dot
            ctx.beginPath();
            ctx.arc(x, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(194,220,50,${alpha})`;
            ctx.fill();
        }
    };

    // ── File loading + drag/drop ──────────────────────────────────────────────
    const AUDIO_FILE_RE = /\.(wav|wave|mp3|m4a|aac|ogg|oga|flac|aif|aiff|webm)$/i;
    const isLikelyAudioFile = (file) => !!file && (
        (file.type && file.type.startsWith('audio/')) ||
        AUDIO_FILE_RE.test(file.name || '')
    );

    const loadAudioFile = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => audioContext.decodeAudioData(e.target.result, resolve, reject);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });

    const loadControlFile = async (file, context = 'Control load') => {
        try {
            controlBuffer = await loadAudioFile(file);
            controlFileName = file.name;
            analyzeControlBuffer();
            if (isSelfSampling) {
                sourceBuffer = controlBuffer;
                sourceFileDisplay.textContent = controlFileName;
            }
            controlWaveformCache = null;
            sourceWaveformCache  = null;
            controlFileDisplay.textContent = controlFileName;
            refreshWaveformCaches();
            checkReadyState();
        } catch (err) { console.error(`${context} error:`, err); }
    };

    const loadSourceFile = async (file, context = 'Source load') => {
        if (isSelfSampling) return;
        try {
            externalSourceBuffer = await loadAudioFile(file);
            externalSourceFileName = file.name;
            sourceBuffer        = externalSourceBuffer;
            sourceWaveformCache = null;
            sourceFileDisplay.textContent = externalSourceFileName;
            refreshWaveformCaches();
            checkReadyState();
        } catch (err) { console.error(`${context} error:`, err); }
    };

    const setupDragDrop = (zone, onFile, canAccept = () => true) => {
        let dragDepth = 0;
        zone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dragDepth++;
            if (canAccept()) zone.classList.add('drag-over');
        });
        zone.addEventListener('dragover',  (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = canAccept() ? 'copy' : 'none';
        });
        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) zone.classList.remove('drag-over');
        });
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            dragDepth = 0;
            zone.classList.remove('drag-over');
            if (!canAccept()) return;
            const file = Array.from(e.dataTransfer.files || []).find(isLikelyAudioFile);
            if (file) onFile(file);
        });
    };

    setupDragDrop(document.getElementById('control-input-group'), (file) => {
        loadControlFile(file, 'Control drag-drop');
    });

    setupDragDrop(document.getElementById('source-input-group'), (file) => {
        loadSourceFile(file, 'Source drag-drop');
    }, () => !isSelfSampling);

    const checkReadyState = () => {
        const ready = isSelfSampling ? !!controlBuffer : (!!controlBuffer && !!sourceBuffer);
        playButton.disabled   = !ready;
        recordButton.disabled = !ready;
        playButton.textContent = ready ? 'Start Pythia' : 'Load Files to Start';
        if (!isBouncing) recordButton.textContent = 'Bounce WAV';
    };

    controlInput.addEventListener('change', async (e) => {
        if (!e.target.files[0]) return;
        await loadControlFile(e.target.files[0], 'Control load');
        e.target.value = '';
    });

    sourceInput.addEventListener('change', async (e) => {
        if (!e.target.files[0]) return;
        await loadSourceFile(e.target.files[0], 'Source load');
        e.target.value = '';
    });

    // ── UI ────────────────────────────────────────────────────────────────────
    const updateGateUI = () => {
        thresholdGroup.classList.toggle('hidden', !gateEnabled);
    };

    const markPresetCustom = () => {
        if (!applyingPreset && presetSelect) presetSelect.value = 'custom';
    };

    gateCheckbox.addEventListener('change', () => {
        markPresetCustom();
        gateEnabled = gateCheckbox.checked;
        updateGateUI();
    });

    loopRadios.forEach(r => r.addEventListener('change', (e) => {
        markPresetCustom();
        loopClip = (e.target.value === 'loop');
    }));

    sourceDryCheckbox.addEventListener('change', () => {
        markPresetCustom();
        sourceDry = sourceDryCheckbox.checked;
        sourceDryGain.gain.setTargetAtTime(sourceDry ? 1 : 0, audioContext.currentTime, 0.02);
    });

    monitorCtrlCheckbox.addEventListener('change', () => {
        markPresetCustom();
        monitorControl = monitorCtrlCheckbox.checked;
        controlMonitorGain.gain.setTargetAtTime(monitorControl ? 1 : 0, audioContext.currentTime, 0.02);
    });

    const updatePingPong = () => {
        const now = audioContext.currentTime;
        fbDirectGain.gain.setTargetAtTime(pingPong ? 0 : 1, now, 0.02);
        fbSwapGain.gain.setTargetAtTime(pingPong ? 1 : 0, now, 0.02);
    };

    if (pingPongCheckbox) {
        pingPongCheckbox.addEventListener('change', () => {
            markPresetCustom();
            pingPong = pingPongCheckbox.checked;
            updatePingPong();
        });
    }

    const updateSelfSampling = () => {
        isSelfSampling = selfSampleCheckbox.checked;
        sourceInputGroup.style.opacity = isSelfSampling ? '0.5' : '1';
        sourceInput.disabled           = isSelfSampling;
        // Lookahead is always active — not gated to self-sampling
        sourceBuffer        = isSelfSampling ? controlBuffer : externalSourceBuffer;
        sourceWaveformCache = null;
        sourceFileDisplay.textContent = isSelfSampling
            ? (controlFileName || '')
            : (externalSourceFileName || '');
        refreshWaveformCaches();
        checkReadyState();
    };

    selfSampleCheckbox.addEventListener('change', () => {
        markPresetCustom();
        updateSelfSampling();
    });

    const syncDivisions = {
        '1/1':  4,
        '1/2':  2,
        '1/4':  1,
        '1/8d': 0.75,
        '1/8':  0.5,
        '1/8t': 1 / 3,
        '1/16': 0.25,
    };

    const formatParamValue = (key, v) => {
        if (key === 'grainSize' || key === 'grainDensity' || key === 'bpm' || key === 'pitch') return v.toFixed(0);
        if (key === 'pitchSpray') return v.toFixed(1);
        return v.toFixed(2);
    };

    const updateParamDisplay = (key) => {
        if (!valueSpans[key]) return;
        valueSpans[key].textContent = formatParamValue(key, params[key]);
    };

    const panForGrain = (rand, index) => {
        const amount = Math.max(0, Math.min(1, params.panSpray));
        if (amount <= 0) return 0;
        if (pingPong) return (index % 2 === 0 ? -amount : amount);
        return (rand() * 2 - 1) * amount;
    };

    const equalPowerPan = (pan) => {
        const x = (Math.max(-1, Math.min(1, pan)) + 1) * 0.25 * Math.PI;
        return { left: Math.cos(x), right: Math.sin(x) };
    };

    const granulatorLevel = () => Math.sin(params.scatter * 0.5 * Math.PI);
    const boundedGrainOffset = (t, readWindow, sourceDuration) =>
        Math.max(0, Math.min(Math.max(0, sourceDuration - readWindow), t));
    const grainReadOffset = (readPos, readWindow, sourceDuration) => {
        if (loopClip) return wrapSeconds(readPos, sourceDuration);
        return boundedGrainOffset(readPos, readWindow, sourceDuration);
    };
    const scatteredGrainRead = (rand, readPos, readWindow, sourceDuration) => {
        const amount = Math.max(0, Math.min(1, params.scatter));
        const idealOffset = grainReadOffset(readPos, readWindow, sourceDuration);
        if (amount <= 0) return { offset: idealOffset, idealOffset, delta: 0, range: 0 };

        const halfRange = sourceDuration * 0.5 * amount;
        if (loopClip) {
            const delta = (rand() * 2 - 1) * halfRange;
            return {
                offset: wrapSeconds(idealOffset + delta, sourceDuration),
                idealOffset,
                delta,
                range: halfRange,
            };
        }

        const maxStart = Math.max(0, sourceDuration - readWindow);
        const lo = idealOffset * (1 - amount);
        const hi = idealOffset + (maxStart - idealOffset) * amount;
        const offset = hi > lo ? lo + rand() * (hi - lo) : idealOffset;
        return {
            offset,
            idealOffset,
            delta: offset - idealOffset,
            range: Math.max(1e-9, Math.max(idealOffset - lo, hi - idealOffset)),
        };
    };

    const syncSeconds = () => (60 / params.bpm) * syncDivisions[timeSync];

    const updateTimeSyncUI = () => {
        if (timeSyncSelect) timeSyncSelect.value = timeSync;
        if (!timeSyncValue) return;
        timeSyncValue.textContent = timeSync === 'free' ? 'free' : `${Math.abs(params.time).toFixed(2)}s`;
    };

    const applyTimeSync = () => {
        if (timeSync === 'free' || !syncDivisions[timeSync]) {
            updateTimeSyncUI();
            return;
        }
        const sign = params.time < 0 ? -1 : 1;
        const min = parseFloat(sliders.time.min);
        const max = parseFloat(sliders.time.max);
        const next = Math.max(min, Math.min(max, sign * syncSeconds()));

        applyingTimeSync = true;
        params.time = next;
        sliders.time.value = next;
        updateParamDisplay('time');
        applyingTimeSync = false;

        updateBlend();
        updateDelays();
        updateFeedback();
        if (isPlaying) rebuildPreEchoPreview();
        if (vizEnabled) refreshWaveformCaches();
        updateTimeSyncUI();
    };

    if (timeSyncSelect) {
        timeSyncSelect.addEventListener('change', (e) => {
            markPresetCustom();
            timeSync = e.target.value;
            if (timeSync === 'free') updateTimeSyncUI();
            else applyTimeSync();
        });
    }

    Object.keys(sliders).forEach(key => {
        sliders[key].addEventListener('input', (e) => {
            markPresetCustom();
            const v = parseFloat(e.target.value);
            params[key] = v;
            updateParamDisplay(key);
            if (key === 'time' && !applyingTimeSync && timeSync !== 'free') {
                timeSync = 'free';
                updateTimeSyncUI();
            }
            if (key === 'bpm') {
                if (timeSync !== 'free') applyTimeSync();
                else updateTimeSyncUI();
            }
            if (key === 'mix') {
                dryGain.gain.value = Math.cos(v * 0.5 * Math.PI);
                wetGain.gain.value = Math.cos((1 - v) * 0.5 * Math.PI);
            }
            if (key === 'scatter')  updateBlend();
            if (key === 'feedback') updateFeedback();
            if (key === 'damping' || key === 'feedbackGrain') updateDamping();
            if (key === 'time') { updateBlend(); updateDelays(); updateFeedback(); }
            if ((key === 'time' || key === 'feedback') && isPlaying) rebuildPreEchoPreview();
            // Time (head) and feedback (tail) reshape the shared viz timeline
            if ((key === 'time' || key === 'feedback') && vizEnabled) refreshWaveformCaches();
            // Preview the sidechain readhead immediately when it changes, even when paused.
            if (key === 'sidechainLookahead' && vizEnabled && ampWaveformCache && !isPlaying) {
                renderDelayCanvas();
            }
        });
    });

    // Viz toggle — hide panel, skip all canvas work in the loop
    vizToggle.addEventListener('change', () => {
        vizEnabled = vizToggle.checked;
        vizPanel.style.display = vizEnabled ? '' : 'none';
        if (vizEnabled) refreshWaveformCaches();
        else activeGrains = [];
    });

    // Buffer size — live-updates the analyser if playing; else applied on start()
    bufferSizeSelect.addEventListener('change', () => {
        if (analyserNode) analyserNode.fftSize = parseInt(bufferSizeSelect.value, 10);
    });

    // Rebuild waveform caches on resize (debounced 200ms)
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            controlWaveformCache = null;
            ampWaveformCache     = null;
            sourceWaveformCache  = null;
            refreshWaveformCaches();
        }, 200);
    });

    // ── Scatter axis (exact ↔ whole-clip granular) ────────────────────────────
    // Equal-power crossfade between the clean tap and the granulator bus.
    // Positive Time uses DelayNode; negative Time uses the pre-echo preview tap bank.
    const updateBlend = () => {
        const clean = Math.cos(params.scatter * 0.5 * Math.PI);
        const gran  = granulatorLevel();
        const now = audioContext.currentTime;
        cleanTapGain.gain.setTargetAtTime(params.time < 0 ? 0 : clean, now, 0.02);
        preEchoGain.gain.setTargetAtTime(params.time < 0 ? clean : 0, now, 0.02);
        granGain.gain.setTargetAtTime(gran, now, 0.02);
    };

    const updateDelays = () => {
        const now = audioContext.currentTime;
        // Only non-negative delays are realisable on a live stream (clean tap).
        cleanDelay.delayTime.setTargetAtTime(Math.max(0, params.time), now, 0.02);
        // Positive-time feedback uses this causal loop; negative-time repeats are
        // rendered by the pre-echo preview tap bank above.
        fbDelay.delayTime.setTargetAtTime(Math.max(0.03, Math.abs(params.time)), now, 0.02);
    };

    const updateFeedback = () => {
        const f = params.time < 0 ? 0 : Math.min(0.95, Math.max(0, params.feedback));
        feedbackGain.gain.setTargetAtTime(f, audioContext.currentTime, 0.02);
    };

    const updateDamping = () => {
        // damping 0 -> open (20 kHz); 1 -> dark (200 Hz). Feedback Grain gets a
        // cheap live approximation by darkening the return; Bounce WAV does the
        // real pass-by-pass smear.
        const effectiveDamping = Math.max(params.damping, params.feedbackGrain * 0.85);
        const cutoff = 200 * Math.pow(100, 1 - effectiveDamping);
        dampingLPF.frequency.setTargetAtTime(cutoff, audioContext.currentTime, 0.02);
    };

    // ── Core audio ────────────────────────────────────────────────────────────
    const calculateNextGrainInterval = () => {
        const base   = 1 / params.grainDensity;
        const jitter = (Math.random() - 0.5) * base * params.densityJitter;
        nextGrainInterval = Math.max(0.001, base + jitter);
    };

    const triggerGrain = (amplitude, when) => {
        if (!sourceBuffer || amplitude <= 0.001) return;
        if (granulatorLevel() <= 0.0001) return;

        const grainDuration = params.grainSize / 1000;

        // ── Source read position ──────────────────────────────────────────────
        // Grain reads the source at t − time, where t is the grain's own
        // scheduled playback time (not "now"). Positive time reads the past
        // (normal delay), negative reads the future (pre-echo).
        // Sidechain Lookahead is NOT part of this — it only shifts which control
        // amplitude shapes the grain. The amp canvas shows that sidechain readhead;
        // the source grain dots stay tied to Time.
        const t = (when - startTime) % controlBuffer.duration;
        let readPos = t - params.time;

        if (loopClip) {
            // ⥀ ouroboros: wrap reads past either edge back into the clip
            readPos = ((readPos % sourceBuffer.duration) + sourceBuffer.duration) % sourceBuffer.duration;
        }

        // Per-grain pitch shift lives in the granulator path. Scatter=0 remains the
        // clean tap, so pitch/spray are intentionally silent there.
        const pitchSemis = params.pitch + (Math.random() - 0.5) * 2 * params.pitchSpray;
        const pitchRate = Math.pow(2, pitchSemis / 12);
        const pan = panForGrain(Math.random, liveGrainIndex++);

        // Positional read jitter, scaled by the Scatter axis. Scatter=0 stays locked;
        // Scatter=1 can draw from any legal source position; unlooped edges expand inward.
        const readWindow = grainDuration * pitchRate;
        const scatterRead = scatteredGrainRead(Math.random, readPos, readWindow, sourceBuffer.duration);
        const startOffset = scatterRead.offset;

        // Log for viz
        if (vizEnabled) {
            activeGrains.push({
                startOffset,
                idealOffset: scatterRead.idealOffset,
                jitter: scatterRead.delta,
                jitterRange: scatterRead.range,
                amplitude,
                firedAt: when,
                duration: grainDuration,
            });
            if (activeGrains.length > 300) activeGrains.shift();
        }

        const grain     = audioContext.createBufferSource();
        const grainGain = audioContext.createGain();
        const grainPan  = params.panSpray > 0 && audioContext.createStereoPanner
            ? audioContext.createStereoPanner()
            : null;
        grain.buffer    = sourceBuffer;
        grain.loop      = loopClip;
        grain.playbackRate.setValueAtTime(pitchRate, when);

        if (windowType === 'hann') {
            // Raised-cosine window, scaled to this grain's amplitude.
            const curve = new Float32Array(HANN_POINTS);
            for (let i = 0; i < HANN_POINTS; i++) curve[i] = hannUnit[i] * amplitude;
            grainGain.gain.setValueCurveAtTime(curve, when, grainDuration);
        } else {
            const attackTime = grainDuration * params.envelopeShape;
            grainGain.gain.setValueAtTime(0, when);
            grainGain.gain.linearRampToValueAtTime(amplitude, when + attackTime);
            grainGain.gain.linearRampToValueAtTime(0, when + grainDuration);
        }

        if (grainPan) {
            grainPan.pan.setValueAtTime(pan, when);
            grain.connect(grainGain).connect(grainPan).connect(granGain);
        } else {
            grain.connect(grainGain).connect(granGain);
        }
        grain.start(when, Math.max(0, startOffset));
        grain.stop(when + grainDuration);
    };

    // ── Sidechain amplitude ────────────────────────────────────────────────────
    // Polarity is a signed knob: +1 = follow (grain rides the control's envelope,
    // the pre-Phase-2 sound), 0 = off (constant full amplitude, no sidechain),
    // -1 = duck (grain dodges the control — the producer move). Continuous between.
    //   amp = 1 − polarity·(1−e)   for polarity ≥ 0   (reduces to exactly e at +1)
    //   amp = 1 + polarity·e       for polarity < 0    (reduces to exactly 1−e at −1)
    // Only the lower bound is clamped — classic (polarity=1) reduces algebraically
    // to the old unclamped `e`, so the exact old sound survives untouched; duck is
    // clamped at 0 so it can't go negative.
    const sidechainAmplitude = (e) => {
        const p = params.polarity;
        const raw = p >= 0 ? 1 - p * (1 - e) : 1 + p * e;
        return Math.max(0, raw);
    };

    // ── Grain scheduler ───────────────────────────────────────────────────────
    // Runs on a timer, scheduling every grain that falls inside the lookahead
    // window at its exact audio-clock time. Grain amplitude is read from the
    // precomputed control envelope at each grain's own scheduled time, so the
    // schedule is deterministic (no dependence on the live analyser).
    const scheduleGrains = () => {
        if (!isPlaying) return;
        const horizon = audioContext.currentTime + SCHEDULE_AHEAD;

        while (nextGrainTime < horizon) {
            const playbackT = (nextGrainTime - startTime) % controlBuffer.duration;

            // Sidechain reads at t - sidechainLookahead in the control:
            //   +L → reads L seconds into the past → output follows control with lag
            //   -L → reads L seconds into the future → output anticipates control
            //    0 → reads current control amplitude
            const ampT = ((playbackT - params.sidechainLookahead) % controlBuffer.duration
                          + controlBuffer.duration) % controlBuffer.duration;
            const raw = rawRmsAtTime(ampT);
            currentAmplitude = raw * 4; // normalise RMS into the ~[0,1] envelope range

            if (gateEnabled) {
                // Gated: fire full-amplitude grains only when crossing the threshold.
                // Direction flips with polarity's sign — duck-gate fires in the gaps.
                const fire = params.polarity < 0 ? (raw <= params.threshold) : (raw > params.threshold);
                if (fire) triggerGrain(1.0, nextGrainTime);
            } else {
                // Continuous: every grain fires, amplitude riding the sidechain curve.
                triggerGrain(sidechainAmplitude(currentAmplitude), nextGrainTime);
            }

            calculateNextGrainInterval();
            nextGrainTime += nextGrainInterval;
        }
    };

    // ── Visual loop ───────────────────────────────────────────────────────────
    // Frame-rate work only: level meter + canvas viz. No audio scheduling here.
    const visualLoop = () => {
        if (!isPlaying) return;

        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteTimeDomainData(dataArray);
        let sumSq = 0;
        for (const amp of dataArray) { const v = (amp / 128) - 1; sumSq += v * v; }
        const liveRms = Math.sqrt(sumSq / dataArray.length);
        levelMeter.style.width = `${Math.min(100, liveRms * 300)}%`;

        if (vizEnabled) {
            renderControlCanvas();
            renderDelayCanvas();
            renderSourceCanvas();
        }

        requestAnimationFrame(visualLoop);
    };

    // ── Start / Stop ──────────────────────────────────────────────────────────
    const stopBufferSource = (node) => {
        if (!node) return;
        try { node.stop(); } catch (err) { /* source may already have been stopped */ }
        try { node.disconnect(); } catch (err) { /* already disconnected */ }
    };

    const stopPreEchoPreview = () => {
        for (const tap of preEchoPreviewNodes) {
            stopBufferSource(tap.source);
            try { tap.gain.disconnect(); } catch (err) { /* already disconnected */ }
        }
        preEchoPreviewNodes = [];
    };

    const startPreEchoPreview = (when, offset) => {
        stopPreEchoPreview();
        if (!sourceBuffer || params.time >= 0) return;

        const step = Math.max(0.03, Math.abs(params.time));
        const f = Math.min(0.95, Math.max(0, params.feedback));
        const repeats = f > 0.001
            ? Math.min(32, 1 + Math.ceil(Math.log(0.001) / Math.log(f)))
            : 1;
        let tapGain = 1;

        for (let i = 1; i <= repeats; i++) {
            const source = audioContext.createBufferSource();
            const gain = audioContext.createGain();
            source.buffer = sourceBuffer;
            const readOffset = loopClip
                ? wrapSeconds(offset + step * i, sourceBuffer.duration)
                : boundSeconds(offset + step * i, sourceBuffer.duration);
            source.loop = loopClip;
            gain.gain.value = tapGain;
            source.connect(gain).connect(preEchoGain);
            source.start(when, readOffset);
            preEchoPreviewNodes.push({ source, gain });
            tapGain *= f;
        }
    };

    const rebuildPreEchoPreview = () => {
        if (!isPlaying) return;
        startPreEchoPreview(audioContext.currentTime, currentTransportTime());
    };

    const startBufferSources = (when, offset) => {
        const controlOffset = wrapSeconds(offset, controlBuffer.duration);
        const sourceOffset = sourceBuffer
            ? (loopClip ? wrapSeconds(offset, sourceBuffer.duration) : boundSeconds(offset, sourceBuffer.duration))
            : 0;

        controlSourceNode        = audioContext.createBufferSource();
        controlSourceNode.buffer = controlBuffer;
        controlSourceNode.loop   = true;
        controlSourceNode.connect(analyserNode);
        controlSourceNode.connect(controlMonitorGain);

        sourceNode        = audioContext.createBufferSource();
        sourceNode.buffer = sourceBuffer;
        sourceNode.loop   = loopClip;
        sourceNode.connect(cleanDelay);
        sourceNode.connect(sourceDryGain);

        controlSourceNode.start(when, controlOffset);
        sourceNode.start(when, sourceOffset);
        startPreEchoPreview(when, offset);
    };

    const resetLiveScheduler = (when) => {
        nextGrainTime = when;
        liveGrainIndex = 0;
        activeGrains  = [];
        calculateNextGrainInterval();
    };

    const redrawTransportCanvases = () => {
        if (!vizEnabled) return;
        renderControlCanvas();
        renderDelayCanvas();
        renderSourceCanvas();
    };

    const seekToTransportTime = (t) => {
        if (!controlBuffer) return;
        transportPosition = clampTransportTime(t);

        if (isPlaying) {
            const now = audioContext.currentTime;
            stopBufferSource(controlSourceNode);
            stopBufferSource(sourceNode);
            controlSourceNode = null;
            sourceNode = null;
            startTime = now - transportPosition;
            resetLiveScheduler(now);
            startBufferSources(now, transportPosition);
            scheduleGrains();
        }

        redrawTransportCanvases();
    };

    const start = () => {
        if (isPlaying || !controlBuffer || !sourceBuffer) return;
        if (audioContext.state === 'suspended') audioContext.resume();

        analyserNode         = audioContext.createAnalyser();
        analyserNode.fftSize = parseInt(bufferSizeSelect.value, 10);

        sliders.mix.dispatchEvent(new Event('input'));
        updateBlend();
        updateDelays();
        updateFeedback();
        updateDamping();
        updatePingPong();

        dryGain.connect(masterOut);
        wetGain.connect(masterOut);

        const offset = clampTransportTime(transportPosition);
        const now = audioContext.currentTime;
        startTime = now - offset;
        resetLiveScheduler(now);
        startBufferSources(now, offset);

        isPlaying              = true;
        playButton.textContent = 'Stop Pythia';
        schedulerTimer = setInterval(scheduleGrains, SCHEDULER_INTERVAL);
        scheduleGrains();  // prime the first window immediately
        visualLoop();
    };

    const stop = () => {
        if (!isPlaying) return;

        transportPosition = currentTransportTime();
        if (schedulerTimer !== null) { clearInterval(schedulerTimer); schedulerTimer = null; }
        stopBufferSource(controlSourceNode);
        controlSourceNode      = null;
        stopBufferSource(sourceNode);
        sourceNode             = null;
        stopPreEchoPreview();
        analyserNode           = null;
        isPlaying              = false;
        activeGrains           = [];
        playButton.textContent = 'Start Pythia';
        levelMeter.style.width = '0%';

        redrawTransportCanvases();
    };

    const seekFromCanvasEvent = (canvas, e) => {
        if (!controlBuffer) return;
        const rect = canvas.getBoundingClientRect();
        const width = canvas.width || rect.width || 1;
        const x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * width;
        seekToTransportTime(clampTransportTime(xToT(x, width)));
    };

    let activeSeekCanvas = null;
    [controlCanvas, delayCanvas, sourceCanvas].forEach((canvas) => {
        if (!canvas) return;
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 || !controlBuffer) return;
            e.preventDefault();
            activeSeekCanvas = canvas;
            canvas.setPointerCapture(e.pointerId);
            seekFromCanvasEvent(canvas, e);
        });
        canvas.addEventListener('pointermove', (e) => {
            if (activeSeekCanvas !== canvas) return;
            e.preventDefault();
            seekFromCanvasEvent(canvas, e);
        });
        const finishSeek = (e) => {
            if (activeSeekCanvas !== canvas) return;
            if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
            activeSeekCanvas = null;
        };
        canvas.addEventListener('pointerup', finishSeek);
        canvas.addEventListener('pointercancel', finishSeek);
    });

    playButton.addEventListener('click', () => { if (!isPlaying) start(); else stop(); });

    // ── Offline bounce ────────────────────────────────────────────────────────
    const BOUNCE_PEAK = 0.977;   // ≈ -0.2 dBFS true-peak ceiling

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const wrapTime = (t, d) => ((t % d) + d) % d;

    const mulberry32 = (seed) => {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    const bounceSeed = () => {
        let h = 0x50595448; // "PYTH"
        const keys = Object.keys(params).filter(k => k !== 'bpm').sort();
        for (const k of keys) {
            const s = `${k}:${params[k].toFixed(6)};`;
            for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
        }
        h ^= gateEnabled ? 0x11111111 : 0;
        h ^= loopClip ? 0x22222222 : 0;
        h ^= windowType === 'hann' ? 0x33333333 : 0;
        h ^= pingPong ? 0x44444444 : 0;
        return h >>> 0;
    };

    const channelData = (buffer, ch) => buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1));

    const sampleAt = (buffer, ch, t, wrap = false) => {
        const d = buffer.duration;
        if (d <= 0) return 0;
        let tt = t;
        if (wrap) tt = wrapTime(tt, d);
        else if (tt < 0 || tt >= d) return 0;

        const data = channelData(buffer, ch);
        const pos = tt * buffer.sampleRate;
        const i0 = Math.floor(pos);
        const i1 = Math.min(data.length - 1, i0 + 1);
        const frac = pos - i0;
        return data[i0] * (1 - frac) + data[i1] * frac;
    };

    const monoSampleAt = (buffer, t, wrap = false) => {
        let sum = 0;
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
            sum += sampleAt(buffer, ch, t, wrap);
        }
        return sum / Math.max(1, buffer.numberOfChannels);
    };

    const bounceWindow = () => {
        const D = controlBuffer.duration;
        let head = Math.max(0, -params.time);
        let tail = Math.max(0, params.time);

        if (params.feedback > 0.01) {
            const f = Math.min(0.95, params.feedback);
            const repeats = Math.log(0.001) / Math.log(f);          // passes to -60 dB
            const step = Math.max(0.03, Math.abs(params.time));
            const room = Math.min(8, repeats * step);
            if (params.time < 0) head += room;
            else tail += room;
        }

        return {
            start: -head,
            end: D + tail,
            head,
            tail,
            duration: D + head + tail,
        };
    };

    const offlineSidechainRaw = (globalT) => {
        const ampT = wrapTime(globalT - params.sidechainLookahead, controlBuffer.duration);
        return rawRmsAtTime(ampT);
    };

    const grainWindowAt = (localT, duration) => {
        if (windowType === 'hann') {
            return 0.5 * (1 - Math.cos((2 * Math.PI * localT) / Math.max(0.000001, duration)));
        }
        const attackTime = duration * params.envelopeShape;
        if (localT <= attackTime) return attackTime <= 0 ? 1 : localT / attackTime;
        return (duration - localT) / Math.max(0.000001, duration - attackTime);
    };

    const addOfflineGrain = (wet, opts) => {
        const { channels, length, sampleRate, globalStart, globalT, amplitude, rand, grainIndex } = opts;
        if (amplitude <= 0.001) return;

        const grainDuration = params.grainSize / 1000;
        let readPos = globalT - params.time;
        if (loopClip) {
            readPos = wrapTime(readPos, sourceBuffer.duration);
        }

        const pitchSemis = params.pitch + (rand() - 0.5) * 2 * params.pitchSpray;
        const pitchRate = Math.pow(2, pitchSemis / 12);
        const pan = panForGrain(rand, grainIndex);
        const panGains = equalPowerPan(pan);
        const readWindow = grainDuration * pitchRate;
        const startOffset = scatteredGrainRead(rand, readPos, readWindow, sourceBuffer.duration).offset;
        const first = Math.max(0, Math.floor((globalT - globalStart) * sampleRate));
        const grainSamples = Math.max(1, Math.ceil(grainDuration * sampleRate));

        for (let j = 0; j < grainSamples; j++) {
            const outIdx = first + j;
            if (outIdx < 0 || outIdx >= length) continue;
            const localT = j / sampleRate;
            const gain = amplitude * grainWindowAt(localT, grainDuration);
            if (gain <= 0) continue;
            const readT = startOffset + localT * pitchRate;
            if (params.panSpray > 0 && channels >= 2) {
                const v = monoSampleAt(sourceBuffer, readT, loopClip) * gain;
                wet[0][outIdx] += v * panGains.left;
                wet[1][outIdx] += v * panGains.right;
            } else {
                for (let ch = 0; ch < channels; ch++) {
                    wet[ch][outIdx] += sampleAt(sourceBuffer, ch, readT, loopClip) * gain;
                }
            }
        }
    };

    const renderWetFeedback = (wetBase, sampleRate) => {
        const f = Math.min(0.95, Math.max(0, params.feedback));
        if (f <= 0.001) return wetBase.map(ch => new Float32Array(ch));

        const delaySamples = Math.max(1, Math.round(Math.max(0.03, Math.abs(params.time)) * sampleRate));
        const texture = Math.max(0, Math.min(1, params.feedbackGrain));
        const effectiveDamping = Math.max(params.damping, texture * 0.85);
        const cutoff = 200 * Math.pow(100, 1 - effectiveDamping);
        const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
        const out = wetBase.map(ch => new Float32Array(ch));
        const feedbackChannel = (ch) => {
            if (!pingPong || out.length < 2) return ch;
            if (ch === 0) return 1;
            if (ch === 1) return 0;
            return ch;
        };

        const length = out[0].length;
        const smearSamples = Math.round((params.grainSize / 1000) * sampleRate * 0.5 * texture);
        const blockSamples = Math.max(8, Math.round((params.grainSize / 1000) * sampleRate * 0.25));
        const offsets = new Int32Array(out.length);
        const offsetRand = mulberry32((bounceSeed() ^ 0x6D697874) >>> 0); // "mixt"
        const chooseOffsets = () => {
            if (smearSamples <= 0) return;
            for (let ch = 0; ch < offsets.length; ch++) {
                offsets[ch] = Math.round((offsetRand() * 2 - 1) * smearSamples);
            }
        };
        const delayedSample = (src, ch, exact, i) => {
            if (exact < 0 || exact >= length) return 0;
            const clean = out[src][exact];
            if (smearSamples <= 0 || texture <= 0) return clean;
            let shifted = exact + offsets[ch];
            if (params.time < 0) shifted = Math.max(i + 1, Math.min(length - 1, shifted));
            else shifted = Math.min(i - 1, Math.max(0, shifted));
            return clean * (1 - texture) + out[src][shifted] * texture;
        };

        const lp = new Float32Array(out.length);
        if (params.time < 0) {
            for (let i = length - 1; i >= 0; i--) {
                if (texture > 0 && ((length - 1 - i) % blockSamples) === 0) chooseOffsets();
                for (let ch = 0; ch < out.length; ch++) {
                    const src = feedbackChannel(ch);
                    const delayed = delayedSample(src, ch, i + delaySamples, i);
                    lp[ch] += alpha * (delayed - lp[ch]);
                    out[ch][i] += f * lp[ch];
                }
            }
        } else {
            for (let i = 0; i < length; i++) {
                if (texture > 0 && (i % blockSamples) === 0) chooseOffsets();
                for (let ch = 0; ch < out.length; ch++) {
                    const src = feedbackChannel(ch);
                    const delayed = delayedSample(src, ch, i - delaySamples, i);
                    lp[ch] += alpha * (delayed - lp[ch]);
                    out[ch][i] += f * lp[ch];
                }
            }
        }
        return out;
    };

    const encodeFloatWav = (channelsData, sampleRate) => {
        const channels = channelsData.length;
        const length = channelsData[0].length;
        const bytesPerSample = 4;
        const blockAlign = channels * bytesPerSample;
        const dataSize = length * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        let offset = 0;

        const writeString = (s) => {
            for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
        };

        writeString('RIFF');
        view.setUint32(offset, 36 + dataSize, true); offset += 4;
        writeString('WAVE');
        writeString('fmt ');
        view.setUint32(offset, 16, true); offset += 4;
        view.setUint16(offset, 3, true); offset += 2;                 // IEEE float
        view.setUint16(offset, channels, true); offset += 2;
        view.setUint32(offset, sampleRate, true); offset += 4;
        view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
        view.setUint16(offset, blockAlign, true); offset += 2;
        view.setUint16(offset, bytesPerSample * 8, true); offset += 2;
        writeString('data');
        view.setUint32(offset, dataSize, true); offset += 4;

        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < channels; ch++) {
                view.setFloat32(offset, channelsData[ch][i], true);
                offset += 4;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    };

    const renderBounce = () => {
        const sampleRate = audioContext.sampleRate;
        const channels = Math.max(2, sourceBuffer.numberOfChannels, controlBuffer.numberOfChannels);
        const win = bounceWindow();
        const length = Math.max(1, Math.ceil(win.duration * sampleRate));
        const dry = Array.from({ length: channels }, () => new Float32Array(length));
        const wetBase = Array.from({ length: channels }, () => new Float32Array(length));
        const rand = mulberry32(bounceSeed());

        const clean = Math.cos(params.scatter * 0.5 * Math.PI);
        const gran = Math.sin(params.scatter * 0.5 * Math.PI);

        for (let i = 0; i < length; i++) {
            const globalT = win.start + i / sampleRate;
            for (let ch = 0; ch < channels; ch++) {
                if (sourceDry) dry[ch][i] += sampleAt(sourceBuffer, ch, globalT, false);
                if (monitorControl) dry[ch][i] += sampleAt(controlBuffer, ch, globalT, false);
                if (clean > 0.0001) {
                    const readT = globalT - params.time;
                    wetBase[ch][i] += sampleAt(sourceBuffer, ch, readT, loopClip) * clean;
                }
            }
        }

        let grainT = win.start;
        let grainIndex = 0;
        while (grainT < win.end) {
            const raw = offlineSidechainRaw(grainT);
            const env = raw * 4;
            let amp = 0;
            if (gateEnabled) {
                const fire = params.polarity < 0 ? (raw <= params.threshold) : (raw > params.threshold);
                amp = fire ? 1 : 0;
            } else {
                amp = sidechainAmplitude(env);
            }
            if (gran > 0.0001) {
                addOfflineGrain(wetBase, {
                    channels,
                    length,
                    sampleRate,
                    globalStart: win.start,
                    globalT: grainT,
                    amplitude: amp * gran,
                    rand,
                    grainIndex,
                });
            }

            const base = 1 / params.grainDensity;
            const jitter = (rand() - 0.5) * base * params.densityJitter;
            grainT += Math.max(0.001, base + jitter);
            grainIndex++;
        }

        const wet = renderWetFeedback(wetBase, sampleRate);
        const dryMix = Math.cos(params.mix * 0.5 * Math.PI);
        const wetMix = Math.cos((1 - params.mix) * 0.5 * Math.PI);
        const out = Array.from({ length: channels }, () => new Float32Array(length));
        let peak = 0;

        for (let ch = 0; ch < channels; ch++) {
            for (let i = 0; i < length; i++) {
                const v = dry[ch][i] * dryMix + wet[ch][i] * wetMix;
                out[ch][i] = v;
                const a = Math.abs(v);
                if (a > peak) peak = a;
            }
        }

        const scale = peak > BOUNCE_PEAK ? BOUNCE_PEAK / peak : 1;
        if (scale < 1) {
            for (const ch of out) {
                for (let i = 0; i < ch.length; i++) ch[i] *= scale;
            }
        }

        return { blob: encodeFloatWav(out, sampleRate), duration: win.duration, peak, scale };
    };

    const bounceWav = async () => {
        if (isBouncing || !controlBuffer || !sourceBuffer) return;
        isBouncing = true;
        recordButton.disabled = true;
        recordButton.textContent = 'Bouncing...';
        recordButton.classList.add('recording');

        try {
            await new Promise(resolve => setTimeout(resolve, 0));
            const result = renderBounce();
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pythia-bounce-${new Date().toISOString()}.wav`;
            a.textContent = `${a.download} (${result.duration.toFixed(2)}s)`;
            const li = document.createElement('li');
            li.appendChild(a);
            recordingsList.appendChild(li);
        } catch (err) {
            console.error('Bounce error:', err);
            const li = document.createElement('li');
            li.textContent = 'Bounce failed — see console';
            recordingsList.appendChild(li);
        } finally {
            isBouncing = false;
            recordButton.disabled = !(isSelfSampling ? !!controlBuffer : (!!controlBuffer && !!sourceBuffer));
            recordButton.textContent = 'Bounce WAV';
            recordButton.classList.remove('recording');
        }
    };

    recordButton.addEventListener('click', bounceWav);

    // ── State (single source of truth for JSON export/import) ──────────────────
    // Audio buffers stay out of the JSON — processing state only, so a saved
    // preset travels across files. Versioned from day one.
    // v2 (Phase 2): mode/delay replaced by gateEnabled/polarity/sidechainLookahead;
    // dry bus is explicit (sourceDry, monitorControl) instead of control-is-always-dry.
    // v3 (Phase 3 first slice): user BPM + Time Sync division.
    // v4 (Phase 3 second slice): granulator pitch center + pitch spray.
    // v5 (Phase 3 third slice): Pan Spray + Ping-Pong feedback.
    // v6 (Phase 3 fourth slice): Feedback Grain/disintegration amount.
    const STATE_VERSION = 6;

    const serializeState = () => ({
        version:      STATE_VERSION,
        selfSampling: isSelfSampling,
        loopClip,
        gateEnabled,
        sourceDry,
        monitorControl,
        timeSync,
        pingPong,
        windowType,
        params:       { ...params },
    });

    const applyState = (s) => {
        if (!s || typeof s !== 'object') return;
        const isLegacy = !(s.version >= 2);   // pre-Phase-2 file (v1 or unversioned)

        if (s.params) {
            const savedParams = { ...s.params };
            // Legacy migration: pre-Phase-1 states carry `lookahead` (read at
            // t + lookahead); the signed Time knob is its negation.
            if (savedParams.time === undefined && typeof savedParams.lookahead === 'number') {
                savedParams.time = -savedParams.lookahead;
            }
            // Legacy migration: pre-Phase-2 `delay` was exactly the same offset
            // math as the new sidechainLookahead — just renamed, no sign change.
            if (savedParams.sidechainLookahead === undefined && typeof savedParams.delay === 'number') {
                savedParams.sidechainLookahead = savedParams.delay;
            }
            const p = { ...DEFAULT_PARAMS, ...savedParams };
            Object.keys(sliders).forEach(key => {
                if (typeof p[key] === 'number') {
                    sliders[key].value = p[key];
                    sliders[key].dispatchEvent(new Event('input'));
                }
            });
        }
        if (typeof s.loopClip === 'boolean') {
            loopClip = s.loopClip;
            loopRadios.forEach(r => { r.checked = (r.value === (s.loopClip ? 'loop' : 'unloop')); });
        }
        if (s.windowType) {
            windowType = s.windowType;
            if (windowSelect) windowSelect.value = s.windowType;
        }
        timeSync = syncDivisions[s.timeSync] ? s.timeSync : 'free';
        if (timeSync !== 'free') applyTimeSync();
        else updateTimeSyncUI();

        pingPong = typeof s.pingPong === 'boolean' ? s.pingPong : false;
        if (pingPongCheckbox) pingPongCheckbox.checked = pingPong;
        updatePingPong();

        // Legacy migration: pre-Phase-2 `mode: 'triggered'` was always follow-direction
        // gating; `mode: 'continuous'` was always follow. Polarity comes from params
        // above (or defaults to the slider's own value if the file predates polarity).
        const gate = typeof s.gateEnabled === 'boolean' ? s.gateEnabled : (s.mode === 'triggered');
        gateCheckbox.checked = gate;
        gateEnabled = gate;
        updateGateUI();

        // Legacy migration: pre-Phase-2 files never had a dry-bus choice — control
        // was unconditionally the only audible dry signal. Reproduce that exactly
        // unless the file explicitly specifies otherwise (Phase-2+ files).
        const srcDry = typeof s.sourceDry === 'boolean' ? s.sourceDry : !isLegacy;
        const monCtl = typeof s.monitorControl === 'boolean' ? s.monitorControl : isLegacy;
        sourceDryCheckbox.checked = srcDry;
        sourceDry = srcDry;
        sourceDryGain.gain.setTargetAtTime(srcDry ? 1 : 0, audioContext.currentTime, 0.02);
        monitorCtrlCheckbox.checked = monCtl;
        monitorControl = monCtl;
        controlMonitorGain.gain.setTargetAtTime(monCtl ? 1 : 0, audioContext.currentTime, 0.02);

        if (typeof s.selfSampling === 'boolean') {
            selfSampleCheckbox.checked = s.selfSampling;
            selfSampleCheckbox.dispatchEvent(new Event('change'));
        }
    };

    const PRESET_BASE = {
        version: STATE_VERSION,
        loopClip: true,
        gateEnabled: false,
        sourceDry: true,
        monitorControl: false,
        timeSync: 'free',
        pingPong: false,
        windowType: 'hann',
    };
    const makePreset = (overrides = {}) => ({
        ...PRESET_BASE,
        ...overrides,
        params: { polarity: 0, ...(overrides.params || {}) },
    });
    const PRESETS = {
        slapback: makePreset({
            params: { time: 0.11, scatter: 0, feedback: 0.10, damping: 0.2, mix: 0.35 },
        }),
        anticipatoryDelay: makePreset({
            loopClip: false,
            params: { time: -0.35, scatter: 0, feedback: 0.55, damping: 0.15, mix: 0.45 },
        }),
        pingPongPneuma: makePreset({
            timeSync: '1/4',
            pingPong: true,
            params: { bpm: 120, scatter: 0.08, feedback: 0.55, damping: 0.35, panSpray: 0.6, mix: 0.45 },
        }),
        dubOuroboros: makePreset({
            timeSync: '1/8d',
            params: { bpm: 120, scatter: 0.18, feedback: 0.8, damping: 0.7, feedbackGrain: 0.2, mix: 0.5 },
        }),
        oracleChorus: makePreset({
            params: { time: 0.04, scatter: 0.12, grainSize: 60, grainDensity: 40, pitchSpray: 0.3, panSpray: 0.8, feedback: 0.05, mix: 0.5 },
        }),
        stereoVapor: makePreset({
            params: { scatter: 0.85, grainSize: 200, grainDensity: 30, densityJitter: 0.4, pitchSpray: 1.5, panSpray: 1, feedback: 0.1, mix: 0.6 },
        }),
        shimmerVapor: makePreset({
            params: { pitch: 12, scatter: 0.55, grainSize: 250, feedback: 0.6, damping: 0.4, panSpray: 0.5, mix: 0.4 },
        }),
        disintegratingEcho: makePreset({
            params: { time: 0.5, scatter: 0.05, feedback: 0.75, feedbackGrain: 0.8, damping: 0.3, mix: 0.5 },
        }),
        glassHalo: makePreset({
            params: { time: 0.08, scatter: 0.28, grainSize: 90, grainDensity: 55, pitch: 7, pitchSpray: 0.2, panSpray: 1, feedback: 0.12, damping: 0.2, mix: 0.45 },
        }),
        tapeMirage: makePreset({
            timeSync: '1/16',
            params: { bpm: 120, scatter: 0.22, grainSize: 110, grainDensity: 25, pitchSpray: 0.8, panSpray: 0.35, feedback: 0.65, feedbackGrain: 0.45, damping: 0.55, mix: 0.5 },
        }),
        verbatimPreEcho: makePreset({
            loopClip: false,
            params: { time: -0.4, scatter: 0, feedback: 0.3, mix: 0.4 },
        }),
        anticipationBloom: makePreset({
            loopClip: false,
            params: { time: -0.8, scatter: 0.65, grainSize: 180, grainDensity: 35, pitchSpray: 0.5, panSpray: 0.7, feedback: 0.5, mix: 0.5 },
        }),
        preDuck: makePreset({
            timeSync: '1/8',
            params: { polarity: -1, sidechainLookahead: -0.15, bpm: 120, scatter: 0.2, feedback: 0.5, damping: 0.4, mix: 0.5 },
        }),
        duckGateGaps: makePreset({
            gateEnabled: true,
            params: { polarity: -1, threshold: 0.18, scatter: 0.6, grainSize: 120, grainDensity: 30, panSpray: 0.4, mix: 0.6 },
        }),
        negativeShimmer: makePreset({
            loopClip: false,
            params: { time: -0.6, scatter: 0.55, grainSize: 220, grainDensity: 32, pitch: 7, pitchSpray: 0.4, panSpray: 0.75, feedback: 0.45, feedbackGrain: 0.35, damping: 0.45, mix: 0.5 },
        }),
        reverseRoom: makePreset({
            loopClip: false,
            params: { time: -1.2, scatter: 0.35, grainSize: 260, grainDensity: 28, feedback: 0.65, feedbackGrain: 0.5, damping: 0.5, panSpray: 0.45, mix: 0.55 },
        }),
    };
    const applyPreset = (key) => {
        const preset = PRESETS[key];
        if (!preset) return;
        applyingPreset = true;
        if (presetSelect) presetSelect.value = key;
        try {
            applyState(preset);
        } finally {
            applyingPreset = false;
        }
    };
    if (presetSelect) {
        presetSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') return;
            applyPreset(e.target.value);
        });
    }

    if (windowSelect) {
        windowSelect.addEventListener('change', (e) => {
            markPresetCustom();
            windowType = e.target.value;
        });
    }

    if (saveStateBtn) {
        saveStateBtn.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(serializeState(), null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `pythia-state-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    if (loadStateInput) {
        loadStateInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try { applyState(JSON.parse(ev.target.result)); }
                catch (err) { console.error('State load error:', err); }
            };
            reader.readAsText(file);
            e.target.value = '';
        });
    }

    // ── Init ──────────────────────────────────────────────────────────────────
    updateGateUI();
    updateSelfSampling();
    updateTimeSyncUI();
    updatePingPong();
};
