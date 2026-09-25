# GuitarQuest: requirements

A practice app for electric guitar, in the spirit of PianoQuest (137 levels, three modes, finger hints, scoring, progress tracking), adapted to a guitar and to the Enya Inspire in particular.

Version 0.1, 24 September 2026. Written as a specification to build from, not as a finished design.

---

## 1. Why this is not just "PianoQuest with strings"

The piano app has it easy: a MIDI keyboard tells the app exactly which key was pressed, when, and how hard. A guitar does not.

| | PianoQuest | GuitarQuest |
| --- | --- | --- |
| Input | MIDI note numbers, exact and instant | Audio. The app must work out pitch, timing and chord from a waveform |
| Note identity | One key per pitch | The same pitch exists in up to 6 places on the neck |
| Polyphony | Trivial, MIDI sends every note | Hard. Six strings ringing at once, with overtones |
| Timing | Sample accurate | Detection lag, plus audio input latency that has to be measured |
| Wrong-note feedback | Certain | Probabilistic, and the app must not accuse the player wrongly |
| Tuning | Always perfect | Changes during a session, and must be checked before scoring |

Everything below follows from that.

---

## 2. Hardware assumptions (Enya Inspire)

Confirmed from the manufacturer's page: 25.5" scale, 24 frets, SSH pickups, built-in 15W speaker, onboard FX with four presets, Bluetooth 5.0, 3.5 mm headphone out, 6.35 mm instrument out, USB-C described as "OTG recording and charging". No MIDI output, no LED fretboard, no fret sensing.

**The app takes its audio from the guitar over USB-C, not from a microphone.** That is a design decision, not a preference: a direct signal is clean, loud, free of room noise, free of the app's own sound, and has far lower latency, which is what makes timing scoring honest.

How this works in a browser: there is no way to speak to a USB audio device directly (WebUSB does not cover audio class devices). The guitar appears to the operating system as an **audio input device**, and the app captures it with `getUserMedia` while *selecting that device*. It is the same API the microphone uses, pointed at the guitar instead.

Accepted inputs, all of them direct:

1. **The Inspire's USB-C port**, if it enumerates as a USB audio input. The default and the one to design for.
2. **The 6.35 mm instrument out or the 3.5 mm headphone out into an audio interface** or a line-in adapter, for a computer with no usable USB-C audio, and as the fallback if point 1 does not work.

Not supported:

- **The built-in microphone.** Detection through a microphone is noisier, slower and picks up the app's own playback. The app must not score a run captured from a microphone.
- **Bluetooth.** Assume it carries audio *into* the guitar, not out of it, and its 100 to 200 ms latency would make timing scoring meaningless.

**REQ-HW-1** Audio comes from a wired, direct input. On first run the app lists the available audio inputs (`enumerateDevices`) and asks the user to choose the guitar, then remembers that device id per profile.
**REQ-HW-2** The app identifies the built-in microphone (by device label and by `deviceId === 'default'` behaviour) and refuses to run scored lessons on it. It may allow the tuner and a free-play mode on a microphone, clearly marked "not for scoring".
**REQ-HW-3** All browser voice processing must be switched off in the capture constraints: `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`, and a sample rate of 44.1 or 48 kHz. Those features are built for speech and destroy pitch accuracy.
**REQ-HW-4** If the chosen device disappears (cable pulled, guitar switched off), pause the lesson, say which device was lost, and offer the picker again rather than scoring silence as missed notes.
**REQ-HW-5** Never assume MIDI. Any MIDI support (for a future guitar-to-MIDI pickup) is an optional extra path, not the foundation.
**REQ-HW-6** The onboard FX presets change the signal a lot. Lessons ask for the clean preset, and detection must still work under mild overdrive.
**REQ-HW-7** Because the signal is taken before the guitar's speaker, the app should provide its own monitoring: pass the input through to the output with an optional amp-style tone, so the player can hear themselves in headphones plugged into the tablet or computer. Keep that path as short as possible in Web Audio, and let it be switched off for players who monitor from the guitar's own speaker.

## 3. Audio detection requirements

This is the heart of the app. If this part is mediocre, nothing else matters.

