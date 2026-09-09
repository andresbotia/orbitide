"""
M3.6B — Pixel Arcadia raster brand asset generation.

Inputs:
  ~/Downloads/glowing_pixel_sun_portal.png   (1254x1254 approved master icon art)
  node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf

Outputs (into ./assets):
  icon.png                    1024  opaque   full-bleed app icon master
  adaptive-icon.png           1024  alpha    Android adaptive foreground (arch+core safe)
  android-icon-foreground.png 1024  alpha    same, kept for existing 3-file config
  android-icon-background.png 1024  opaque   flat brand.bgAlt #120E2A
  android-icon-monochrome.png 1024  alpha    white mark silhouette
  splash-icon.png             1024  alpha    stacked lockup (mark + wordmark)
  favicon.png                 64    opaque   core-only on #120E2A
  favicon-32.png              32    opaque   core-only, short arms
  favicon-16.png              16    opaque   flat #FFC94D square on #120E2A
"""
import os
from PIL import Image, ImageDraw, ImageFont

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSETS = os.path.join(REPO, "assets")
BRAND = os.path.join(ASSETS, "brand")
os.makedirs(BRAND, exist_ok=True)
# Approved master art. Override with PIXEL_ARCADIA_MASTER if it lives elsewhere.
MASTER = os.environ.get(
    "PIXEL_ARCADIA_MASTER",
    os.path.expanduser("~/Downloads/glowing_pixel_sun_portal.png"),
)
FONT = os.path.join(REPO, "node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf")

BG        = (7, 6, 13)       # #07060D  brand.bg
BG_ALT    = (18, 14, 42)     # #120E2A  brand.bgAlt
OFFWHITE  = (237, 234, 246)  # #EDEAF6  text.primary / PIXEL
PORTAL    = (255, 178, 77)   # #FFB24D  brand.portal / ARCADIA
CORE_FLAT = (255, 201, 77)   # #FFC94D

SS = 4  # supersample factor for vector drawing


def card_square(im):
    """Centred square crop of the approved master art (drops the black frame)."""
    w, h = im.size
    cx, cy = 626.5, 616.0
    half = 547.0
    return im.crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half)))


# ---------------------------------------------------------------- app icon
def build_icon():
    src = Image.open(MASTER).convert("RGB")
    card = card_square(src)
    # inset ~4.2% to remove the rounded-corner radius + card rim, then bleed to edge
    s = card.size[0]
    d = int(s * 0.060)
    bleed = card.crop((d, d, s - d, s - d)).resize((1024, 1024), Image.LANCZOS)
    base = Image.new("RGB", (1024, 1024), BG)
    base.paste(bleed, (0, 0))
    base.save(os.path.join(ASSETS, "icon.png"))
    print("icon.png", base.size)


