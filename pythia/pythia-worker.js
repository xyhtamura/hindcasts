/**
 * pythia-worker.js — Standalone Pythia Render Engine
 * Encapsulates offline sample-domain rendering for Web Workers (async) and file:// (sync fallback).
 */

function performBounceRender(data) {
    const {
        controlChannels,
        controlSampleRate,
        sourceChannels,
        sourceSampleRate,
        params: inputParams,
        gateEnabled,
        loopClip,
        windowType,
        pingPong,
        sourceDry,
        monitorControl,
        gapFitEnabled,
        caesuraPolicy: requestedCaesuraPolicy,
        gapMap,
        controlRmsEnvelope,
        temporalStance: requestedTemporalStance,
        temporalBalance: requestedTemporalBalance,
        _returnPcm
    } = data;

    const inferredStance = inputParams.time < 0 ? 'anticipation' : 'wake';
    const temporalStance = ['wake', 'anticipation', 'symmetric'].includes(requestedTemporalStance)
        ? requestedTemporalStance : inferredStance;
    const temporalBalance = Math.max(0, Math.min(1, Number.isFinite(requestedTemporalBalance)
        ? requestedTemporalBalance : Number.isFinite(inputParams.timeBalance) ? inputParams.timeBalance : 0.5));
    const caesuraPolicy = ['off', 'fit', 'duck'].includes(requestedCaesuraPolicy)
        ? requestedCaesuraPolicy : gapFitEnabled ? 'fit' : 'off';
    const timeMagnitude = Math.abs(inputParams.time);
    const params = {
        ...inputParams,
        time: temporalStance === 'anticipation' ? -timeMagnitude : timeMagnitude,
    };

    // Reconstruct simplified buffer structures
    const controlBuffer = {
        numberOfChannels: controlChannels.length,
        sampleRate: controlSampleRate,
        duration: controlChannels[0].length / controlSampleRate,
        channels: controlChannels
    };

    const sourceBuffer = {
        numberOfChannels: sourceChannels.length,
        sampleRate: sourceSampleRate,
        duration: sourceChannels[0].length / sourceSampleRate,
        channels: sourceChannels
    };

    // Helper functions
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

    const bounceSeed = (params, gateEnabled, loopClip, windowType, pingPong) => {
        let h = 0x50595448; // "PYTH"
        const keys = Object.keys(params).filter(k => k !== 'bpm' && k !== 'timeBalance').sort();
        for (const k of keys) {
            const value = k === 'time' ? Math.abs(params[k]) : params[k];
            const s = `${k}:${value.toFixed(6)};`;
            for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
        }
        h ^= gateEnabled ? 0x11111111 : 0;
        h ^= loopClip ? 0x22222222 : 0;
        h ^= windowType === 'hann' ? 0x33333333 : 0;
        h ^= pingPong ? 0x44444444 : 0;
        return h >>> 0;
    };

    const channelData = (buffer, ch) => buffer.channels[Math.min(ch, buffer.numberOfChannels - 1)];

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

    const feedbackRepeatCount = (feedback, params) => {
        const f = clamp(feedback, 0, 0.95);
        if (f <= 0.001) return 0;
        const step = Math.max(0.03, Math.abs(params.time));
        const natural = Math.max(0, Math.floor(Math.log(0.001) / Math.log(f)));
        const maxRing = Number.isFinite(params.maxRing) ? params.maxRing : 8;
        return Math.min(natural, Math.max(0, Math.floor(maxRing / step)));
    };

    const buildGapFitPolicy = (map, params, loopClip) => {
        const userFeedback = clamp(params.feedback, 0, 0.95);
        const events = map && map.schema === 'hindcasts.gap-map' && map.version === 1
            ? map.events : [];
        if (!events.length || userFeedback <= 0.001) return null;
        const step = Math.max(0.03, Math.abs(params.time));
        const credit = clamp(Number.isFinite(params.maskingCredit) ? params.maskingCredit : 0.35, 0, 1);
        const spill = Number.isFinite(params.gapSpill) ? params.gapSpill : -36;
        const floorDb = Number.isFinite(map.floorDbfs) ? map.floorDbfs : -72;

        const solved = events.map((event, index) => {
            const previous = index > 0 ? events[index - 1] : (loopClip ? events[events.length - 1] : null);
            const positive = params.time >= 0;
            const neighbor = positive
                ? (index + 1 < events.length ? events[index + 1] : (loopClip ? events[0] : null))
                : previous;
            let feedback = userFeedback;
            if (neighbor) {
                const gapSamples = positive
                    ? Math.max(0, index + 1 < events.length
                        ? event.nextOnsetSample - event.releaseSample
                        : map.durationSamples - event.releaseSample + neighbor.onsetSample)
                    : Math.max(0, index > 0
                        ? event.onsetSample - previous.releaseSample
                        : event.onsetSample + map.durationSamples - previous.releaseSample);
                const protectedDb = positive
                    ? (index + 1 < events.length ? event.nextOnsetRmsDbfs : neighbor.eventRmsPeakDbfs)
                    : previous.eventRmsPeakDbfs;
                const floorRel = floorDb - event.eventRmsPeakDbfs;
                const baseRel = spill <= -71.5 ? floorRel : Math.max(spill, floorRel);
                const maskingRel = protectedDb - event.eventRmsPeakDbfs - 12;
                const allowedRel = clamp(baseRel + credit * Math.max(0, maskingRel - baseRel), -120, 0);
                const gapSeconds = gapSamples / map.sampleRate;
                const primaryOffset = Math.abs(params.time);
                const collisionRepeat = Math.max(1, Math.ceil(Math.max(0, gapSeconds - primaryOffset) / step));
                const requiredFeedback = Math.pow(10, allowedRel / (20 * collisionRepeat));
                feedback = Math.min(userFeedback, requiredFeedback);
            }
            return {
                onsetSample: event.onsetSample,
                feedback,
                repeats: feedbackRepeatCount(feedback, params),
            };
        });

        const eventAtSample = sample => {
            let lo = 0, hi = solved.length - 1;
            while (lo < hi) {
                const mid = Math.ceil((lo + hi) / 2);
                if (solved[mid].onsetSample <= sample) lo = mid;
                else hi = mid - 1;
            }
            return solved[lo];
        };
        return {
            events: solved,
            maxRepeats: solved.reduce((n, event) => Math.max(n, event.repeats), 0),
            eventAtSample,
        };
    };

    // Caesura DUCK keeps the feedback law fixed and rides the whole wet down
    // into each oncoming event, from whole-file analysis rather than from the
    // control envelope: it is active with the sidechain off, and polarity still
    // multiplies on top. It is a ride, not a kill — it may dip mid-repeat.
    const DUCK_RIDE_SECONDS = 0.045;

    const buildDuckPolicy = (map, params, loopClip) => {
        const events = map && map.schema === 'hindcasts.gap-map' && map.version === 1
            ? map.events : [];
        if (events.length < 2) return null;
        const credit = clamp(Number.isFinite(params.maskingCredit) ? params.maskingCredit : 0.35, 0, 1);
        const spill = Number.isFinite(params.gapSpill) ? params.gapSpill : -36;
        const floorDb = Number.isFinite(map.floorDbfs) ? map.floorDbfs : -72;
        const feedback = clamp(params.feedback, 0, 0.95);
        const positive = params.time >= 0;
        const step = Math.max(0.03, Math.abs(params.time));
        const primaryOffset = Math.abs(params.time);
        const pairCount = loopClip ? events.length : events.length - 1;
        const rides = [];

        for (let index = 0; index < pairCount; index++) {
            const first = events[index];
            const second = events[(index + 1) % events.length];
            const gapSamples = index + 1 < events.length
                ? Math.max(0, second.onsetSample - first.releaseSample)
                : Math.max(0, map.durationSamples - first.releaseSample + second.onsetSample);
            // The train travels the way Time points: wake spills forward onto
            // the next event, anticipation spills backward onto the previous one.
            const emitter = positive ? first : second;
            const shielded = positive ? second : first;
            const floorRel = floorDb - emitter.eventRmsPeakDbfs;
            const baseRel = spill <= -71.5 ? floorRel : Math.max(spill, floorRel);
            const maskingRel = shielded.eventRmsPeakDbfs - emitter.eventRmsPeakDbfs - 12;
            const allowedRel = clamp(baseRel + credit * Math.max(0, maskingRel - baseRel), -120, 0);
            // How loud the fixed train still is when it arrives: the primary tap
            // itself when the gap is shorter than Time, otherwise the repeat that
            // crosses the gap.
            const crossing = Math.ceil(Math.max(0, gapSamples / map.sampleRate - primaryOffset) / step);
            const predictedRel = crossing === 0 ? 0
                : feedback <= 0.001 ? -Infinity
                : 20 * crossing * Math.log10(feedback);
            const gain = Math.pow(10, Math.min(0, allowedRel - predictedRel) / 20);
            if (!(gain < 1)) continue;
            const onset = shielded.onsetSample / map.sampleRate;
            const release = Math.max(shielded.releaseSample / map.sampleRate, onset + DUCK_RIDE_SECONDS);
            rides.push({ onset, release, gain });
        }

        return rides.length ? { rides } : null;
    };

    const applyDuckRide = (wet, sampleRate, win, policy) => {
        if (!policy) return 0;
        const length = wet[0].length;
        const envelope = new Float32Array(length);
        envelope.fill(1);
        // Zero-phase by construction: a raised-cosine ramp of equal length on
        // both sides of the event, so the ride is already down when the event
        // arrives and back up after it, with no group delay and the full
        // requested depth held across the event itself.
        const ramp = Math.max(1, Math.round(DUCK_RIDE_SECONDS * sampleRate));
        let applied = 0;
        for (const ride of policy.rides) {
            const core = Math.round((ride.onset - win.start) * sampleRate);
            const coreEnd = Math.round((ride.release - win.start) * sampleRate);
            if (coreEnd <= core) continue;
            const from = clamp(core - ramp, 0, length);
            const to = clamp(coreEnd + ramp, from, length);
            if (to <= from) continue;
            applied++;
            for (let i = from; i < to; i++) {
                const outside = i < core ? (core - i) / ramp : i >= coreEnd ? (i - coreEnd + 1) / ramp : 0;
                const skirt = 0.5 - 0.5 * Math.cos(Math.PI * clamp(outside, 0, 1));
                const gain = ride.gain + (1 - ride.gain) * skirt;
                if (gain < envelope[i]) envelope[i] = gain;
            }
        }
        if (!applied) return 0;
        for (const channel of wet) for (let i = 0; i < length; i++) channel[i] *= envelope[i];
        return applied;
    };

    const bounceWindow = (controlBuffer, params, gapPolicy) => {
        const D = controlBuffer.duration;
        let head = Math.max(0, -params.time);
        let tail = Math.max(0, params.time);

        if (params.feedback > 0.01) {
            const step = Math.max(0.03, Math.abs(params.time));
            const repeats = gapPolicy ? gapPolicy.maxRepeats : feedbackRepeatCount(params.feedback, params);
            const room = repeats * step;
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

    const rawRmsAtTime = (t, controlRmsEnvelope, sampleRate) => {
        if (!controlRmsEnvelope.length) return 0;
        const idx = Math.max(0, Math.min(
            controlRmsEnvelope.length - 1,
            Math.floor(t * sampleRate / 256)
        ));
        return controlRmsEnvelope[idx];
    };

    const sidechainRawAtOutputTime = (outputT, controlBuffer, params, loopClip, controlRmsEnvelope, sampleRate) => {
        if (!controlBuffer) return 0;
        const t = outputT - params.time - params.sidechainLookahead;
        if (loopClip) return rawRmsAtTime(wrapTime(t, controlBuffer.duration), controlRmsEnvelope, sampleRate);
        if (t < 0 || t >= controlBuffer.duration) return 0;
        return rawRmsAtTime(t, controlRmsEnvelope, sampleRate);
    };

    const grainWindowAt = (localT, duration, windowType, envelopeShape) => {
        if (windowType === 'hann') {
            return 0.5 * (1 - Math.cos((2 * Math.PI * localT) / Math.max(0.000001, duration)));
        }
        const attackTime = duration * envelopeShape;
        if (localT <= attackTime) return attackTime <= 0 ? 1 : localT / attackTime;
        return (duration - localT) / Math.max(0.000001, duration - attackTime);
    };

    const panForGrain = (rand, index, params, pingPong) => {
        const amount = Math.max(0, Math.min(1, params.panSpray));
        if (amount <= 0) return 0;
        if (pingPong) return (index % 2 === 0 ? -amount : amount);
        return (rand() * 2 - 1) * amount;
    };

    const equalPowerPan = (pan) => {
        const x = (Math.max(-1, Math.min(1, pan)) + 1) * 0.25 * Math.PI;
        return { left: Math.cos(x), right: Math.sin(x) };
    };

    const grainReadOffset = (readPos, readWindow, sourceDuration, loopClip) => {
        if (loopClip) return wrapTime(readPos, sourceDuration);
        return Math.max(0, Math.min(Math.max(0, sourceDuration - readWindow), readPos));
    };

    const scatteredGrainRead = (rand, readPos, readWindow, sourceDuration, params, loopClip) => {
        const amount = Math.max(0, Math.min(1, params.scatter));
        const idealOffset = grainReadOffset(readPos, readWindow, sourceDuration, loopClip);
        if (amount <= 0) return { offset: idealOffset, idealOffset, delta: 0, range: 0 };

        const halfRange = sourceDuration * 0.5 * amount;
        if (loopClip) {
            const delta = (rand() * 2 - 1) * halfRange;
            return {
                offset: wrapTime(idealOffset + delta, sourceDuration),
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

    const addOfflineGrain = (wet, opts) => {
        const { channels, length, sampleRate, globalStart, globalT, amplitude, rand, grainIndex, params, loopClip, pingPong, sourceBuffer, windowType } = opts;
        if (amplitude <= 0.001) return;

        const grainDuration = params.grainSize / 1000;
        let readPos = globalT - params.time;
        if (loopClip) {
            readPos = wrapTime(readPos, sourceBuffer.duration);
        }

        const pitchSemis = params.pitch + (rand() - 0.5) * 2 * params.pitchSpray;
        const pitchRate = Math.pow(2, pitchSemis / 12);
        const pan = panForGrain(rand, grainIndex, params, pingPong);
        const panGains = equalPowerPan(pan);
        const readWindow = grainDuration * pitchRate;
        const startOffset = scatteredGrainRead(rand, readPos, readWindow, sourceBuffer.duration, params, loopClip).offset;
        const first = Math.max(0, Math.floor((globalT - globalStart) * sampleRate));
        const grainSamples = Math.max(1, Math.ceil(grainDuration * sampleRate));

        for (let j = 0; j < grainSamples; j++) {
            const outIdx = first + j;
            if (outIdx < 0 || outIdx >= length) continue;
            const localT = j / sampleRate;
            const gain = amplitude * grainWindowAt(localT, grainDuration, windowType, params.envelopeShape);
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

    const renderWetFeedback = (wetBase, sampleRate, params, pingPong, seed) => {
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
        const offsetRand = mulberry32((seed ^ 0x6D697874) >>> 0); // "mixt"
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

    // Gap Fit keeps event provenance by rendering one whole repeat pass at a
    // time. Each root sample inherits the policy of the source event it reads;
    // damping, ping-pong and feedback-grain texture are still accumulated pass
    // by pass. This path is intentionally offline-authoritative.
    const renderGapFitFeedback = (wetBase, sampleRate, params, pingPong, seed, policy, win, map, sourceBuffer, loopClip) => {
        const out = wetBase.map(ch => new Float32Array(ch));
        if (!policy || policy.maxRepeats < 1) return out;
        const length = out[0].length;
        const delaySamples = Math.max(1, Math.round(Math.max(0.03, Math.abs(params.time)) * sampleRate));
        const texture = clamp(params.feedbackGrain, 0, 1);
        const effectiveDamping = Math.max(params.damping, texture * 0.85);
        const cutoff = 200 * Math.pow(100, 1 - effectiveDamping);
        const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
        const maxByWindow = Math.floor((length - 1) / delaySamples);
        const passes = Math.min(policy.maxRepeats, maxByWindow);
        const rootFeedback = new Float32Array(length);
        const rootRepeats = new Uint16Array(length);

        for (let root = 0; root < length; root++) {
            let sourceT = win.start + root / sampleRate - params.time;
            if (loopClip && sourceBuffer.duration > 0) sourceT = wrapTime(sourceT, sourceBuffer.duration);
            const sourceSample = clamp(Math.round(sourceT * map.sampleRate), 0, Math.max(0, map.durationSamples - 1));
            const event = policy.eventAtSample(sourceSample);
            rootFeedback[root] = event.feedback;
            rootRepeats[root] = event.repeats;
        }

        const feedbackChannel = ch => {
            if (!pingPong || out.length < 2) return ch;
            if (ch === 0) return 1;
            if (ch === 1) return 0;
            return ch;
        };
        const smearSamples = Math.round((params.grainSize / 1000) * sampleRate * 0.5 * texture);
        const blockSamples = Math.max(8, Math.round((params.grainSize / 1000) * sampleRate * 0.25));
        const offsetRand = mulberry32((seed ^ 0x47415046) >>> 0); // "GAPF"
        let previous = wetBase.map(ch => new Float32Array(ch));

        for (let pass = 1; pass <= passes; pass++) {
            const current = wetBase.map(ch => new Float32Array(ch.length));
            const lp = new Float32Array(out.length);
            const offsets = new Int32Array(out.length);
            const chooseOffsets = () => {
                if (smearSamples <= 0) return;
                for (let ch = 0; ch < offsets.length; ch++) offsets[ch] = Math.round((offsetRand() * 2 - 1) * smearSamples);
            };
            let active = false;

            if (params.time < 0) {
                const limit = length - pass * delaySamples;
                for (let i = limit - 1; i >= 0; i--) {
                    if (texture > 0 && ((limit - 1 - i) % blockSamples) === 0) chooseOffsets();
                    const exact = i + delaySamples;
                    const root = i + pass * delaySamples;
                    const feedback = pass <= rootRepeats[root] ? rootFeedback[root] : 0;
                    for (let ch = 0; ch < out.length; ch++) {
                        const src = feedbackChannel(ch);
                        let shifted = clamp(exact + offsets[ch], i + 1, length - 1);
                        const delayed = previous[src][exact] * (1 - texture) + previous[src][shifted] * texture;
                        lp[ch] += alpha * (delayed - lp[ch]);
                        const v = feedback * lp[ch];
                        current[ch][i] = v;
                        out[ch][i] += v;
                        active = active || Math.abs(v) > 1e-12;
                    }
                }
            } else {
                const start = pass * delaySamples;
                for (let i = start; i < length; i++) {
                    if (texture > 0 && ((i - start) % blockSamples) === 0) chooseOffsets();
                    const exact = i - delaySamples;
                    const root = i - pass * delaySamples;
                    const feedback = pass <= rootRepeats[root] ? rootFeedback[root] : 0;
                    for (let ch = 0; ch < out.length; ch++) {
                        const src = feedbackChannel(ch);
                        let shifted = clamp(exact + offsets[ch], 0, i - 1);
                        const delayed = previous[src][exact] * (1 - texture) + previous[src][shifted] * texture;
                        lp[ch] += alpha * (delayed - lp[ch]);
                        const v = feedback * lp[ch];
                        current[ch][i] = v;
                        out[ch][i] += v;
                        active = active || Math.abs(v) > 1e-12;
                    }
                }
            }
            previous = current;
            if (!active) break;
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

        return buffer; // Returns the raw ArrayBuffer, transferable
    };

    // Linked symmetric mode renders two complete one-direction engines, then
    // aligns them on one global timeline. This keeps feedback, scatter and
    // Caesura provenance exact in each direction while sharing one control set.
    if (temporalStance === 'symmetric' && timeMagnitude > 1e-9) {
        const directionalData = {
            ...data,
            sourceDry: false,
            monitorControl: false,
            _returnPcm: true,
        };
        const anticipation = performBounceRender({
            ...directionalData,
            params: { ...inputParams, time: timeMagnitude, mix: 1 },
            temporalStance: 'anticipation',
        });
        const wake = performBounceRender({
            ...directionalData,
            params: { ...inputParams, time: timeMagnitude, mix: 1 },
            temporalStance: 'wake',
        });
        const start = Math.min(anticipation.start, wake.start);
        const end = Math.max(anticipation.start + anticipation.duration, wake.start + wake.duration);
        const sampleRate = controlSampleRate;
        const channels = Math.max(2, sourceBuffer.numberOfChannels, controlBuffer.numberOfChannels);
        const length = Math.max(1, Math.ceil((end - start) * sampleRate));
        const wet = Array.from({ length: channels }, () => new Float32Array(length));
        const antGain = Math.cos(temporalBalance * 0.5 * Math.PI);
        const wakeGain = Math.sin(temporalBalance * 0.5 * Math.PI);
        const addPass = (pass, gain) => {
            const offset = Math.round((pass.start - start) * sampleRate);
            for (let ch = 0; ch < channels; ch++) {
                const input = pass.pcmChannels[Math.min(ch, pass.pcmChannels.length - 1)];
                for (let i = 0; i < input.length && offset + i < length; i++) wet[ch][offset + i] += input[i] * gain;
            }
        };
        addPass(anticipation, antGain);
        addPass(wake, wakeGain);

        const dryMix = Math.cos(params.mix * 0.5 * Math.PI);
        const wetMix = Math.cos((1 - params.mix) * 0.5 * Math.PI);
        const out = Array.from({ length: channels }, () => new Float32Array(length));
        let peak = 0;
        for (let i = 0; i < length; i++) {
            const globalT = start + i / sampleRate;
            for (let ch = 0; ch < channels; ch++) {
                let dry = 0;
                if (sourceDry) dry += sampleAt(sourceBuffer, ch, globalT, false);
                if (monitorControl) dry += sampleAt(controlBuffer, ch, globalT, false);
                const v = dry * dryMix + wet[ch][i] * wetMix;
                out[ch][i] = v;
                peak = Math.max(peak, Math.abs(v));
            }
        }
        const BOUNCE_PEAK = 0.977;
        const scale = peak > BOUNCE_PEAK ? BOUNCE_PEAK / peak : 1;
        if (scale < 1) for (const channel of out) for (let i = 0; i < channel.length; i++) channel[i] *= scale;
        if (_returnPcm) return { pcmChannels:out, start, duration:length / sampleRate, peak, scale, gapFitEvents:Math.max(anticipation.gapFitEvents, wake.gapFitEvents), duckEvents:Math.max(anticipation.duckEvents, wake.duckEvents), caesuraPolicy, temporalStance, temporalBalance };
        return {
            wavBuffer: encodeFloatWav(out, sampleRate),
            start,
            duration: length / sampleRate,
            peak,
            scale,
            gapFitEvents: Math.max(anticipation.gapFitEvents, wake.gapFitEvents),
            duckEvents: Math.max(anticipation.duckEvents, wake.duckEvents),
            caesuraPolicy,
            temporalStance,
            temporalBalance,
            head: -start,
            tail: Math.max(0, end - controlBuffer.duration),
        };
    }

    // Render loop orchestration
    const sampleRate = controlSampleRate;
    const channels = Math.max(2, sourceBuffer.numberOfChannels, controlBuffer.numberOfChannels);
    const gapPolicy = caesuraPolicy === 'fit' ? buildGapFitPolicy(gapMap, params, loopClip) : null;
    const duckPolicy = caesuraPolicy === 'duck' ? buildDuckPolicy(gapMap, params, loopClip) : null;
    const win = bounceWindow(controlBuffer, params, gapPolicy);
    const length = Math.max(1, Math.ceil(win.duration * sampleRate));
    const dry = Array.from({ length: channels }, () => new Float32Array(length));
    const wetBase = Array.from({ length: channels }, () => new Float32Array(length));
    const seed = bounceSeed(params, gateEnabled, loopClip, windowType, pingPong);
    const rand = mulberry32(seed);

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
        const raw = sidechainRawAtOutputTime(grainT, controlBuffer, params, loopClip, controlRmsEnvelope, sampleRate);
        const env = raw * 4;
        let amp = 0;
        if (gateEnabled) {
            const fire = params.polarity < 0 ? (raw <= params.threshold) : (raw > params.threshold);
            amp = fire ? 1 : 0;
        } else {
            const p = params.polarity;
            const rawAmp = p >= 0 ? 1 - p * (1 - env) : 1 + p * env;
            amp = Math.max(0, rawAmp);
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
                params,
                loopClip,
                pingPong,
                sourceBuffer,
                windowType
            });
        }

        const base = 1 / params.grainDensity;
        const jitter = (rand() - 0.5) * base * params.densityJitter;
        grainT += Math.max(0.001, base + jitter);
        grainIndex++;
    }

    const wet = gapPolicy
        ? renderGapFitFeedback(wetBase, sampleRate, params, pingPong, seed, gapPolicy, win, gapMap, sourceBuffer, loopClip)
        : renderWetFeedback(wetBase, sampleRate, params, pingPong, seed);
    const duckEvents = applyDuckRide(wet, sampleRate, win, duckPolicy);
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

    const BOUNCE_PEAK = 0.977;
    const scale = peak > BOUNCE_PEAK ? BOUNCE_PEAK / peak : 1;
    if (scale < 1) {
        for (const ch of out) {
            for (let i = 0; i < ch.length; i++) ch[i] *= scale;
        }
    }

    if (_returnPcm) return {
        pcmChannels: out,
        start: win.start,
        duration: win.duration,
        peak,
        scale,
        gapFitEvents: gapPolicy ? gapPolicy.events.length : 0,
        duckEvents,
        caesuraPolicy,
        temporalStance,
        temporalBalance,
    };
    const wavArrayBuffer = encodeFloatWav(out, sampleRate);
    return {
        wavBuffer: wavArrayBuffer,
        start: win.start,
        duration: win.duration,
        peak,
        scale,
        gapFitEvents: gapPolicy ? gapPolicy.events.length : 0,
        duckEvents,
        caesuraPolicy,
        temporalStance,
        temporalBalance,
        head: win.head,
        tail: win.tail,
    };
}

// ── Environment routing ───────────────────────────────────────────────────
if (typeof self !== 'undefined' && typeof window === 'undefined') {
    // inside Web Worker
    self.onmessage = function(e) {
        try {
            const result = performBounceRender(e.data);
            self.postMessage(result, [result.wavBuffer]);
        } catch (err) {
            self.postMessage({ error: err.message || String(err) });
        }
    };
} else {
    // inside Main Thread (window) via script tag
    window.performBounceRender = performBounceRender;
}