**REQ-DET-1 Monophonic pitch detection.** Detect single notes from E2 (82.4 Hz) to at least E6 (1318 Hz, 24th fret on the high E), with accuracy within ±15 cents once the note has settled. Use a time-domain algorithm suited to low pitches, such as YIN or the McLeod pitch method, running in an AudioWorklet rather than on the main thread.

**REQ-DET-2 Onset detection.** Detect the attack of a note or strum within 30 ms, using spectral flux or an envelope follower, independently of pitch. Rhythm scoring uses onsets; pitch scoring uses the pitch a few milliseconds later.

**REQ-DET-3 Detection latency budget.** From string pluck to the note registering on screen: 60 ms or less on the direct input. Measure it and report it; do not guess it.

**REQ-DET-4 Latency calibration.** A one-minute setup step where the user plays along with a click, so the app measures the constant offset between the app's clock and the audio arriving. Subtract it before scoring timing. Offer to redo it when the input device changes.

**REQ-DET-5 Chord recognition.** For strummed chords, do not attempt to identify each string. Compute a chroma vector (a 12-bin pitch-class profile from a constant-Q or FFT analysis) over the 150 ms after an onset and match it against the expected chord's template. Report a match confidence, not a binary right or wrong.

**REQ-DET-6 Confidence and doubt.** Every detection carries a confidence value. Below a threshold the app says "I didn't hear that clearly" rather than marking a mistake. A practice app that accuses a learner of playing a wrong note when they played the right one is worse than one that occasionally misses a mistake.

**REQ-DET-7 Level handling.** A noise gate with an automatic floor from a two-second silent sample at the start of a session, mostly to ignore string buzz and handling noise. An input level meter with a clipping warning, since a hot pickup into a line input clips easily. When the signal is too quiet or clipped, say so instead of failing silently.

**REQ-DET-8 No bleed by design.** A direct input hears only the guitar, so the metronome and backing tracks cannot be mistaken for playing. This is one of the main reasons for the USB-C rule, and it means the app can play backing tracks out loud without any echo handling.

**REQ-DET-9 Tuning check.** A built-in tuner (per string, with a cents display and a reference pitch setting) that must pass before a scored lesson starts. Re-check automatically if detected pitches drift consistently sharp or flat, which is the classic sign of a string going out of tune mid-session, and offer to re-tune rather than scoring a whole run as wrong.

**REQ-DET-10 Techniques (phase 2).** Continuous pitch tracking to recognise bends (and how close the bend got to the target pitch), slides, vibrato, hammer-ons and pull-offs (onset with no new pick attack), and palm mutes (short, damped spectrum).

---

## 4. The string and fret problem

The app hears a pitch. It cannot hear *where* you fretted it. A4 at 440 Hz can be the 5th fret of the high E, the 10th of the B, the 14th of the G, and so on.

**REQ-POS-1** The lesson always *shows* the intended string and fret. Position is taught, not verified.
**REQ-POS-2** Scoring is based on pitch and timing. Playing the right pitch in the wrong position is counted as correct, with a gentle note when the app can tell (see below).
**REQ-POS-3** Where the app can tell, it should say so: an open string has a recognisable long sustain and harmonic profile compared with the same pitch fretted, and a pitch outside the range of the taught position can only have come from elsewhere. Use these as hints ("that sounded like the open B, the lesson wants the 4th fret of the G"), never as penalties.
**REQ-POS-4** A "position lock" practice option: the lesson stays inside one position (for example frets 5 to 8), so the player learns the shape rather than hunting for pitches.

---

## 5. Functional requirements

### 5.1 Learning content

**REQ-FN-1** A structured curriculum of at least 120 levels in units, each level small enough to finish in two or three minutes. Suggested units:

