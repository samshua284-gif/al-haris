#!/usr/bin/env python3
"""Generate the Guardian shield icon (src/res/drawable/icon.png)."""
import math
from PIL import Image, ImageDraw

img = Image.new('RGBA', (192, 192), (10, 14, 24, 255))
d = ImageDraw.Draw(img)
d.polygon([(96, 14), (160, 38), (160, 96), (96, 178), (32, 96), (32, 38)],
          outline=(232, 184, 75, 255), width=7)
d.polygon([(96, 34), (142, 52), (142, 94), (96, 156), (50, 94), (50, 52)],
          outline=(120, 200, 140, 255), width=3)
cx, cy = 96, 92
for a in range(0, 360, 90):
    r = math.radians(a - 90)
    d.line([(cx, cy), (cx + 30 * math.cos(r), cy + 30 * math.sin(r))],
           fill=(232, 184, 75, 255), width=6)
d.ellipse([88, 84, 104, 100], fill=(240, 210, 120, 255))
img.save('src/res/drawable/icon.png')
print('icon ok')
