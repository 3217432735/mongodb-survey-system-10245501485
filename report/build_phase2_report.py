"""生成大作业一第二阶段项目报告。"""

from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.shared import Cm, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
OUT = ROOT / "大作业一第二阶段-项目报告.docx"
GITHUB_URL = "https://github.com/3217432735/mongodb-survey-system-10245501485"

BODY_EA = "宋体"
HEAD_EA = "黑体"
ASCII_FONT = "Times New Roman"
CODE_FONT = "Consolas"


def set_font(
    run,
    size=10.5,
    ascii_font=ASCII_FONT,
    ea_font=BODY_EA,
    bold=False,
    color=(0, 0, 0),
):
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.name = ascii_font
    run.font.color.rgb = RGBColor(*color)
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    rfonts.set(qn("w:ascii"), ascii_font)
    rfonts.set(qn("w:hAnsi"), ascii_font)
    rfonts.set(qn("w:eastAsia"), ea_font)


def strip_borders(paragraph):
    ppr = paragraph._p.get_or_add_pPr()
    for pdr in ppr.findall(qn("w:pBdr")):
        ppr.remove(pdr)


def body(doc, text, indent=True, size=10.5, space_after=6, line_spacing=1.45):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_after = Pt(space_after)
    pf.line_spacing = line_spacing
    if indent:
        pf.first_line_indent = Pt(21)
    set_font(p.add_run(text), size=size)
    return p


def numbered(doc, index, text, size=10.5):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.left_indent = Cm(0.75)
    pf.first_line_indent = Cm(-0.75)
    pf.space_after = Pt(3)
    pf.line_spacing = 1.4
    set_font(p.add_run(f"{index}. {text}"), size=size)
    return p


def heading(doc, text, level=1, page_break=False):
    p = doc.add_heading(text, level=level)
    strip_borders(p)
    pf = p.paragraph_format
    pf.space_before = Pt(14 if level == 1 else 10)
    pf.space_after = Pt(5 if level == 1 else 3)
    pf.keep_with_next = True
    if page_break:
        pf.page_break_before = True
    for run in p.runs:
        set_font(
            run,
            size=14 if level == 1 else 11.5,
            ascii_font=HEAD_EA,
            ea_font=HEAD_EA,
            bold=True,
        )
    return p


def set_cell_shading(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), fill)
    tcpr.append(shd)


def set_table_borders(table):
    tblpr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), "D9D9D9")
        borders.append(el)
    tblpr.append(borders)

    margins = OxmlElement("w:tblCellMar")
    for side, width in (
        ("top", "85"),
        ("left", "105"),
        ("bottom", "85"),
        ("right", "105"),
    ):
        el = OxmlElement("w:" + side)
        el.set(qn("w:w"), width)
        el.set(qn("w:type"), "dxa")
        margins.append(el)
    tblpr.append(margins)


def repeat_header(row):
    trpr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:tblHeader")
    el.set(qn("w:val"), "true")
    trpr.append(el)


def no_split(row):
    trpr = row._tr.get_or_add_trPr()
    el = OxmlElement("w:cantSplit")
    el.set(qn("w:val"), "true")
    trpr.append(el)


def add_table(doc, headers, rows, widths, size=9):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)

    hdr = table.rows[0]
    repeat_header(hdr)
    no_split(hdr)
    for idx, text in enumerate(headers):
        cell = hdr.cells[idx]
        cell.width = Cm(widths[idx])
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        cell.text = ""
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(0)
        set_font(
            p.add_run(text),
            size=size,
            ea_font=HEAD_EA,
            bold=True,
            color=(255, 255, 255),
        )
        set_cell_shading(cell, "356AA0")

    for row_index, values in enumerate(rows):
        row = table.add_row()
        no_split(row)
        for idx, value in enumerate(values):
            cell = row.cells[idx]
            cell.width = Cm(widths[idx])
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.2
            p.alignment = (
                WD_ALIGN_PARAGRAPH.CENTER
                if idx == 0 or len(str(value)) <= 10
                else WD_ALIGN_PARAGRAPH.LEFT
            )
            set_font(p.add_run(str(value)), size=size)
            if row_index % 2 == 1:
                set_cell_shading(cell, "F5F7FA")

    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(4)


