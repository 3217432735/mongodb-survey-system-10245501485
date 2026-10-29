from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(parents=True, exist_ok=True)

FONT = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 28)
SMALL = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 21)
TITLE = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 34)

BLUE = "#356aa0"
LIGHT = "#f4f7fa"
LINE = "#c9d4df"
TEXT = "#222222"
MUTED = "#5f6b77"


def box(draw, xy, title, lines, title_font=FONT):
    draw.rounded_rectangle(xy, radius=14, fill=LIGHT, outline=LINE, width=3)
    x1, y1, x2, _ = xy
    draw.text((x1 + 22, y1 + 18), title, fill=TEXT, font=title_font)
    y = y1 + 66
    for line in lines:
        draw.text((x1 + 22, y), line, fill=MUTED, font=SMALL)
        y += 34


def arrow(draw, start, end):
    draw.line([start, end], fill=BLUE, width=4)
    x1, y1 = start
    x2, y2 = end
    if x2 > x1:
        draw.polygon(
            [(x2, y2), (x2 - 14, y2 - 8), (x2 - 14, y2 + 8)],
            fill=BLUE,
        )
    else:
        draw.polygon(
            [(x2, y2), (x2 + 14, y2 - 8), (x2 + 14, y2 + 8)],
            fill=BLUE,
        )


def make_model_diagram():
    image = Image.new("RGB", (1800, 850), "white")
    draw = ImageDraw.Draw(image)
    draw.text((70, 36), "第二阶段题目版本与问卷快照", fill=TEXT, font=TITLE)

    box(draw, (70, 170, 430, 520), "question_roots", [
        "题目身份",
        "owner_id",
        "shared_with_user_ids",
        "current_version_id",
    ])
    box(draw, (540, 170, 940, 520), "question_versions", [
        "不可变版本内容",
        "version_no",
        "previous_version_id",
        "derived_from_version_id",
    ])
    box(draw, (1050, 120, 1420, 570), "questions", [
        "问卷题目快照",
        "library_root_id",
        "library_version_id",
        "jump_rules",
    ])
    box(draw, (1520, 230, 1740, 470), "responses", [
        "answers",
        "question_id",
        "value",
    ])

    arrow(draw, (430, 345), (540, 345))
    arrow(draw, (940, 345), (1050, 345))
    arrow(draw, (1420, 345), (1520, 345))

    draw.text(
        (200, 620),
        "题库版本只影响后续选题；问卷通过题目快照保持历史内容",
        fill=MUTED,
        font=FONT,
    )
    draw.text(
        (200, 680),
        "surveys 保存问卷元数据；users 保存账号和共享权限",
        fill=MUTED,
        font=SMALL,
    )
    image.save(ASSETS / "phase2-model.png")


def make_version_diagram():
    image = Image.new("RGB", (1800, 900), "white")
    draw = ImageDraw.Draw(image)
    draw.text((70, 35), "版本链、恢复和问卷引用", fill=TEXT, font=TITLE)

    box(draw, (120, 150, 430, 420), "v1", [
        "初始版本",
        "“你的年龄”",
        "问卷 A 使用",
    ])
    box(draw, (650, 150, 960, 420), "v2", [
        "修改标题与范围",
        "“你的年龄段”",
        "问卷 B 使用",
    ])
    box(draw, (1180, 150, 1490, 420), "v3", [
        "从 v1 恢复",
        "生成新的当前版本",
        "不删除 v1、v2",
    ])
    arrow(draw, (430, 285), (650, 285))
    arrow(draw, (960, 285), (1180, 285))

    draw.line(
        [(1335, 420), (1335, 620), (275, 620), (275, 430)],
        fill=BLUE,
        width=4,
    )
    draw.polygon(
        [(275, 430), (261, 444), (289, 444)],
        fill=BLUE,
    )
    draw.text((720, 575), "restore(v1)", fill=BLUE, font=FONT)

    draw.text(
        (150, 710),
        "问卷只保存自己选中的版本快照；旧答卷始终对应原 question_id",
        fill=MUTED,
        font=SMALL,
    )
    image.save(ASSETS / "phase2-versions.png")


if __name__ == "__main__":
    make_model_diagram()
    make_version_diagram()
    print("第二阶段报告图表已生成")
