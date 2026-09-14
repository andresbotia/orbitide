"""
Pixel Arcadia raster brand asset generation — PIXEL PAL MASCOT ICON REBUILD.

Previously this script cropped an external approved master photo
(~/Downloads/glowing_pixel_sun_portal.png) into the app icon and drew a
separate abstract "5-block arch + plus-core" vector mark for the
splash/adaptive/favicon assets. This rewrite retires BOTH: every output below
is now the same vector Pixel Pal mascot (`draw_pal`) — the same body language
as the in-game `PixelPalFace` component (rounded-square shell, glossy visor,
side-pod arms, small feet, warm chest-core glow) — so the app icon, splash,
and in-game mascot all read as one character. No external master art file is
required; everything is drawn procedurally with Pillow + numpy.

Outputs (into ./assets):
  icon.png                    1024  opaque   full-bleed app icon (mascot + arcade backdrop)
  adaptive-icon.png           1024  alpha    Android adaptive foreground (mascot only)
  android-icon-foreground.png 1024  alpha    same, kept for existing 3-file config
  android-icon-background.png 1024  opaque   flat brand.bgAlt #120E2A
  android-icon-monochrome.png 1024  alpha    white mascot silhouette
  splash-icon.png             1024  alpha    stacked lockup (mascot + wordmark)
  favicon.png                 64    opaque   mascot badge on #120E2A
  favicon-32.png              32    opaque   mascot badge, simplified
  favicon-16.png              16    opaque   flat core-colour square on #120E2A
  brand/icon-dark.png         1024  opaque   marketing variant, dark backdrop
  brand/icon-light.png        1024  opaque   marketing variant, light-indigo backdrop
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(REPO, "assets")
BRAND = os.path.join(ASSETS, "brand")
os.makedirs(BRAND, exist_ok=True)
FONT = os.path.join(REPO, "node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf")

BG_ALT   = (24, 32, 85)      # #182055  brand.bgAlt
OFFWHITE = (237, 234, 246)   # #EDEAF6  text.primary / PIXEL
PORTAL   = (255, 178, 77)    # #FFB24D  brand.portal / ARCADIA
CORE_FLAT = (255, 201, 77)   # #FFC94D

# Pixel Pal mascot palette — matches the in-game shared-species body language,
# but this is the brand "hero" Pal: an off-white shell (not a gameplay colour)
# with the same warm portal-core glow used across the rest of the brand system.
BODY       = (240, 244, 255)
BODY_SHADE = (206, 214, 240)
RIM        = (108, 118, 224)
RIM_LIGHT  = (176, 184, 255)
VISOR      = (13, 15, 34)
EYE        = (236, 248, 255)
BLUSH      = (255, 158, 196)

SS = 4  # supersample factor for vector drawing


def grad_v(w, h, c0, c1):
    g = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        g.putpixel((0, y), tuple(round(c0[i] + (c1[i] - c0[i]) * t) for i in range(3)))
    return g.resize((w, h))


def radial(size, stops, center=(0.5, 0.5), maxr_frac=0.72):
    """size x size RGB image, radial-blended through `stops` ([(t, (r,g,b)), ...])."""
    px = size
    cx, cy = center[0] * px, center[1] * px
    maxr = maxr_frac * px
    yy, xx = np.mgrid[0:px, 0:px]
    dist = np.clip(np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / maxr, 0, 1)
    out = np.zeros((px, px, 3), np.float32)
    for i in range(len(stops) - 1):
        t0, c0 = stops[i]
        t1, c1 = stops[i + 1]
        m = (dist >= t0) & (dist <= t1)
        lt = (dist[m] - t0) / (t1 - t0)
        for c in range(3):
            out[..., c][m] = c0[c] + (c1[c] - c0[c]) * lt
    return Image.fromarray(out.astype("uint8"))


def blend(base, over, a):
    """Precomputed opaque `over`-on-`base` blend (a in [0,1]) — used instead of
    drawing with a semi-transparent fill directly onto `img`, since PIL's
    ImageDraw REPLACES pixels (RGB *and* alpha) rather than compositing onto
    whatever was already drawn there; a raw alpha fill would erase the shape
    beneath it instead of tinting it."""
    return tuple(round(base[i] + (over[i] - base[i]) * a) for i in range(3))


def draw_pal(size, mono=None, detail=True):
    """Render the Pixel Pal mascot on a 120-unit grid, transparent background.
    mono: None -> full colour hero mascot; otherwise a single (r,g,b) silhouette ink.
    detail: gloss/blush/eye-highlights — turned off for tiny favicon renders."""
    px = size * SS
    u = px / 120.0
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def ink(c):
        return (mono if mono else c) + (255,)

    # Feet — small grounded nubs, drawn first so the shell overlaps their tops.
    for fx in (36, 66):
        d.rounded_rectangle([fx * u, 89 * u, (fx + 18) * u, 102 * u], radius=7 * u, fill=ink(RIM))

    # Side-pod arms — mostly nested behind the shell, only ~34% of each
    # poking out past its edge, so the silhouette reads as a creature with
    # small arms rather than two detached circles.
    pod_r = 10 * u
    for side, cx in ((-1, 25 * u + 0.16 * (2 * pod_r)), (1, 95 * u - 0.16 * (2 * pod_r))):
        d.ellipse([cx - pod_r, 58 * u - pod_r, cx + pod_r, 58 * u + pod_r], fill=ink(BODY))
        d.ellipse([cx - pod_r, 58 * u - pod_r, cx + pod_r, 58 * u + pod_r], outline=ink(RIM), width=max(1, int(3 * u)))

    # Body shell — rounded-square cabinet. Drawn AFTER the pods so it overlaps
    # the ~66% of each pod that should sit "behind" it.
    d.rounded_rectangle([25 * u, 27 * u, 95 * u, 95 * u], radius=19 * u, fill=ink(BODY))
    d.rounded_rectangle([25 * u, 27 * u, 95 * u, 95 * u], radius=19 * u, outline=ink(RIM), width=max(1, int(3.6 * u)))

    if detail and not mono:
        d.rounded_rectangle([33 * u, 33 * u, 63 * u, 49 * u], radius=11 * u, fill=blend(BODY, (255, 255, 255), 0.4))
        d.ellipse([37 * u, 37 * u, 46 * u, 46 * u], fill=blend(BODY, (255, 255, 255), 0.85))

    # Visor — glossy dark face-plate with two eyes.
    d.rounded_rectangle([38 * u, 40 * u, 82 * u, 64 * u], radius=8 * u, fill=ink(VISOR))
    for cx in (52, 68):
        rw, rh = 3.6 * u, 4.6 * u
        d.ellipse([cx * u - rw, 48 * u - rh, cx * u + rw, 48 * u + rh], fill=ink(EYE))
    if detail and not mono:
        d.ellipse([35 * u, 57 * u, 44 * u, 64 * u], fill=blend(BODY, BLUSH, 0.45))
        d.ellipse([76 * u, 57 * u, 85 * u, 64 * u], fill=blend(BODY, BLUSH, 0.45))

    # Chest core — the one warm "alive" glow, reusing the brand's approved
    # white -> gold -> orange radial (the same core language as the old
    # portal mark), now worn as the mascot's own power source.
    cx0, cy0, cw, ch, cr = 60 * u, 78 * u, 26 * u, 18 * u, 6 * u
    if mono:
        d.rounded_rectangle([cx0 - cw / 2, cy0 - ch / 2, cx0 + cw / 2, cy0 + ch / 2], radius=cr, fill=ink(BODY))
    else:
        core_stops = [(0.0, (255, 255, 255)), (0.32, (255, 240, 184)), (0.64, (255, 201, 77)), (1.0, (233, 120, 45))]
        core_box = int(cw) + 8, int(ch) + 8
        core_img = radial(max(core_box), core_stops, maxr_frac=0.9).resize(core_box)
        mask = Image.new("L", core_box, 0)
        ImageDraw.Draw(mask).rounded_rectangle([4, 4, core_box[0] - 4, core_box[1] - 4], radius=cr, fill=255)
        layer = Image.new("RGBA", core_box, (0, 0, 0, 0))
        layer.paste(core_img.convert("RGB"), (0, 0), mask)
        img.alpha_composite(layer, (int(cx0 - core_box[0] / 2), int(cy0 - core_box[1] / 2)))

    return img.resize((size, size), Image.LANCZOS)


def arcade_backdrop(size):
    """Premium blue/purple arcade environment behind the icon mascot: a deep
    indigo radial field plus a soft pedestal glow the mascot appears to stand on."""
    stops = [
        (0.0, (86, 78, 196)),
        (0.35, (46, 40, 132)),
        (0.68, (22, 19, 74)),
        (1.0, (9, 8, 26)),
    ]
    base = radial(size, stops, center=(0.5, 0.4), maxr_frac=0.92).convert("RGBA")
    pedestal = radial(size, [(0.0, (140, 150, 255)), (1.0, (46, 40, 132))], center=(0.5, 0.86), maxr_frac=0.34)
    pmask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(pmask).ellipse([size * 0.18, size * 0.78, size * 0.82, size * 0.98], fill=110)
    base.paste(pedestal.convert("RGBA"), (0, 0), pmask)
    return base


# ---------------------------------------------------------------- app icon
def build_icon():
    base = arcade_backdrop(1024).convert("RGB")
    pal = draw_pal(760)
    base.paste(pal, (132, 148), pal)
    base.save(os.path.join(ASSETS, "icon.png"))
    print("icon.png", base.size)


def build_adaptive():
    # Android adaptive foreground: mascot only, sized to sit inside the ~66%
    # safe circle of the 1024 canvas (Android may mask outside a centred circle).
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    pal = draw_pal(620)
    fg.paste(pal, (202, 224), pal)
    fg.save(os.path.join(ASSETS, "adaptive-icon.png"))
    fg.save(os.path.join(ASSETS, "android-icon-foreground.png"))
    Image.new("RGB", (1024, 1024), BG_ALT).save(os.path.join(ASSETS, "android-icon-background.png"))

    monobox = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    mono = draw_pal(620, mono=(255, 255, 255), detail=False)
    monobox.paste(mono, (202, 224), mono)
    monobox.save(os.path.join(ASSETS, "android-icon-monochrome.png"))
    print("adaptive-icon.png / android-icon-*.png done")


def build_splash():
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    pal = draw_pal(420)
    canvas.alpha_composite(pal, (302, 210))
    d = ImageDraw.Draw(canvas)
    f = ImageFont.truetype(FONT, 108)

    def centred(text, y, fill):
        b = d.textbbox((0, 0), text, font=f)
        w = b[2] - b[0]
        track = int(108 * 0.14)
        total = w + track * (len(text) - 1)
        x = (1024 - total) // 2
        for ch in text:
            d.text((x, y), ch, font=f, fill=fill)
            cb = d.textbbox((0, 0), ch, font=f)
            x += (cb[2] - cb[0]) + track

    centred("PIXEL", 660, OFFWHITE + (255,))
    centred("ARCADIA", 780, PORTAL + (255,))
    canvas.save(os.path.join(ASSETS, "splash-icon.png"))
    print("splash-icon.png done")


def build_favicons():
    for size, name, detail in [(64, "favicon.png", True), (32, "favicon-32.png", False)]:
        bgc = Image.new("RGB", (size, size), BG_ALT).convert("RGBA")
        r = max(2, int(size * 0.18))
        rounded = Image.new("L", (size, size), 0)
        ImageDraw.Draw(rounded).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
        pal = draw_pal(int(size * 0.86), detail=detail)
        bgc.alpha_composite(pal, (int(size * 0.07), int(size * 0.07)))
        final = Image.new("RGB", (size, size), BG_ALT)
        final.paste(bgc.convert("RGB"), (0, 0), rounded)
        final.save(os.path.join(ASSETS, name))
        print(name, "done")
    # 16px: too small for the mascot to read — keep the flat core-colour square.
    f16 = Image.new("RGB", (16, 16), BG_ALT)
    ImageDraw.Draw(f16).rectangle([3, 3, 12, 12], fill=CORE_FLAT)
    f16.save(os.path.join(ASSETS, "favicon-16.png"))
    print("favicon-16.png done")


def build_marketing():
    pal = draw_pal(760)
    dark = arcade_backdrop(1024).convert("RGB")
    dark.paste(pal, (132, 148), pal)
    dark.save(os.path.join(BRAND, "icon-dark.png"))
    light_bg = grad_v(1024, 1024, (110, 100, 220), (58, 42, 130))
    light = light_bg.convert("RGB")
    light.paste(pal, (132, 148), pal)
    light.save(os.path.join(BRAND, "icon-light.png"))
    print("brand/icon-light.png brand/icon-dark.png done")


build_icon()
build_adaptive()
build_splash()
build_favicons()
build_marketing()
print("ALL DONE")
