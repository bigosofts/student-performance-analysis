import os
import re
import urllib.parse
import urllib.request
from pathlib import Path

base = Path(r'f:/Commercial Project/game')
fonts_dir = base / 'assets' / 'fonts'
vendor_dir = base / 'assets' / 'vendor'
images_dir = base / 'assets' / 'images'
fonts_dir.mkdir(parents=True, exist_ok=True)
vendor_dir.mkdir(parents=True, exist_ok=True)
images_dir.mkdir(parents=True, exist_ok=True)


def download(url: str, out_path: Path) -> None:
    if out_path.exists():
        return
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    out_path.write_bytes(data)


font_css_urls = [
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&display=swap',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap',
    'https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap',
    'https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700;800;900&display=swap',
]

font_faces = []
for css_url in font_css_urls:
    req = urllib.request.Request(css_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=60) as resp:
        css_text = resp.read().decode('utf-8')

    for match in re.finditer(r"@font-face\s*\{([^}]+)\}", css_text, flags=re.S):
        block = match.group(1)
        family_match = re.search(r"font-family:\s*'([^']+)'", block)
        style_match = re.search(r"font-style:\s*([^;]+)", block)
        weight_match = re.search(r"font-weight:\s*([^;]+)", block)
        src_match = re.search(r"src:\s*url\(([^)]+)\)", block)
        if not (family_match and style_match and weight_match and src_match):
            continue
        family = family_match.group(1)
        style = style_match.group(1).strip()
        weight = weight_match.group(1).strip()
        remote_url = src_match.group(1).strip()
        parsed = urllib.parse.urlparse(remote_url)
        filename = Path(parsed.path).name
        local_path = fonts_dir / filename
        if not local_path.exists():
            download(remote_url, local_path)
        font_faces.append((family, style, weight, filename))

# Deduplicate by family/style/weight and keep a single local CSS file.
seen = set()
unique_faces = []
for face in font_faces:
    key = (face[0], face[1], face[2])
    if key not in seen:
        seen.add(key)
        unique_faces.append(face)

lines = []
for family, style, weight, filename in unique_faces:
    safe_family = family.replace("'", "\\'")
    lines.append(
        f"@font-face {{\n"
        f"  font-family: '{safe_family}';\n"
        f"  font-style: {style};\n"
        f"  font-weight: {weight};\n"
        f"  src: url('./{filename}') format('woff2');\n"
        f"  font-display: swap;\n"
        f"}}"
    )

(base / 'assets' / 'fonts' / 'local-fonts.css').write_text('\n\n'.join(lines), encoding='utf-8')

# Download vendor assets.
vendor_urls = {
    'assets/vendor/lucide.min.js': 'https://unpkg.com/lucide@latest/dist/umd/lucide.js',
    'assets/vendor/fabric.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js',
    'assets/vendor/three.module.js': 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js',
}
for rel_path, url in vendor_urls.items():
    out_path = base / rel_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if not out_path.exists():
        download(url, out_path)

image_urls = [
    ('assets/images/blue-team.png', 'https://via.placeholder.com/150/1e3a8a/ffffff?text=Blue+Team'),
    ('assets/images/red-team.png', 'https://via.placeholder.com/150/831843/ffffff?text=Red+Team'),
]
for rel_path, url in image_urls:
    out_path = base / rel_path
    if not out_path.exists():
        download(url, out_path)

print('Downloaded local assets successfully')
