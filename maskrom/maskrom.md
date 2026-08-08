# MASKROM

*a 1978 speech coder given the input it never had · HINDCASTS / audio*

**specced 2026-08-09. Nothing built. Supersedes the penciled Lloyd–Max Quantizer member — see placement.**

---

## one line

Speak & Spell says *say it* and then cannot hear you. It has no microphone: a teaching machine that instructs a child to speak and is constitutionally incapable of listening. MASKROM is that machine with an input finally attached, and the only thing it can do with what it hears is round it into the shapes of its own mouth.

---

## thesis — the analysis half was always offline

The toy was not a live vocoder. It was a playback device for LPC coefficient frames baked into a mask ROM. The analysis happened at TI, offline, over whole words, on equipment that could not have fit in the case, let alone run inside the frame clock. Only synthesis was realtime.

So a live plugin that "works the way the Speak & Spell did" keeps the playback half and discards the half that made the voice sound like that. The Speak & Spell is already a hindcast. Its realtime imitators are the causal degradation of it.

**The haunting is in the codebooks, not the bit depth.** The chip sends roughly fifty bits per frame, and the ten reflection coefficients in that frame are not values — they are *indices into fixed tables*. Those tables were fit, by an optimal-quantizer procedure, to the reflection-coefficient distribution of one speaker recorded in 1978. They were then etched at fabrication and could never be rewritten.

The ghost is therefore not a sample. **The ghost is a quantizer.** Anything fed to the part gets rounded to the nearest available shape of a stranger's vocal tract. This is the suite's quantization thesis in its least metaphorical form to date: a contingent fit, naturalized into a grid, where the grid is a mouth. Sounder made the same argument about level and Lloyd–Max was penciled to make it about sample values; this member makes it about articulation, which is the version that carries an actual voice.

Superpowers drawn on at MVP: **global statistics**. In the deferred wing: **whole-signal optimization + precognition**.

---

## the part — reference, and what must be verified before building

The sound is in the specifics. Generic "lo-fi speech" emulation gets none of the following, and three of these items are load-bearing.

**Frame format (TMS5100 family, as used in the 1978 Speak & Spell):**

- 10th-order **lattice** filter over reflection coefficients K1–K10. The lattice topology is not an implementation detail — its rounding and overflow behavior *is* the sound. Do not substitute cascaded biquads.
- ~25 ms frames (40 Hz), each interpolated toward the next in **8 sub-steps**, so coefficients update at roughly 200 Hz. A **repeat** flag suppresses the coefficient update and re-runs the previous frame's tract.
- Energy: 4 bits, table lookup. Pitch: 5 bits, table lookup, index 0 meaning unvoiced.
- K bit allocation: 5, 5, 4, 4, 4, 4, 4, 3, 3, 3 — each an index, each table fixed at fabrication.
- 8 kHz output.

**Three details that carry most of the character:**

1. **Unvoiced frames transmit only K1–K4.** Voiced frames carry all ten. This asymmetry is why the toy's vowels are rich and syrupy while its consonants are thin and characterless, and it is almost never modelled. It is free to implement and it is roughly half the voice.
2. **Voiced excitation is a stored chirp, not an oscillator** — a short table (~51 samples on this family) holding one recorded glottal pulse, replayed for every voiced frame the part ever spoke. Unvoiced excitation is an LFSR. There is no saw and no square anywhere in the device; that substitution belongs to the modern plugins.
3. **The lattice overflows rather than saturating.** Fixed-point arithmetic of the period wraps when coefficients push it past range, which is the origin of the scream heard from bent units. This is a numerical artifact, not a distortion stage, and a clipper cannot approximate it. Model the wraparound and expose it; do not guard against it.

**Also period-load-bearing:** the 5-bit pitch table is 32 non-uniformly spaced values — an unevenly tempered 32-note scale, and the reason the intonation sits where it does. Retuning arbitrary material into it is a real operation, and it connects to the penciled *intonation-as-distribution* entry in `../hindcasts.md`.

**Verify before building.** The following are asserted here from general knowledge of the part and must be confirmed against documentation — MAME's TMS5110 core and the Sean Riddle / Lord Nightmare reverse-engineering work are the usable sources, along with the TMS5220 datasheet appendix for the later sibling:

