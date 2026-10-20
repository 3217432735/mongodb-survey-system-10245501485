from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent / "assets"
OUT.mkdir(parents=True, exist_ok=True)

FONT = "C:/Windows/Fonts/msyh.ttc"
FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"


def font(size, bold=False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def centered(draw, box, text, size=30, bold=False, fill="#222222", spacing=8):
    x1, y1, x2, y2 = box
    f = font(size, bold)
    bbox = draw.multiline_textbbox((0, 0), text, font=f, spacing=spacing)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    draw.multiline_text(
        ((x1 + x2 - w) / 2, (y1 + y2 - h) / 2 - 4),
        text,
        font=f,
        fill=fill,
        align="center",
        spacing=spacing,
    )


def arrow(draw, start, end, color="#6d7b88", width=3):
    draw.line([start, end], fill=color, width=width)
    x, y = end
    draw.polygon(
        [(x, y), (x - 14, y - 8), (x - 14, y + 8)],
        fill=color,
    )


def make_architecture():
    img = Image.new("RGB", (1800, 700), "white")
    d = ImageDraw.Draw(img)
    d.text((80, 55), "问卷系统结构", font=font(42, True), fill="#222222")

    boxes = [
        ((70, 210, 420, 520), "浏览器页面\n\n登录注册\n问卷列表\n问卷编辑\n填写问卷\n统计结果"),
        ((500, 210, 830, 520), "Express 路由\n\n/api/auth\n/api/surveys\n/api/fill\n静态页面"),
        ((910, 210, 1240, 520), "业务模块\n\nvalidation.js\n题目和答案校验\njump.js\n路径计算\nstats.js\n聚合统计"),
        ((1320, 180, 1730, 550), "MongoDB\n\nusers\nsurveys\nquestions\nresponses\nsessions"),
    ]
    for box, text in boxes:
        d.rounded_rectangle(box, radius=14, outline="#9aa7b4", width=3, fill="#f7f9fb")
        centered(d, box, text, size=28)
    for start, end in [
        ((420, 365), (500, 365)),
        ((830, 365), (910, 365)),
        ((1240, 365), (1320, 365)),
    ]:
        arrow(d, start, end)

    d.text(
        (70, 600),
        "页面通过 fetch 调接口，登录状态用 session cookie 保存；所有业务数据存放在 MongoDB。",
        font=font(25),
        fill="#444444",
    )
    img.save(OUT / "architecture.png")


def make_collections():
    img = Image.new("RGB", (1800, 1080), "white")
    d = ImageDraw.Draw(img)
    d.text((80, 55), "主要集合关系", font=font(42, True), fill="#222222")

    boxes = {
        "users": ((70, 230, 410, 610), "users\n\n_id\nusername\npassword_salt\npassword_hash\ncreated_at"),
        "surveys": ((510, 190, 930, 650), "surveys\n\n_id\nowner_id\npublic_id\ntitle / description\nstatus / deadline\nallow_anonymous\nallow_multiple"),
        "questions": ((1080, 120, 1730, 510), "questions\n\n_id\nsurvey_id\norder / type / title\noptions\n各类限制字段\njump_rules"),
        "responses": ((1080, 640, 1730, 1010), "responses\n\n_id\nsurvey_id\nrespondent_id / name\nrespondent_key\nanonymous\nanswers[]\nsubmitted_at"),
    }
    for box, text in boxes.values():
        d.rounded_rectangle(box, radius=14, outline="#9aa7b4", width=3, fill="#f7f9fb")
        centered(d, box, text, size=22, spacing=5)

    arrow(d, (410, 420), (510, 420))
    d.text((420, 372), "1 : N", font=font(22, True), fill="#356aa0")
    arrow(d, (930, 330), (1080, 300))
    d.text((945, 288), "1 : N", font=font(22, True), fill="#356aa0")
    arrow(d, (930, 555), (1080, 810))
    d.text((950, 650), "1 : N", font=font(22, True), fill="#356aa0")

    d.text(
        (80, 1038),
        "answers 嵌在 response 文档中；jump_rules 嵌在 question 文档中。",
        font=font(22),
        fill="#444444",
    )
    img.save(OUT / "collections.png")


if __name__ == "__main__":
    make_architecture()
    make_collections()
    print("diagrams saved to", OUT)