def code_block(doc, lines, size=8.5):
    for idx, line in enumerate(lines):
        p = doc.add_paragraph()
        pf = p.paragraph_format
        pf.left_indent = Cm(0.7)
        pf.right_indent = Cm(0.3)
        pf.space_before = Pt(3 if idx == 0 else 0)
        pf.space_after = Pt(3 if idx == len(lines) - 1 else 0)
        pf.line_spacing = 1.08
        pf.keep_with_next = idx < len(lines) - 1
        ppr = p._p.get_or_add_pPr()
        shd = OxmlElement("w:shd")
        shd.set(qn("w:val"), "clear")
        shd.set(qn("w:fill"), "F2F3F5")
        ppr.append(shd)
        set_font(
            p.add_run(line if line else " "),
            size=size,
            ascii_font=CODE_FONT,
        )
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def figure(doc, path, width_cm, caption):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(str(path), width=Cm(width_cm))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(9)
    set_font(cap.add_run(caption), size=9, color=(90, 90, 90))


def add_hyperlink(paragraph, url, text):
    rel_id = paragraph.part.relate_to(url, RT.HYPERLINK, is_external=True)
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), rel_id)
    run = OxmlElement("w:r")
    rpr = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "0563C1")
    rpr.append(color)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    rpr.append(underline)
    fonts = OxmlElement("w:rFonts")
    fonts.set(qn("w:ascii"), ASCII_FONT)
    fonts.set(qn("w:hAnsi"), ASCII_FONT)
    rpr.append(fonts)
    size = OxmlElement("w:sz")
    size.set(qn("w:val"), "20")
    rpr.append(size)
    run.append(rpr)
    node = OxmlElement("w:t")
    node.text = text
    run.append(node)
    hyperlink.append(run)
    paragraph._p.append(hyperlink)


doc = Document()

title_style = doc.styles["Title"]
tppr = title_style.element.get_or_add_pPr()
for pdr in tppr.findall(qn("w:pBdr")):
    tppr.remove(pdr)

section = doc.sections[0]
section.page_width = Cm(21.0)
section.page_height = Cm(29.7)
section.top_margin = Cm(2.3)
section.bottom_margin = Cm(2.3)
section.left_margin = Cm(2.5)
section.right_margin = Cm(2.5)

normal = doc.styles["Normal"]
normal.font.size = Pt(10.5)
normal.font.name = ASCII_FONT
normal.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_EA)
normal.paragraph_format.line_spacing = 1.45
normal.paragraph_format.space_after = Pt(6)

# 封面
link_p = doc.add_paragraph()
link_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
link_p.paragraph_format.space_after = Pt(0)
set_font(link_p.add_run("GitHub 仓库："), size=9.5)
add_hyperlink(link_p, GITHUB_URL, GITHUB_URL)

for _ in range(3):
    doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(p.add_run("当代数据管理系统"), size=15, ea_font=HEAD_EA, bold=True)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(36)
set_font(p.add_run("大作业一（第二阶段）"), size=12)

p = doc.add_paragraph(style="Title")
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(14)
set_font(
    p.add_run("基于 MongoDB 的在线问卷系统"),
    size=24,
    ea_font=HEAD_EA,
    bold=True,
)

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
p.paragraph_format.space_after = Pt(80)
set_font(p.add_run("第二阶段项目完成报告"), size=16, bold=True)

for text in (
    "姓名：银启行",
    "学号：10245501485",
    "完成日期：2026 年 10 月 29 日",
):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(10)
    set_font(p.add_run(text), size=12)

doc.add_page_break()