- exact codebook values for energy, pitch, and K1–K10 (these must be *taken*, never guessed — a plausible-looking table would defeat the whole thesis, which is that these specific numbers are a specific person)
- the exact frame bit total and field order for the TMS5100 specifically, which differs in detail from the better-documented TMS5220
- the chirp table contents and length for this family member
- the interpolation coefficient sequence across the 8 sub-steps
- the output DAC's nonlinearity
- the exact overflow/wrap width and where in the lattice it bites

**One decision to make before the tables land:** whether to ship TI's actual codebooks. They have been published for decades in emulator source and datasheet material and are widely reproduced, which is a reason to think it is fine but not a finding. If the answer turns out to be no, the fallback is the fitted-from-your-own-file codebook in the deferred wing, which changes the argument (it becomes *a* mask ROM rather than *the* mask ROM) without killing the tool.

**Not asserted here, and not needed:** who the 1978 speaker was. The claim the tool makes does not require a name and should not invent one.

---

## the object

MASKROM presents as a unit, not as a plugin. The atmosphere lives in the object; the copy stays flat.

- **Red 14-segment VFD**, nine digits. Membrane keypad, raised plastic, the orange/yellow/blue colorway.
- **The display spells what it thinks you said.** It cannot know — so it shows the nearest entry in its current vocabulary. It mishears the input into its own word list, on screen, in segments, as the file plays. This is the interface's best available job: a nearest-neighbour lookup in coefficient space, rendered as spelling.
- **Loading an audio file is inserting an Expansion Module.** That was the slot's actual name. A second file loaded as a donor is a second module.
- **Controls are the unit's controls.** Mode names come from the toy rather than from DSP: `SPELL IT`, `SAY IT`, `MYSTERY WORD`, `SECRET CODE`, plus `GO`, `REPEAT`, `ERASE`. Each is bound to a stance, listed under controls below. *(Confirm the exact original mode set against a manual before committing labels; the four above are the ones I am reasonably confident sat on the 1978 unit.)*

Interface copy follows the flattest register in `../../WRITING_VOICE_AGENT.md`: state what the control changes and what will happen, one instruction per sentence. The unit supplies the atmosphere. No control label editorialises about ghosts.

---

## the vocabulary ROM (the acausal asset — MVP scope)

One acausal move at MVP, because it *is* the hauntology rather than an addition to it.

MASKROM reads the whole file before it emits anything, and from it **mask-programs its own vocabulary**: a small, fixed list of coefficient-frame sequences — words, in the device's sense — fitted to that material at the moment of import. Thereafter those are the only things it can ever say. Everything that follows is assembled from that list: the machine hears the file, finds the nearest entry, and speaks the entry.

- Vocabulary size is a control, small by default. A short list is the point; a large one degenerates toward transparent resynthesis, which is the failure mode.
- Entries are selected over the whole file (a clustering pass in coefficient space), so they are *representative* rather than first-come. A running estimate cannot do this — the vocabulary would be fixed by whatever happened to arrive first.
- The list is fixed once written. Re-importing re-fabricates the part.

A machine that learns a handful of words from a recording and is then stuck with them permanently. This is the difference between an emulation of a Speak & Spell and a Speak & Spell that was manufactured about the person who fed it.

---

## the bends

The object's canonical afterlife is the bent one, so bending belongs inside the instrument rather than bolted to it. Each is a distinct mechanism, not a preset on one control.

- **Address bridging.** Shorting the voice-ROM address lines lands the phrase pointer mid-word and the unit speaks from the middle of a different utterance. Here: the frame-read pointer jumps to a wrong offset. **This is where acausality quietly enters the bend** — the destination can be chosen by whole-file search (nearest, or furthest, in coefficient space) rather than landing at random. The bend that has read the ROM.
- **Clock starving.** Frame clock down. The tract drawls while pitch tracks separately — not a pitch shift, and the distinction is the whole reason to model it. This is the reel's "how fast it updates" control, correctly grounded.
- **Overflow.** The wraparound scream on a fader, per the part notes above.
- **Brownout.** Supply sag: energy floor collapses, pitch flattens and drops, then the stream goes to garbage. Dying batteries as an envelope.
- **Half-seated module.** Intermittent contact on the loaded file — frames drop, the repeat flag sticks.

---

## controls

Mode (the four keypad stances):