1. **Getting started:** parts of the guitar, tuning, holding a pick, the names of the open strings, one string at a time.
2. **First notes:** frets 0 to 3 on the low strings, then the high strings, then across all six.
3. **Rhythm and picking:** downstrokes, alternate picking, eighth notes, rests, counting.
4. **Power chords:** two-finger shapes, moving them up the neck, palm muting.
5. **Open chords:** E, A, D, G, C, Em, Am, Dm, changes between them, common progressions.
6. **Strumming patterns:** from all-downs to syncopated patterns, with a chord chart.
7. **The minor pentatonic:** box 1, then boxes 2 to 5, then joining them.
8. **Riffs:** original riffs in each style, built from the shapes just learned.
9. **Barre chords:** E shape, A shape, the F barre, progressions that need them.
10. **Major scale and CAGED:** shapes, then playing through changes.
11. **Techniques:** hammer-ons, pull-offs, slides, bends, vibrato, string skipping.
12. **Speed and accuracy:** metronome ladders that raise the tempo as accuracy holds.
13. **Reading:** tablature, then standard notation, then sight-reading fresh material.
14. **Songs:** a library of public-domain and original pieces, as in PianoQuest.

**REQ-FN-2** Three modes, as in the piano app:
- **Beginner:** the piece waits for each note or chord. No timing pressure. The next note is shown on the fretboard with the finger number.
- **Intermediate:** in time, with a generous timing window, fretboard and tab both visible.
- **Advanced:** full tempo, tight window, tab or notation only, no fretboard highlighting.

**REQ-FN-3** A practice lock, as in the piano app: hold on the current note or chord until it is played, switchable mid-piece.

**REQ-FN-4** A song library with categories (rock, blues, folk, classical arrangements, originals), difficulty tags, and a riff-only or full-song choice. Content must be traditional, public domain, or written for the app. Tablature of a copyrighted song is a derivative work; do not ship it.

**REQ-FN-5** Backing tracks and a metronome, with independent volume, and a count-in.

**REQ-FN-6** Loop a section (choose bars, loop, and raise the tempo each time it is played cleanly). This is the single most useful practice feature a guitar app can have.

### 5.2 Display

**REQ-UI-1 Fretboard view.** A horizontal fretboard, 6 strings by up to 24 frets, with the notes to play shown as markers with finger numbers, coloured by finger. Must be readable from playing distance (the piano app learned this the hard way: a display size setting, not a fixed size).

**REQ-UI-2 Falling notes.** A Rocksmith-style highway where notes approach the fretboard, one lane per string, labelled with the fret number.

**REQ-UI-3 Tablature.** Scrolling six-line tab with a playhead, rhythm marks, and technique symbols (h, p, /, \, b, PM).

**REQ-UI-4 Standard notation** as an optional second stave, for the reading unit.

**REQ-UI-5 Chord diagrams.** A large chord box with finger numbers, muted and open string marks, and the barre drawn when needed, shown at least two beats before the change.

**REQ-UI-6 Live feedback.** The note the app heard, in note name and as a position on the fretboard, plus how far off the pitch was in cents and the timing in milliseconds. Same "how close were you" meter as the piano app.

**REQ-UI-7 Left-handed mode** that mirrors the fretboard and the diagrams.

**REQ-UI-8 Alternative tunings and capo.** Standard, drop D, half-step down, open G, DADGAD, plus a capo position. Everything the app shows and expects shifts accordingly.

### 5.3 Scoring and progress

**REQ-SC-1** Per note: pitch correct, timing error in milliseconds, and (for chords) a chord match confidence. Score as in the piano app: up to 100 points per note, wrong notes cost points, 60 percent passes, 80 and 95 for the second and third star.
**REQ-SC-2** Do not penalise a note the app heard with low confidence. Count it as "unclear" and report the count separately; if more than a fifth of a run is unclear, tell the user the input needs attention rather than showing a bad score.
**REQ-SC-3** Track, per profile: levels passed, stars, accuracy, practice minutes, day streak, score history, and the notes, chords and changes most often missed. Chord-change speed is worth tracking on its own (time between the last note of one chord and the first clean note of the next).
**REQ-SC-4** Multiple profiles, all data local, export and import.

### 5.4 Platform

**REQ-PF-1** A browser app, installable as a PWA, offline capable, exactly as the piano app is. Audio capture works in Safari on iPad, unlike Web MIDI, so an iPad can be a first-class device here. Confirm early that an iPad accepts the guitar as a USB-C audio input and that Safari lists it in the device picker; on Android, USB audio input support in Chrome is patchy and needs testing on the actual tablet.
**REQ-PF-2** Landscape tablet layout as the primary design target: a tablet on a stand in front of you while you play.
**REQ-PF-3** Hands-free control, since a guitarist cannot reach the screen: a footswitch (many are USB HID and appear as key presses), voice commands ("next", "again", "slower"), or an auto-advance option that moves on after a clean run. The piano app's numbered-button scheme is the model, but the hardware is a pedal, not a fader button.
**REQ-PF-4** Audio worklet processing must keep the main thread free enough for 60 fps rendering on a five-year-old tablet.

