from pathlib import Path
from PIL import Image
import numpy as np

source = Path('/home/ubuntu/upload/Screenshot_20260813-020135_Chrome.jpg')
out_dir = Path('/home/ubuntu/clinic-squad/artifacts/clinic-squad/public')
out_dir.mkdir(parents=True, exist_ok=True)

image = Image.open(source).convert('RGBA')
array = np.array(image)
rgb = array[:, :, :3].astype(int)

# Detect the turquoise app tile while excluding dark browser chrome.
r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
teal = (g > 120) & (b > 120) & (g > r * 1.35) & (b > r * 1.25) & (np.abs(g - b) < 90)
ys, xs = np.where(teal)
if len(xs) == 0:
    raise RuntimeError('Could not detect the teal shield tile in the supplied image')

left, right = int(xs.min()), int(xs.max()) + 1
upper, lower = int(ys.min()), int(ys.max()) + 1
side = max(right - left, lower - upper)
center_x = (left + right) // 2
center_y = (upper + lower) // 2
left = max(0, center_x - side // 2)
upper = max(0, center_y - side // 2)
right = min(image.width, left + side)
lower = min(image.height, upper + side)
left = right - side
upper = lower - side

icon = image.crop((left, upper, right, lower)).resize((512, 512), Image.Resampling.LANCZOS)
icon_array = np.array(icon)
icon_rgb = icon_array[:, :, :3].astype(int)
black_background = (icon_rgb.max(axis=2) < 48)
icon_array[black_background, 3] = 0
Image.fromarray(icon_array, mode='RGBA').save(out_dir / 'favicon.png', optimize=True)
Image.fromarray(icon_array, mode='RGBA').save(out_dir / 'apple-touch-icon.png', optimize=True)
print(f'source_size={image.width}x{image.height}')
print(f'detected_box=({left},{upper})-({right},{lower})')
print('wrote favicon.png and apple-touch-icon.png')