- **SPELL IT** — the plain pass. Analyse, quantise through the inherited codebooks, resynthesise. The reference sound.
- **SAY IT** — vocabulary mode. Input is replaced by nearest entries from the vocabulary ROM built at import. The MVP's flagship.
- **MYSTERY WORD** — vocabulary mode with the match deliberately wrong: the *furthest* entry rather than the nearest, or the second-best. Same machinery, inverted objective, in the suite's habit.
- **SECRET CODE** — output the coefficient stream itself rather than audio: frames as text, as a written ROM listing. The discarded intermediate exposed, which is standard practice in this folder.

Voice:

- **Vocabulary size** (integer, small default) — how many entries the ROM is fabricated with.
- **Frame rate** (nominal 40 Hz, downward) — the clock-starve control.
- **Interpolation** (on / off / sub-step count) — how far the tract glides between frames. Off is the stepped, blocky reading; full is the toy's characteristic legato.
- **Unvoiced detail** (K4 … K10) — how many coefficients survive on unvoiced frames. Period-correct at K4. Raising it is the anachronism control: consonants that the part could not have had.
- **Overflow** (0–100%) — headroom before the lattice wraps.
- **Brownout** (0–100%) — supply sag depth.
- **Pitch source** — tracked from input, or quantised to the 32-entry table, or flat.

Output:

- Dry/wet, output gain, and a WAV bounce. 8 kHz internally, resampled on export.

---

## construction

**MVP.** Single self-contained `maskrom/index.html`, in the folder's static idiom. Chain: decode → 8 kHz mono → whole-file LPC-10 analysis (autocorrelation → Levinson-Durbin → reflection coefficients) → frame quantisation through the inherited tables → vocabulary clustering pass → mode-dependent frame stream → lattice synthesis with period-correct interpolation, chirp/LFSR excitation, and modelled overflow → offline render → playback + WAV export.

Nothing streams, so the analysis pass is free to be slow and exact. The synthesis side should be written against the frame format rather than against a general LPC resynthesiser, because the constraints (10 poles, 8 sub-steps, K1–K4 unvoiced, wrap-not-clip) are the deliverable.

**Verification plan** — the folder's standard is that a member's log says what was tested and how, so this is what would count:

1. Round-trip a spoken phrase at full precision with quantisation disabled. It should be intelligible and dull. If it is not intelligible, the analysis is wrong and nothing downstream is meaningful.
2. Enable the inherited codebooks. The reference target is a known Speak & Spell recording; the test is whether the resynthesis lands in the same timbral territory, judged by ear and by long-term average spectrum.
3. Confirm the unvoiced K1–K4 restriction is audible as thin consonants against a build with all ten. If it is not, the restriction is implemented in the wrong place.
4. Confirm overflow wraps rather than saturating, by driving it deliberately and checking the waveform for wraparound discontinuities rather than flat tops.
5. Confirm the vocabulary ROM is fixed: the same import must produce the same list, and a mid-file passage must be spoken from entries derived from the whole file rather than from its own neighbourhood.

**The riskiest claim, and therefore the first thing to test:** that a vocabulary of a dozen entries fitted to arbitrary material produces something that reads as *speech from a small machine* rather than as granular mush. If it reads as mush, the fault is likely to be that entries are too short — the fix is entries at word rather than frame scale, which means the clustering must run over segments, not frames.

---

## deferred

Everything below was worked out alongside the MVP and is deliberately held back. Listed so the next agent does not re-derive it.

**Codebook stances** (the full Lloyd–Max argument, which is why this member supersedes that one):

- **INHERITED** — TI's tables. *This is the MVP; the others are the wing.*
- **FITTED** — solve the optimal codebook over the whole file: equal-population bins in coefficient space, minimum distortion at the same bit budget. Speak & Spell timbre, the input's own dictionary. The "what if the part had been fabricated about you" fork.
- **PERVERSE** — bins placed to maximise distance from the material's actual distribution. Maximum-character quantisation; the suite's standard inversion.
- **DONOR** — fit the codebook to file B, apply it to file A. Pythia's control/source dual input rotated into vocal-tract space: dictionary transfer, not timbre transfer.