heading(doc, "摘要", 1)
body(
    doc,
    "本报告记录在线问卷系统在第一阶段基础上的第二阶段增量改造。需求变更要求题目可以保存、"
    "重复使用、共享给其他用户，并在修改时保留历史版本，不影响已经发布的问卷。系统新增题目库、"
    "题目共享、不可变版本、版本恢复、问卷引用版本、题目使用情况查询和跨问卷统计。"
)
body(
    doc,
    "实现继续使用第一阶段的 Node.js、Express、MongoDB 和原有路由，没有推倒重写。新增 "
    "question_roots 与 question_versions 两个集合，同时让原 questions 集合继续保存每份问卷的"
    "题目快照。第一阶段账号、问卷、跳转、校验、填写和单问卷统计功能保持可用。当前测试共 14 组，"
    "全部通过。"
)

heading(doc, "一、第二阶段目标与改造范围", 1)
heading(doc, "1.1 第一阶段基础", 2)
body(
    doc,
    "第一阶段系统支持注册登录、问卷创建与管理、四类题型、条件跳转、前后端校验、公开链接、"
    "匿名填写、重复填写配置和单问卷统计。MongoDB 中主要使用 users、surveys、questions、"
    "responses 和 sessions 五个集合。"
)

heading(doc, "1.2 第二阶段目标", 2)
body(
    doc,
    "第二阶段需要解决的问题不是增加更多题型，而是让题目成为可复用但可控的资产。用户应能保存"
    "常用题目、共享给同事或同学，并基于旧题生成新版本。任何题库修改都不能回头改变已经发布问卷"
    "中的题目和答卷。"
)
body(
    doc,
    "本次改造保持原有页面和接口继续工作。题目库作为新页面加入，问卷编辑页增加选题和版本选项。"
    "旧题目在服务启动时自动建立初始版本，不修改原始题目内容和答卷。"
)

heading(doc, "1.3 改造原则", 2)
numbered(doc, 1, "增量修改：保留第一阶段集合、路由、页面和测试。")
numbered(doc, 2, "快照隔离：问卷保存题目版本副本，不直接读取可变题库内容。")
numbered(doc, 3, "不可变历史：版本一经创建不再覆盖，恢复旧版本也生成新版本。")
numbered(doc, 4, "权限最小化：共享用户可以选题，不能修改题目创建者的版本链。")
numbered(doc, 5, "统计隔离：跨问卷统计只汇总当前用户自己的问卷，避免泄露其他用户答卷。")

heading(doc, "二、需求变化与问题分析", 1, page_break=True)
body(
    doc,
    "第一阶段的题目直接属于某一份问卷，发布后通过禁止修改来保护旧答卷。这种方案可以保证第一阶段"
    "数据一致，但不能支持题目重复使用、共享和版本演进。若让多个问卷直接引用同一条可变题目记录，"
    "修改一次题干就会同时改变旧问卷，导致历史答案失去语义。"
)
add_table(
    doc,
    ["需求变化", "原设计中的问题", "第二阶段方案"],
    [
        ["保存常用题目", "题目与单一问卷绑定", "题目根加入个人题库"],
        ["共享题目", "题目没有所有者之外的授权关系", "题目根保存共享用户"],
        ["修改不影响旧问卷", "共享可变题目会产生联动修改", "问卷保存版本快照"],
        ["记录修改历史", "原集合只保留当前内容", "不可变版本链与派生来源"],
        ["恢复旧版本", "没有历史内容可恢复", "复制旧版本生成新当前版本"],
        ["版本同时存在", "一份问卷只能拥有自己的题", "同一根下保存 v1、v2、v3"],
        ["查看题目使用情况", "无法从题目反查问卷", "通过题目根关联题目快照"],
        ["单题跨问卷统计", "只能按单份问卷统计", "按题目根汇总多问卷答卷"],
    ],
    [4.3, 5.7, 5.8],
    size=8.5,
)

heading(doc, "三、总体设计", 1)
body(
    doc,
    "系统继续采用模块化单体结构。浏览器页面调用 Express JSON 接口，MongoDB 保存业务数据。"
    "新增题库模块与原有问卷模块共享身份认证，但题库数据、版本快照和答卷统计保持分层。"
)
figure(
    doc,
    ASSETS / "phase2-model.png",
    15.5,
    "图 1  第二阶段题目版本与问卷快照",
)
body(
    doc,
    "题目根负责回答“这是不是同一道题”，版本负责回答“这一版具体写了什么”，问卷题目快照负责回答"
    "“这份问卷当时用了什么”。三层职责分开后，共享、版本历史和历史答卷可以同时成立。"
)