# ---------------------------------------------------------------- simplified logo mark (vector)
def draw_mark(size, block_from, block_to, core=True, mono=None, arms=True):
    """Render the approved 5-block arch + plus-core on a 120-unit grid.
    mono: None -> full colour; otherwise an (r,g,b) single ink."""
    px = size * SS
    u = px / 120.0
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    def grad_v(w, h, c0, c1):
        g = Image.new("RGB", (1, h))
        for y in range(h):
            t = y / max(1, h - 1)
            g.putpixel((0, y), tuple(round(c0[i] + (c1[i] - c0[i]) * t) for i in range(3)))
        return g.resize((w, h))

    def rrect(x, y, w, h, r, fill):
        d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=fill)

    def block(x, y, w, h, r, rot=0.0, cx=None, cy=None):
        X, Y, W, H, R = x * u, y * u, w * u, h * u, r * u
        if mono:
            layer = Image.new("RGBA", (int(W) + 4, int(H) + 4), (0, 0, 0, 0))
            ld = ImageDraw.Draw(layer)
            ld.rounded_rectangle([2, 2, 2 + W, 2 + H], radius=R, fill=mono + (255,))
        else:
            tile = grad_v(int(W) + 4, int(H) + 4, block_from, block_to)
            mask = Image.new("L", (int(W) + 4, int(H) + 4), 0)
            ImageDraw.Draw(mask).rounded_rectangle([2, 2, 2 + W, 2 + H], radius=R, fill=255)
            layer = Image.new("RGBA", (int(W) + 4, int(H) + 4), (0, 0, 0, 0))
            layer.paste(tile, (0, 0), mask)
        if rot:
            layer = layer.rotate(rot, resample=Image.BICUBIC, expand=True,
                                 center=((cx * u) - X + 2, (cy * u) - Y + 2))
        img.alpha_composite(layer, (int(X) - 2, int(Y) - 2))

    # arch blocks
    block(49, 12, 22, 18, 4)
    block(24.5, 22, 20, 18, 4, rot=32, cx=34.5, cy=31)   # PIL rotates CCW; SVG -32 => +32 here
    block(75.5, 22, 20, 18, 4, rot=-32, cx=85.5, cy=31)
    block(14, 46, 20, 58, 4)
    block(86, 46, 20, 58, 4)

    if core:
        cw, ch = 60 * SS, 60 * SS  # generous
        core_layer = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        cd = ImageDraw.Draw(core_layer)
        if mono:
            fill = mono + (255,)
            cd.rounded_rectangle([46 * u, 46 * u, 74 * u, 74 * u], radius=3 * u, fill=fill)
            if arms:
                cd.rectangle([39 * u, 53 * u, 46 * u, 67 * u], fill=fill)
                cd.rectangle([74 * u, 53 * u, 81 * u, 67 * u], fill=fill)
                cd.rectangle([53 * u, 39 * u, 67 * u, 46 * u], fill=fill)
                cd.rectangle([53 * u, 74 * u, 67 * u, 81 * u], fill=fill)
        else:
            # radial warm core: white -> #FFF0B8 -> #FFC94D -> #F2662E
            stops = [(0.0, (255, 255, 255)), (0.28, (255, 240, 184)),
                     (0.58, (255, 201, 77)), (1.0, (242, 102, 46))]
            rad = Image.new("RGB", (px, px))
            cx0, cy0 = 60 * u, 60 * u
            maxr = 20 * u
            for yy in range(px):
                pass
            # fast radial via numpy
            import numpy as np
            yy, xx = np.mgrid[0:px, 0:px]
            dist = np.sqrt((xx - cx0) ** 2 + (yy - cy0) ** 2) / maxr
            dist = np.clip(dist, 0, 1)
            out = np.zeros((px, px, 3), np.float32)
            for i in range(len(stops) - 1):
                t0, c0 = stops[i]
                t1, c1 = stops[i + 1]
                m = (dist >= t0) & (dist <= t1)
                lt = (dist[m] - t0) / (t1 - t0)
                for ch3 in range(3):
                    out[..., ch3][m] = c0[ch3] + (c1[ch3] - c0[ch3]) * lt
            rad = Image.fromarray(out.astype("uint8"))
            cmask = Image.new("L", (px, px), 0)
            cmd = ImageDraw.Draw(cmask)
            cmd.rounded_rectangle([46 * u, 46 * u, 74 * u, 74 * u], radius=3 * u, fill=255)
            if arms:
                cmd.rectangle([39 * u, 53 * u, 46 * u, 67 * u], fill=255)
                cmd.rectangle([74 * u, 53 * u, 81 * u, 67 * u], fill=255)
                cmd.rectangle([53 * u, 39 * u, 67 * u, 46 * u], fill=255)
                cmd.rectangle([53 * u, 74 * u, 67 * u, 81 * u], fill=255)
            core_layer.paste(rad, (0, 0), cmask)
        img.alpha_composite(core_layer)

    return img.resize((size, size), Image.LANCZOS)


BLOCK_FROM = (143, 168, 255)   # #8FA8FF
BLOCK_TO   = (75, 71, 201)     # #4B47C9


def build_adaptive():
    # Android adaptive foreground: full approved art, scaled so arch+core sit well
    # inside the 690px safe circle of the 1024 canvas; plinth/piers may be masked.
    src = Image.open(MASTER).convert("RGB")
    card = card_square(src).resize((1024, 1024), Image.LANCZOS)
    # Focus on arch + core: trim the black frame and most of the plinth (the
    # sacrificial zone under Android's ~66% circle mask) before centring.
    focus = card.crop((70, 34, 954, 918))  # 884 x 884, biased slightly upward
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    scaled = focus.resize((792, 792), Image.LANCZOS).convert("RGBA")
    fg.paste(scaled, (116, 104))
    fg.save(os.path.join(ASSETS, "adaptive-icon.png"))
    fg.save(os.path.join(ASSETS, "android-icon-foreground.png"))
    Image.new("RGB", (1024, 1024), BG_ALT).save(os.path.join(ASSETS, "android-icon-background.png"))
    mono = draw_mark(1024, BLOCK_FROM, BLOCK_TO, mono=(255, 255, 255))
    monobox = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    m2 = mono.resize((680, 680), Image.LANCZOS)
    monobox.paste(m2, (172, 172), m2)
    monobox.save(os.path.join(ASSETS, "android-icon-monochrome.png"))
    print("adaptive-icon.png / android-icon-*.png done")