---

## 6. Non-functional requirements

**REQ-NF-1 Accuracy targets**, measured against a recorded test set, not by feel:
- Single clean notes on the direct input: at least 98 percent correctly identified, no more than 1 percent false "wrong note" reports.
- The same with the guitar's Crunch preset: at least 95 percent.
- Open chords: at least 90 percent correctly matched, with confidence reported.
- Onset timing: within 20 ms of a reference, after calibration.

**REQ-NF-2 Latency:** as in REQ-DET-3, and the app displays its measured latency so the user can tell whether their setup is the problem.

**REQ-NF-3 Startup:** under two seconds from tap to playable, offline.

**REQ-NF-4 Privacy:** audio is analysed on the device and never uploaded. Say this plainly in the app, because asking for microphone access invites the question.

**REQ-NF-5 No build step, no framework dependency**, as in the piano app: plain HTML, CSS and JavaScript, so it stays hackable and has no toolchain to rot.

**REQ-NF-6 Content licensing:** every piece is traditional, public domain, or original to the app, with its origin shown on the card.

---

## 7. Suggested build order

**Phase 0, one evening: prove the input works.** A single page that lists the audio inputs, opens the guitar over USB-C with voice processing switched off, shows the level meter, runs pitch detection and prints the note. Measure the latency. Repeat on the iPad. **Everything else depends on what this tells you**, so do not write a curriculum before this works.

**Phase 1, the MVP:** tuner, fretboard display, single-note lessons on one string, then across the neck, Beginner and Intermediate modes, scoring, one profile, 20 levels.

**Phase 2:** chords, chord diagrams, strumming with onset-only scoring, the loop trainer, the full curriculum, the PWA shell.

**Phase 3:** techniques (bends, slides, hammer-ons), tab and notation reading, the song library, backing tracks, alternative tunings, footswitch control.

---

## 8. Risks and open questions

1. **Does the Enya Inspire present itself as a USB audio device?** This is now a blocking prerequisite, not a nicety. Plug it into the Mac and look in System Settings > Sound > Input, then check that a browser lists it in `navigator.mediaDevices.enumerateDevices()`. If it does not appear, the app needs the headphone or instrument out into an interface instead, and the USB-C port is only for charging.
2. **Polyphonic accuracy is the hard limit of this app.** Chroma matching recognises "that was an A minor" reliably; it will not tell you that you muted the fourth string. Set expectations in the UI rather than promising per-string accuracy.
3. **Distortion and effects smear the spectrum.** Decide early whether lessons require a clean preset, and test detection with the Inspire's Crunch preset to see how far it degrades.
4. **Monitoring.** With the signal going to the app over USB, decide where the player hears themselves: the guitar's own speaker (simplest), or headphones on the tablet with the app passing the input through (better with backing tracks, but adds the app's output latency to what you hear).
5. **Timing fairness.** A guitarist's note takes time to speak, especially on the low E. The timing window must be wider than the piano app's, and may need to be pitch dependent.
6. **Latency drift** on tablets after backgrounding and resuming. Re-measure when the page becomes visible again.
7. **Scope.** The piano app's 137 levels were achievable because the content is text notation that generates itself. Guitar content is heavier (string, fret, finger, technique per note). Design the notation format first, and make it terse.

---

## 9. What to reuse from PianoQuest

The whole shell transfers: profiles and local storage, the three modes, the practice lock, stars and scoring, the progress page with weak-spot tracking, the display-size setting, the PWA and service worker, the song library structure, and the level-and-unit data model. Roughly the parts in `store.js`, `app.js`, `pwa.js` and the curriculum structure.

What has to be written from scratch: direct audio input and pitch detection (replacing `midi.js`), the fretboard and tab rendering (replacing the keyboard and stave renderers), the guitar-specific scoring rules, and the entire content library.