heading(doc, "四、MongoDB 数据设计", 1, page_break=True)
add_table(
    doc,
    ["集合", "职责", "关键字段"],
    [
        ["users", "账号和身份", "_id、username、password_hash"],
        ["surveys", "问卷状态与基本设置", "owner_id、public_id、status"],
        ["questions", "问卷中的题目快照", "survey_id、order、题目内容、跳转规则"],
        ["responses", "答卷和答案", "survey_id、answers、submitted_at"],
        ["question_roots", "题目身份与共享", "owner_id、shared_with_user_ids、current_version_id"],
        ["question_versions", "不可变题目版本", "root_id、version_no、previous_version_id"],
        ["sessions", "登录 Session", "由 connect-mongo 管理"],
    ],
    [3.6, 5.5, 6.7],
    size=8.5,
)

heading(doc, "4.1 题目根", 2)
body(
    doc,
    "question_roots 是题目的稳定身份。它保存创建者、共享用户、是否加入题库、当前版本编号和"
    "当前版本 ID。问卷使用同一题目根的不同版本时，共享、使用情况查询和跨问卷统计都通过这个"
    "稳定身份关联。"
)

heading(doc, "4.2 题目版本", 2)
body(
    doc,
    "question_versions 保存题干、题型、选项、必答和校验条件。version_no 从 1 递增，"
    "previous_version_id 指向上一版本，derived_from_version_id 记录本次修改或恢复基于哪一版。"
    "版本文档创建后不更新，因此历史内容可以被准确读取。"
)

heading(doc, "4.3 问卷题目快照", 2)
body(
    doc,
    "原 questions 集合继续保存问卷自己的题目文档。新增 library_root_id、library_version_id 和"
    " derived_from_library_version_id 三个字段。问卷填写接口仍按 question_id 校验和保存答案，"
    "不需要修改已有答卷结构。"
)

heading(doc, "4.4 索引与迁移", 2)
add_table(
    doc,
    ["集合", "索引", "用途"],
    [
        ["question_versions", "{root_id, version_no} unique", "保证版本号不重复"],
        ["question_roots", "{owner_id, in_library, updated_at}", "个人题库列表"],
        ["question_roots", "{shared_with_user_ids, updated_at}", "共享题目查询"],
        ["questions", "{library_root_id, library_version_id}", "题目使用情况和快照来源"],
        ["responses", "{survey_id, answers.question_id}", "跨问卷统计"],
    ],
    [4.0, 6.4, 5.4],
    size=8.5,
)
body(
    doc,
    "应用启动时执行 migrateLegacyQuestions。迁移只处理没有 library_root_id 的旧题目，为每题建立"
    "题目根和 v1 版本，再写回快照关联。重复执行时不会重复建根。"
)

heading(doc, "五、题目库与共享", 1)
body(
    doc,
    "题目库页面支持新建单选、多选、文本和数字题。新建后生成题目根和 v1 版本，并加入当前用户题库。"
    "问卷草稿中的已有题目也可以选择加入题库。问卷编辑页通过题目和版本两个选择框把具体版本复制"
    "到当前问卷。"
)
body(
    doc,
    "共享按用户名完成。只有题目创建者可以添加或取消共享用户。共享用户获得读取题目、查看历史和在"
    "自己的问卷中使用题目的权限，但不能修改创建者的版本链。例如老师完成题库题目后共享给学生，"
    "学生可以直接在自己的问卷中选择该题。"
)