**Frame path, not frames.** A live coder quantises each frame greedily and independently, but the part interpolates, so the audible object is the path rather than the vertices. Choose the whole sequence by Viterbi over the file with a transition cost, then expose the objective: minimise spectral error (clean), minimise path length (the tract moves as little as it can — extreme legato), or maximise it (burble). Proteus has the Viterbi machinery for MATCHMAKE; reuse rather than rebuild.

**Bit budget as whole-file allocation.** The part ran at roughly 1200 bit/s because the ROM was small. Knowing the whole file, spend precision where it matters — or draw the bit-rate curve by hand over the waveform so the voice degrades where the user decides. The TaboTa inscription argument, applied to a coder.

**Anticipatory voicing.** The voiced/unvoiced flip is the ugliest artifact in live LPC because it is a hard binary decided on a running guess, and it is what makes causal vocoders click at consonant boundaries. Offline: segment voicing over the whole file. Then break it deliberately — **pre-voice**, starting the glottal train before the onset it belongs to, which is Metachamber's ANTICIPATION arrow moved inside the excitation. Or run excitation backward while the filter runs forward: the tract moves forward through the word, the breath reads it from the end.

**Excitation by global search.** Any file as excitation, sliced to a ~6 ms one-shot; then choose per frame by searching the whole donor for the pulse best (or worst) fitting the residual. Excitation as library rather than timeline — Proteus MATCHMAKE in the excitation slot. And the one with no precedent: **self-excitation at a signed offset**, the tract at *t* driven by the residual at *t+Δ*. Remanence prints amplitude backward and Proteus ORACLE prints timbre backward; this prints breath backward.

**The residual as second output.** Live LPC discards it because it has nowhere to put it. Expose it, invert it, or granulate it into the negative space.

**Adaptive frame grid.** Frame boundaries placed where the events are rather than on a fixed clock, solved against the whole file's onset structure — Groove Lloyd–Max from the control-streams ledger, rotated into analysis frames. Or, perversely, a grid inherited from another file's onsets.

**Retune-into-the-part.** The 32-entry pitch table as a destination tuning for arbitrary material.

---

## placement

**Why Hindcasts, not elsewhere.** The member's whole claim is that the analysis half of the original was offline and its imitators dropped it. That is the suite's thesis with a voice attached.

**Supersedes the penciled Lloyd–Max Quantizer.** That entry has sat at next-move #3 since July framed as "a bitcrusher that has read the entire file," which is a weak frame for a strong idea: as a bitcrusher it is a demo, and as a speech coder it is an instrument. The optimal/inverted-bin argument survives intact in the deferred codebook stances above. `../hindcasts.md` has been amended to point the Lloyd–Max entry here rather than deleting it, since the sample-value version remains a legitimate separate build if anyone wants it.

**Relation to `glossolalia-*.html`** (in `xyhtamura.github.io/`): no overlap, and the line is clean. Those pages are **parallel formant synthesis, text in, nothing listening** — the SAM lineage, software on a 6502, American home computer, 1982. MASKROM is **LPC analysis, audio in, a coder rather than a synthesiser** — the TI silicon lineage, hardware lattice, toy, 1978. Different circuits, different social objects. Glossolalia speaks without hearing; MASKROM can only hear. If the pair ever wants a family name, **Echolalia** is the sibling term and is held on the shelf below.

**Relation to `mouthkit/`:** mouthkit is sample-domain phoneme chopping. No shared code is proposed. If a phoneme/allophone member ever gets built — the SP0256-AL2 and Votrax SC-01 lineage, which is a genuinely different device class from this one — it belongs nearer mouthkit than here.

**Vocoding is explicitly out of scope**, by decision on 2026-08-09. Carrier/modulator vocoding, MIDI-driven excitation, and the Daft Punk case are a different app if they happen at all. This member is a speech coder, not a vocoder, and the distinction is the reason it has a thesis.

**No `DEPENDENCIES.md` entry yet** — nothing shared is created here. If the Viterbi path work later reuses Proteus's machinery, or excitation search reuses its MATCHMAKE, that becomes a real dependency and gets logged then.

---

## open questions

