# Generates the voiceover clips for the demo video and a timing manifest.
# Times are seconds into the FINAL video (6.5 s intro card + original recording + 5 s end card).
import asyncio, json, subprocess, pathlib
import edge_tts

OUT = pathlib.Path(__file__).parent / "build"
OUT.mkdir(exist_ok=True)
VOICE = "en-US-AndrewNeural"
INTRO = 6.5  # intro card length; recording starts here

# (start in ORIGINAL recording seconds, or None for intro/outro absolute time, text)
LINES = [
    ("abs", 0.4, "This is Pinned: a version-aware code reviewer for Sanity, built on Sanity Context."),
    ("rec", 0.5, "Three ordinary lines from a 2024 tutorial: a token, an old apiVersion, no perspective. And your unpublished drafts are live."),
    ("rec", 10.0, "Pinned stores every version boundary as structured content in Sanity. The engine computes findings. The model only explains."),
    ("rec", 18.5, "On the analyze page, each demo op is a real config. The drafts leak: two findings, one critical."),
    ("rec", 26.0, "Every finding shows what happens now, what changes after a bump, and the fix, plus an explanation from a Sanity Context Knowledge Base that cites the entries it read."),
    ("rec", 38.5, "It also catches that previewDrafts was renamed to drafts, cited straight from the docs."),
    ("rec", 50.0, "Here is the version-scoped part. Bump to 2025-02-19 and the default becomes published. The leak stops, but preview code goes blank."),
    ("rec", 61.0, "The fix is concrete: set the perspective explicitly, and give preview its own drafts client with the CDN off."),
    ("rec", 68.6, "The time machine re-pins your code in the browser, so you can watch findings disappear at the boundary."),
    ("rec", 75.5, "Next, a Studio plugin pinned to 2023. useClient can't see Content Releases, release queries return nothing, and the listener misses version changes."),
    ("rec", 89.5, "This is context a plain model misses. In our eval, the model alone flagged this plugin for a drafts leak, but inside Studio, drafts are expected. Pinned's rules only fire when every condition holds."),
    ("rec", 106.0, "On the time machine, bump to 2025-02-19 and the release findings clear."),
    ("rec", 112.6, "The time bomb: an apiVersion computed from new Date. The app changes with every API release, without a deploy."),
    ("rec", 123.5, "Follow-up questions go to the same Knowledge Base. Ask what changes at 2025-02-19, and the answer comes back with cited entries."),
    ("rec", 133.5, "Why was previewDrafts deprecated? It says what the docs actually say, and nothing more."),
    ("rec", 143.5, "And every rule lives in a public Sanity dataset: typed conditions, a boundary, and a verbatim quote from the doc that proves it."),
    ("end", 0.3, "Some contradictions in the docs are just versions. Pinned keeps them apart. Try it at pinned-snowy dot vercel dot app."),
]
REC_LEN = 153.92


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return float(out.stdout.strip())


async def main():
    manifest = []
    for i, (kind, t, text) in enumerate(LINES):
        start = t if kind == "abs" else INTRO + t if kind == "rec" else INTRO + REC_LEN + t
        path = OUT / f"line_{i:02d}.mp3"
        await edge_tts.Communicate(text, VOICE, rate="+4%").save(str(path))
        manifest.append({"i": i, "start": round(start, 2), "dur": round(duration(path), 2), "file": str(path), "text": text})
    # report overlaps
    for a, b in zip(manifest, manifest[1:]):
        gap = b["start"] - (a["start"] + a["dur"])
        flag = "  <-- OVERLAP" if gap < 0.2 else ""
        print(f'{a["i"]:02d} {a["start"]:7.2f}s +{a["dur"]:5.2f}s  gap {gap:5.2f}{flag}')
    last = manifest[-1]
    print(f'{last["i"]:02d} {last["start"]:7.2f}s +{last["dur"]:5.2f}s  ends {last["start"] + last["dur"]:.2f}')
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2))


asyncio.run(main())
