"""Zip what Qollab needs into ../ns-upload.zip."""
import os, zipfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.join(os.path.dirname(root), "ns-upload.zip")
files = ["index.html", "main.js", "main.css", "requirements.txt", "LICENSE", "README.md", "data/atlas.json"]
for d in ("nosig", "ui"):
    for f in sorted(os.listdir(os.path.join(root, d))):
        if f.endswith((".py", ".js")):
            files.append(f"{d}/{f}")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(root, f), f)
print(out, len(files), "files")
