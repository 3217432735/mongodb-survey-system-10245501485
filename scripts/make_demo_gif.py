from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "output" / "demo"
OUT = SRC / "demo.gif"

frames = [
    ("01-login.png", "1. 登录：demo / demo123"),
    ("02-dashboard.png", "2. 我的问卷：查看状态、链接和回收数"),
    ("03-builder.png", "3. 编辑问卷：配置题型与跳转规则"),
    ("04-fill-q1.png", "4. 填写第 1 题：选择“外卖”"),
    ("05-validation.png", "5. 校验：多选不足两项时提示"),
    ("06-jump.png", "6. 跳题：选“志愿活动”直接到第 6 题"),
    ("07-success.png", "7. 提交成功"),
    ("08-stats.png", "8. 统计实时更新为 8 份"),
]

width = 1080
body_height = 675
caption_height = 58
font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 27)
images = []

for filename, caption in frames:
    source = Image.open(SRC / filename).convert("RGB")
    body = source.resize((width, body_height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (width, body_height + caption_height), "#f4f5f6")
    canvas.paste(body, (0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rectangle(
        (0, body_height, width, body_height + caption_height),
        fill="#263238",
    )
    draw.text((28, body_height + 13), caption, font=font, fill="white")
    images.append(canvas)

images[0].save(
    OUT,
    save_all=True,
    append_images=images[1:],
    duration=[2200] + [1800] * (len(images) - 1),
    loop=0,
    optimize=True,
    disposal=2,
)
print(OUT)