def build_splash():
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    mark = draw_mark(360, BLOCK_FROM, BLOCK_TO)
    canvas.alpha_composite(mark, (332, 250))
    d = ImageDraw.Draw(canvas)
    f = ImageFont.truetype(FONT, 108)
    def centred(text, y, fill):
        b = d.textbbox((0, 0), text, font=f)
        w = b[2] - b[0]
        # +0.14em tracking
        track = int(108 * 0.14)
        total = w + track * (len(text) - 1)
        x = (1024 - total) // 2
        for ch in text:
            d.text((x, y), ch, font=f, fill=fill)
            cb = d.textbbox((0, 0), ch, font=f)
            x += (cb[2] - cb[0]) + track
    centred("PIXEL", 640, OFFWHITE + (255,))
    centred("ARCADIA", 760, PORTAL + (255,))
    canvas.save(os.path.join(ASSETS, "splash-icon.png"))
    print("splash-icon.png done")


def build_favicons():
    for size, name, arms in [(64, "favicon.png", True), (32, "favicon-32.png", True)]:
        bgc = Image.new("RGB", (size, size), BG_ALT)
        r = max(2, int(size * 0.18))
        rounded = Image.new("L", (size, size), 0)
        ImageDraw.Draw(rounded).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
        core = draw_mark(size, BLOCK_FROM, BLOCK_TO, core=True, arms=arms)
        # keep only the core: redraw with just core by masking out block area is complex;
        # instead render a core-only mark
        core_only = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
        # reuse draw_mark but with tiny blocks suppressed: quick approach -> draw plus core directly
        import numpy as np
        px = size * SS
        u = px / 120.0
        yy, xx = np.mgrid[0:px, 0:px]
        cx0 = cy0 = 60 * u
        maxr = (22 if size >= 48 else 24) * u
        dist = np.clip(np.sqrt((xx - cx0) ** 2 + (yy - cy0) ** 2) / maxr, 0, 1)
        stops = [(0.0, (255, 255, 255)), (0.22, (255, 240, 184)), (0.55, (255, 201, 77)), (1.0, (242, 102, 46))]
        out = np.zeros((px, px, 3), np.float32)
        for i in range(len(stops) - 1):
            t0, c0 = stops[i]; t1, c1 = stops[i + 1]
            m = (dist >= t0) & (dist <= t1)
            lt = (dist[m] - t0) / (t1 - t0)
            for c3 in range(3):
                out[..., c3][m] = c0[c3] + (c1[c3] - c0[c3]) * lt
        rad = Image.fromarray(out.astype("uint8"))
        armlen = 7 if size >= 48 else 4
        cmask = Image.new("L", (px, px), 0)
        cmd = ImageDraw.Draw(cmask)
        cmd.rounded_rectangle([46 * u, 46 * u, 74 * u, 74 * u], radius=3 * u, fill=255)
        cmd.rectangle([(46 - armlen) * u, 53 * u, 46 * u, 67 * u], fill=255)
        cmd.rectangle([74 * u, 53 * u, (74 + armlen) * u, 67 * u], fill=255)
        cmd.rectangle([53 * u, (46 - armlen) * u, 67 * u, 46 * u], fill=255)
        cmd.rectangle([53 * u, 74 * u, 67 * u, (74 + armlen) * u], fill=255)
        co = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        co.paste(rad, (0, 0), cmask)
        co = co.resize((size, size), Image.LANCZOS)
        bgc = bgc.convert("RGBA")
        bgc.alpha_composite(co)
        final = Image.new("RGB", (size, size), BG_ALT)
        final.paste(bgc.convert("RGB"), (0, 0), rounded)
        final.save(os.path.join(ASSETS, name))
        print(name, "done")
    # 16: flat #FFC94D 10x10 on #120E2A
    f16 = Image.new("RGB", (16, 16), BG_ALT)
    ImageDraw.Draw(f16).rectangle([3, 3, 12, 12], fill=CORE_FLAT)
    f16.save(os.path.join(ASSETS, "favicon-16.png"))
    print("favicon-16.png done")


def build_marketing():
    src = Image.open(MASTER).convert("RGB")
    card = card_square(src)
    s = card.size[0]; d = int(s * 0.060)
    bleed = card.crop((d, d, s - d, s - d)).resize((1024, 1024), Image.LANCZOS)
    dark = Image.new("RGB", (1024, 1024), (15, 10, 36))  # #0F0A24
    dark.paste(bleed, (0, 0))
    dark.save(os.path.join(BRAND, "icon-dark.png"))
    light = Image.new("RGB", (1024, 1024), (58, 42, 110))  # #3A2A6E
    light.paste(bleed, (0, 0))
    light.save(os.path.join(BRAND, "icon-light.png"))
    print("brand/icon-light.png brand/icon-dark.png done")


build_icon()
build_adaptive()
build_splash()
build_favicons()
print("ALL DONE")