heading(doc, "六、版本历史与恢复", 1)
body(
    doc,
    "修改题库题目时，系统创建新版本，而不是覆盖当前版本。创建问卷题目快照时记录所选版本，"
    "因此 A 问卷可以继续引用 v1，B 问卷引用 v2。发布后的问卷不允许修改题目，已经写入的答案"
    "继续对应原来的 question_id。"
)
figure(
    doc,
    ASSETS / "phase2-versions.png",
    15.8,
    "图 2  版本链、恢复和问卷引用",
)
body(
    doc,
    "恢复旧版本采用“追加快照”的方式。恢复 v1 后生成 v3，v2 仍然存在于历史中，v3 记录"
    "derived_from_version_id=v1。这样既能把内容恢复到旧版本，也不会丢失恢复前的内容。"
)

heading(doc, "七、问卷兼容与快照隔离", 1)
body(
    doc,
    "问卷编辑页编辑题库题目时有两种选择。勾选“同时创建题库新版本”，系统生成新版本并让当前"
    "问卷引用它；不勾选且题目内容改变时，当前问卷转为独立副本，不会修改原题库。只修改跳转规则"
    "不会触发新版本，因为跳转属于问卷结构，不属于题库题目内容。"
)
body(
    doc,
    "该方案保留了第一阶段“发布后锁定题目”的约束，同时补充了草稿阶段的可复用题目。旧问卷"
    "读取自己的题目快照，不需要了解题库当前版本，因此兼容成本和运行风险都较低。"
)

heading(doc, "八、跨问卷统计", 1)
body(
    doc,
    "跨问卷统计从题目根开始，先找出所有引用该题的问卷题目快照，再限定当前用户拥有的问卷。"
    "答卷通过 answers.question_id 过滤，因此跳过的题不会进入回答人数。"
)
add_table(
    doc,
    ["题型", "统计内容", "说明"],
    [
        ["单选题", "回答人数、选项次数、百分比", "按选项文本合并版本"],
        ["多选题", "回答人数、每项选择次数", "先展开 answers，再展开 value"],
        ["数字题", "人数、平均值、最小值、最大值", "直接聚合数值"],
        ["文本题", "全部文本答案", "附带所属问卷和提交时间"],
    ],
    [3.4, 6.1, 6.3],
    size=9,
)
body(
    doc,
    "共享题目只统计当前用户自己的问卷。题目创建者可以查看哪些问卷使用了该题，但不会通过跨问卷"
    "统计看到其他用户详细答卷。该限制避免题库共享扩大数据访问范围。"
)

heading(doc, "九、API 与页面变化", 1)
add_table(
    doc,
    ["方法", "路径", "作用"],
    [
        ["GET", "/api/library/questions", "获取有权限的题目和版本"],
        ["POST", "/api/library/questions", "新建题库题目"],
        ["PATCH", "/api/library/questions/:id", "加入或移出题库"],
        ["POST", "/api/library/questions/:id/versions", "创建新版本"],
        ["POST", "/api/library/questions/:id/share", "共享给用户"],
        ["GET", "/api/library/questions/:id/usage", "查询使用问卷"],
        ["GET", "/api/library/questions/:id/stats", "跨问卷统计"],
        ["POST", "/api/surveys/:id/questions/from-library", "向问卷添加题目版本"],
    ],
    [2.0, 8.2, 5.6],
    size=8.5,
)
body(
    doc,
    "新增 questions.html 题目库页面；builder.html 增加题库选择器和版本更新选项。"
    "第一阶段页面和接口路径保持不变。"
)

heading(doc, "十、测试结果", 1, page_break=True)
body(
    doc,
    "测试使用 Node.js 自带 node:test，连接真实 MongoDB 测试库，每条用例结束后删除测试数据库。"
    "测试命令为 npm test。"
)
add_table(
    doc,
    ["测试范围", "主要验证", "结果"],
    [
        ["第一阶段回归", "注册、登录、问卷、题型、跳转、校验、填写和单问卷统计", "13 组通过"],
        ["题库创建", "创建题目根和 v1 版本", "通过"],
        ["问卷引用版本", "v1、v2 在不同问卷中独立存在", "通过"],
        ["共享权限", "共享用户可选题，不能修改原根", "通过"],
        ["历史恢复", "恢复 v1 生成 v3，不删除旧版本", "通过"],
        ["使用情况", "返回问卷、题号和引用版本", "通过"],
        ["跨问卷统计", "汇总两份问卷的数字答案", "通过"],
        ["兼容迁移", "旧题启动时关联题目根", "通过"],
    ],
    [4.2, 8.0, 3.6],
    size=8.5,
)
body(doc, "最终运行结果为 14 组测试通过、0 组失败，覆盖新增功能和第一阶段回归。")

