# Intro card + recording + end card, with the voiceover mixed in at its timestamps. Also writes captions (SRT).
import json, pathlib, subprocess

HERE = pathlib.Path(__file__).parent
B = HERE / "build"
REC = r"C:\Users\User\Downloads\pinned.mp4"
OUT = r"C:\Users\User\Downloads\pinned-final.mp4"
INTRO, OUTRO, FADE = 6.5, 7.5, 0.5
manifest = json.loads((B / "manifest.json").read_text())

inputs = ["-loop", "1", "-t", str(INTRO), "-i", str(B / "intro.png"),
          "-i", REC,
          "-loop", "1", "-t", str(OUTRO), "-i", str(B / "outro.png")]
for m in manifest:
    inputs += ["-i", m["file"]]

v = (
    f"[0:v]scale=1920:792,fps=30,format=yuv420p,setsar=1,fade=t=in:st=0:d=0.6,fade=t=out:st={INTRO - FADE}:d={FADE}[v0];"
    f"[1:v]scale=1920:792,fps=30,format=yuv420p,setsar=1,fade=t=in:st=0:d={FADE}[v1];"
    f"[2:v]scale=1920:792,fps=30,format=yuv420p,setsar=1,fade=t=in:st=0:d={FADE},fade=t=out:st={OUTRO - 0.8}:d=0.8[v2];"
    "[v0][v1][v2]concat=n=3:v=1:a=0[v]"
)
a_parts, labels = [], []
for k, m in enumerate(manifest):
    ms = int(m["start"] * 1000)
    a_parts.append(f"[{3 + k}:a]aresample=48000,adelay={ms}|{ms}[a{k}]")
    labels.append(f"[a{k}]")
a = ";".join(a_parts) + ";" + "".join(labels) + f"amix=inputs={len(labels)}:normalize=0,volume=1.6,alimiter=limit=0.95[a]"

cmd = ["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", v + ";" + a,
       "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
       "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-shortest", OUT]
subprocess.run(cmd, check=True)


def ts(t):
    h, r = divmod(t, 3600)
    mnt, s = divmod(r, 60)
    return f"{int(h):02d}:{int(mnt):02d}:{s:06.3f}".replace(".", ",")


srt = []
for n, m in enumerate(manifest, 1):
    srt.append(f"{n}\n{ts(m['start'])} --> {ts(m['start'] + m['dur'])}\n{m['text']}\n")
pathlib.Path(OUT).with_suffix(".srt").write_text("\n".join(srt), encoding="utf-8")
print("wrote", OUT)