- **The AAC lineage — decide before writing any public copy.** The same period speech silicon went two places: children's toys, and voice prostheses (the Phonic Mirror HandiVoice, the Votrax parts in early augmentative communication devices). Same part, two social destinations, and in both cases the voice belongs to a stranger. This braids directly into the position section of `../hindcasts.md`, which already carries the Kafer/Puar citation trail and is careful about disability-as-metaphor. It is the strongest reason this member is more than pastiche and it is also the easiest thing here to handle badly. **Open: whether it is load-bearing in the writing or stays unstated background.** Not decided by this spec, on purpose — it is an editorial call, and discovering the answer while drafting interface copy is the wrong order.
- Whether TI's codebooks ship (see the part notes).
- Whether vocabulary entries cluster at frame or segment scale — flagged under construction as the likely first failure.
- Whether the display's nearest-entry lookup should show real English words (requiring a word list the tool does not otherwise need) or the segment labels of its own vocabulary. The second is honest; the first is the toy.

---

## naming

**MASKROM** — chosen 2026-08-09. A mask ROM is a memory whose contents are etched at fabrication and can never be rewritten: decided once, at the factory, and fixed for the life of the part. That is precisely what the inherited codebooks are. It is a real period component class rather than an invented word, it sits in the suite's cold single-word register alongside Pythia, Proteus, Remanence, and Sounder, and *death mask* is available without being said. It also puns on masking, which already carries a specific meaning one folder over in Metachamber.

Shelf, in case of second thoughts:

- **SPEAK & RECALL** — a fake sibling in the TI product line, playing the false-memory card, with *recall* carrying both memory and product recall — a toy withdrawn from sale. Strongest on the toy-electronics register and the one that breaks the suite's naming convention hardest. Sits close enough to a live Texas Instruments mark that it would need a deliberate decision.
- **ECHOLALIA** — the clinical sibling of glossolalia: compulsive repetition of another's speech, and the term used of language acquisition. Conceptually the most accurate name for what an inherited codebook does. Weakest on the circuit register, and the near-rhyme with the existing project could read as family or as confusion.
- **EXPANSION MODULE** — the cartridge's actual name; an effect that is a cartridge for a machine that no longer exists.

---

## status

**Specced, not built.** No code exists. Everything in the part notes is asserted from general knowledge and must be checked against documentation before it is implemented; the codebook values in particular must be taken from a source rather than reconstructed.

**Next if this line is picked up:** confirm the frame format and pull the tables, then build the analysis pass and the round-trip test (verification step 1) before anything else. If the round-trip is not intelligible, nothing downstream means anything, and that is the cheapest place for this to fail.

---

## log

**2026-08-09 — Claude Code — specced from scratch; no code.** Wrote this file after a design conversation that started from a plugin demo (Low Poly) and turned on the observation that the Speak & Spell's analysis half was always offline, which makes the toy a hindcast and its realtime imitators the degraded version. Fixed the member's scope at the 1978 TI silicon lineage and explicitly excluded vocoding to a possible later app, at the user's direction. Recorded the three period details that carry the character (unvoiced K1–K4 only, stored chirp rather than an oscillator, lattice overflow that wraps rather than clips), since the second of those corrects the demo that prompted the conversation and the third cannot be faked with a clipper. Held the MVP to one acausal move — the vocabulary ROM fabricated from the whole file at import — and parked the full codebook-stance wing, Viterbi frame path, anticipatory voicing, and excitation search in the deferred section rather than losing them.

Same sitting: `../hindcasts.md` amended — MASKROM added under AUDIO members, the penciled Lloyd–Max Quantizer entry redirected here rather than deleted (the sample-value version stays a legitimate separate build), next-move #3 rewritten, and the member added to the status list as specced-not-built.

Root `ROADMAP.md` deliberately **not** changed. Its hindcasts entry carries only a Mechanism line, still accurate, and a Next in Dev line naming Pythia's Caesura DUCK stance, which this spec does not displace — a spec is a candidate, not a commitment, following the precedent set by the 2026-08-07 filter-wing entry. If MASKROM is picked up for build, that line is the one to change.

Not done, and next if this line is picked up: nothing is verified because nothing is built. The frame format, codebook values, chirp table, interpolation sequence, and overflow width are all asserted here and none has been checked against MAME or the datasheets. Two decisions are open and should be settled before code rather than during it — whether TI's tables ship, and whether the AAC lineage is load-bearing in the writing. The likeliest technical failure is named under construction: vocabulary entries clustered at frame scale will produce mush rather than speech, and the fix is segment-scale clustering.

---

*a memory decided at fabrication, about someone else, and never rewritten.*