heading(doc, "十一、兼容性与问题处理", 1)
heading(doc, "11.1 不能直接共享可变题目", 2)
body(
    doc,
    "最初如果让多个问卷直接保存同一个题目 ID，修改题库就会同步改变旧问卷。最终采用版本副本，"
    "问卷只引用快照，题库更新不写回旧问卷。"
)
heading(doc, "11.2 旧题目没有版本", 2)
body(
    doc,
    "现有数据中没有题目根和版本。应用启动迁移会为旧题创建 v1，保持题目字段和答卷关联不变；"
    "重复启动不会再次创建。"
)
heading(doc, "11.3 不同问卷选择不同版本", 2)
body(
    doc,
    "从题库添加题目时同时提交题目根 ID 和版本 ID。前端默认选择当前版本，也允许选择历史版本。"
    "后端再次校验版本确实属于该题目根。"
)
heading(doc, "11.4 恢复版本会不会覆盖当前内容", 2)
body(
    doc,
    "恢复操作不更新旧版本，而是复制旧版本内容生成新的当前版本。版本历史包含原有全部记录，"
    "因此可以追溯修改和恢复过程。"
)

heading(doc, "十二、AI 使用过程", 1, page_break=True)
body(
    doc,
    "第二阶段继续使用 Codex 辅助需求拆解、数据结构设计、接口和页面初稿、迁移脚本、测试和文档。"
    "用户提供完整需求变更文档，提出保持原 GitHub 仓库、沿用第一阶段成果并完成第二阶段提交材料。"
)
add_table(
    doc,
    ["阶段", "提示或任务", "AI 输出", "人工调整与验证"],
    [
        ["需求分析", "读取需求变更文档并对照第一阶段", "整理 8 项需求和题目版本方案", "确认必须保留原集合和旧答卷"],
        ["数据设计", "设计可复用题目与历史版本", "题目根、版本、问卷快照结构", "调整为快照隔离而非可变引用"],
        ["功能开发", "完成题库、共享、版本恢复和统计", "API、页面、迁移与测试", "限制共享用户不能修改原版本链"],
        ["验证", "保证第一阶段功能不退化", "14 组自动测试与接口验证", "修复测试期望和版本统计口径"],
    ],
    [2.8, 5.2, 4.5, 4.5],
    size=8.5,
)
body(
    doc,
    "AI 初稿的主要风险是把题目直接引用为共享可变对象，或者恢复版本时覆盖当前记录。最终设计保留"
    "不可变版本、问卷快照和追加快照式恢复，确保历史数据可解释。"
)

heading(doc, "十三、总结", 1)
body(
    doc,
    "第二阶段在不重写第一阶段系统的前提下，实现了可复用题目、共享、版本历史、版本恢复、"
    "问卷使用情况查询和跨问卷统计。题目根、题目版本与问卷快照的分层设计解决了复用和历史一致性"
    "之间的冲突。"
)
body(
    doc,
    "系统仍有可以继续扩展的部分，例如题库标签和分类、批量导入、题目版本差异对比，以及并发编辑"
    "同一题目的冲突提示。当前版本已经满足第二阶段提出的功能要求，并通过了第一阶段和第二阶段测试。"
)

heading(doc, "附录：运行与提交信息", 1)
code_block(
    doc,
    [
        "cd survey-mongodb",
        "npm install",
        "npm run migrate:phase2",
        "npm run seed        # 可选，写入演示数据",
        "npm test",
        "npm start",
    ],
)
body(
    doc,
    "GitHub 仓库："
    + GITHUB_URL
    + "。在线访问地址由 PUBLIC_ORIGIN 配置；当前演示地址和其他网络可访问的问卷填写链接"
    "均使用部署时的公网域名。"
)

doc.save(OUT)
print(OUT)
