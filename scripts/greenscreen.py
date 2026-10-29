#!/usr/bin/env python3
"""Turns a green-screen studio photo into clean cut-outs.

  python3 scripts/greenscreen.py input.jpg outdir/ [--model birefnet-portrait]

Writes outdir/<name>_cutout.png (trimmed full figure), _halfbody.png (waist up) and
_head.png (square head and shoulders), plus _report.json with what it found.

How it works
  1. An AI model finds the person, which removes light stands, the ceiling, the black
     rail above the screen and anything else that isn't green.
  2. A chroma key on the green screen gives clean, soft edges (hair, fingers).
  3. Green spill (the green glow on hair, skin and white kit) is neutralised.
  4. Face detection frames the half-body and head crops consistently for every player.
"""
import argparse, json, os, sys
import cv2
import numpy as np
from PIL import Image, ImageOps
from rembg import new_session, remove

WORK_EDGE = 2200          # long edge used for processing (originals are ~6000 px)
FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def load(path):
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    img.thumbnail((WORK_EDGE, WORK_EDGE), Image.LANCZOS)
    return np.asarray(img).astype(np.float32)


def chroma_alpha(rgb, t0=0.07, t1=0.20):
    """1 = keep, 0 = green screen. Uses green dominance relative to brightness, so the
    darker, shadowed parts of the screen key out as well as the bright parts."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    dominance = (g - np.maximum(r, b)) / (g + 1.0)
    return np.clip(1.0 - (dominance - t0) / (t1 - t0), 0.0, 1.0)


def subject_mask(rgb, session):
    pil = Image.fromarray(rgb.astype(np.uint8))
    m = np.asarray(remove(pil, session=session, only_mask=True)).astype(np.float32) / 255.0
    return m


def combine(rgb, ai, ck):
    h, w = ck.shape
    # Keep chroma-foreground regions that are mostly the person according to the AI mask.
    fg = (ck > 0.5).astype(np.uint8)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    ai_bin = ai > 0.5
    keep = np.zeros_like(fg)
    for i in range(1, n):
        comp = labels == i
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 200:
            continue
        if (ai_bin & comp).sum() / area > 0.3:
            keep |= comp.astype(np.uint8)
    # Allow soft chroma edges a few pixels beyond the kept regions, but never far beyond
    # what the AI thinks is the person (stops a nearby rail or stand sneaking in).
    k = max(3, int(min(h, w) * 0.004))
    keep_soft = cv2.dilate(keep, np.ones((k, k), np.uint8)).astype(np.float32)
    near_person = cv2.dilate(ai_bin.astype(np.uint8), np.ones((k * 8, k * 8), np.uint8)).astype(np.float32)
    alpha = ck * keep_soft * near_person
    # Fill pinholes inside the body (e.g. a green reflection on a watch face).
    solid = cv2.morphologyEx((alpha > 0.5).astype(np.uint8), cv2.MORPH_CLOSE, np.ones((k * 3, k * 3), np.uint8))
    inner = cv2.erode(solid, np.ones((k * 2, k * 2), np.uint8)).astype(bool)
    alpha[inner] = 1.0
    return cv2.GaussianBlur(alpha, (3, 3), 0)


def despill(rgb, alpha):
    """Remove green-screen colour from the subject.
    1. Everywhere: limit green to the brighter of red/blue (kills the green glow on kit and skin).
    2. On soft edges (hair, fingertips): those pixels are a mix of subject and screen, so their
       colour is rebuilt from the solid subject just inside the edge. This removes the
       teal fringe that a plain despill leaves on dark hair."""
    out = rgb.copy()
    r, g, b = out[..., 0], out[..., 1], out[..., 2]
    limit = np.maximum(r, b)
    out[..., 1] = np.where((alpha > 0.01) & (g > limit), limit, g)

    solid = (alpha > 0.97).astype(np.float32)
    k = max(9, int(min(alpha.shape) * 0.012)) | 1
    weight = cv2.GaussianBlur(solid, (k, k), 0)
    fill = np.dstack([cv2.GaussianBlur(out[..., c] * solid, (k, k), 0) for c in range(3)]) / np.maximum(weight, 1e-4)[..., None]
    edge = (alpha > 0.01) & (alpha < 0.97) & (weight > 0.02)
    out[edge] = fill[edge]
    return out


def find_face(rgb, alpha):
    gray = cv2.cvtColor(rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    faces = FACE_CASCADE.detectMultiScale(gray, 1.1, 6, minSize=(int(gray.shape[0] * 0.04),) * 2)
    faces = [f for f in faces if alpha[f[1] + f[3] // 2, f[0] + f[2] // 2] > 0.5]
    if not len(faces):
        return None
    return max(faces, key=lambda f: f[2] * f[3])  # x, y, w, h


def crop(rgba, box):
    h, w = rgba.shape[:2]
    x0, y0, x1, y1 = [int(round(v)) for v in box]
    pad = [max(0, -y0), max(0, y1 - h), max(0, -x0), max(0, x1 - w)]
    region = rgba[max(0, y0):min(h, y1), max(0, x0):min(w, x1)]
    return np.pad(region, ((pad[0], pad[1]), (pad[2], pad[3]), (0, 0)))


def trim(rgba, margin=8):
    ys, xs = np.where(rgba[..., 3] > 12)
    return rgba[max(0, ys.min() - margin): ys.max() + margin, max(0, xs.min() - margin): xs.max() + margin]


def save(arr, path, max_edge=None):
    im = Image.fromarray(arr.astype(np.uint8), "RGBA")
    if max_edge:
        im.thumbnail((max_edge, max_edge), Image.LANCZOS)
    im.save(path, optimize=True)


def process(path, outdir, session):
    name = os.path.splitext(os.path.basename(path))[0]
    rgb = load(path)
    ai = subject_mask(rgb, session)
    ck = chroma_alpha(rgb)
    alpha = combine(rgb, ai, ck)
    clean = despill(rgb, alpha)
    rgba = np.dstack([clean, alpha * 255]).clip(0, 255)
    face = find_face(rgb, alpha)

    report = {"source": os.path.basename(path), "face": None, "outputs": {}}
    os.makedirs(outdir, exist_ok=True)
    full = trim(rgba)
    p = os.path.join(outdir, f"{name}_cutout.png"); save(full, p, 1600); report["outputs"]["cutout"] = p

    if face is not None:
        x, y, w, h = map(int, face)
        report["face"] = {"x": x, "y": y, "w": w, "h": h}
        cx = x + w / 2
        # Head and shoulders: square, face in the upper middle.
        s = h * 2.9
        head = crop(rgba, (cx - s / 2, y - h * 0.75, cx + s / 2, y - h * 0.75 + s))
        p = os.path.join(outdir, f"{name}_head.png"); save(head, p, 600); report["outputs"]["head"] = p
        # Waist up: from above the hair to about 4.6 face-heights below the chin.
        ys, xs = np.where(alpha > 0.05)
        top = max(0, ys.min() - 10)
        bottom = y + h * 5.6
        half = trim(crop(rgba, (xs.min() - 10, top, xs.max() + 10, bottom)))
        p = os.path.join(outdir, f"{name}_halfbody.png"); save(half, p, 1400); report["outputs"]["halfbody"] = p
    else:
        report["warning"] = "No face found: only the full cut-out was made. Check the photo."

    with open(os.path.join(outdir, f"{name}_report.json"), "w") as f:
        json.dump(report, f, indent=2)
    return report


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("inputs", nargs="+")
    ap.add_argument("--out", default="out")
    ap.add_argument("--model", default=os.environ.get("CUTOUT_MODEL", "birefnet-portrait"))
    a = ap.parse_args()
    session = new_session(a.model)
    for i in a.inputs:
        r = process(i, a.out, session)
        print(json.dumps({k: v for k, v in r.items() if k != "outputs"}), file=sys.stderr)
