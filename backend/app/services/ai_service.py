import json
import re
import math
import pandas as pd
import anthropic
from ..models.schemas import (
    QueryRequest, AnalysisResult, TableResult,
    ChartResult, ChartDataPoint,
)
from .sandbox import execute_safe

client = anthropic.Anthropic()

SYSTEM_PROMPT = """你是一个专业的数据分析助手，帮助用户分析 Excel 表格数据。

你的任务是：
1. 理解用户的中文分析需求
2. 生成安全的 Pandas 代码来完成计算（假设 DataFrame 变量名为 df，结果赋值给 result）
3. 以 JSON 格式返回分析结果

返回格式（严格 JSON，不要 markdown 代码块）：
{
  "code": "pandas代码字符串",
  "result_type": "table|chart|number|text",
  "chart_type": "bar|pie|line",  // 仅当 result_type 为 chart 时
  "chart_title": "图表标题",
  "summary": "用中文描述结果的一句话"
}

代码规范：
- 只能使用 pandas 和 numpy
- 结果必须赋值给 result 变量
- 如果结果是数字，result = 数值
- 如果结果是表格，result = DataFrame 或 dict
- 禁止使用 os/sys/subprocess/open/eval/exec
"""


def _sanitize_float(val):
    """将 NaN/Inf 替换为 None，以便 JSON 序列化"""
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def _df_to_table(df: pd.DataFrame) -> TableResult:
    cols = [str(c) for c in df.columns]
    rows = []
    for _, row in df.iterrows():
        rows.append([_sanitize_float(v) if not isinstance(v, str) else v for v in row.tolist()])
    return TableResult(columns=cols, rows=rows)


def _infer_chart_data(result, chart_type: str, chart_title: str) -> ChartResult:
    """从 result 推断图表数据"""
    data_points: list[ChartDataPoint] = []

    if isinstance(result, dict):
        data_points = [ChartDataPoint(name=str(k), value=float(v)) for k, v in result.items()]
    elif isinstance(result, pd.Series):
        data_points = [ChartDataPoint(name=str(k), value=float(v)) for k, v in result.items()]
    elif isinstance(result, pd.DataFrame) and len(result.columns) >= 2:
        name_col = result.columns[0]
        val_col = result.columns[1]
        data_points = [
            ChartDataPoint(name=str(row[name_col]), value=float(row[val_col]))
            for _, row in result.iterrows()
        ]

    return ChartResult(
        type=chart_type if chart_type in ("bar", "pie", "line") else "bar",
        title=chart_title,
        data=data_points,
        xAxis=[d.name for d in data_points] if chart_type != "pie" else None,
    )


async def analyze(req: QueryRequest) -> AnalysisResult:
    structure_summary = {
        "sheet": req.tableStructure.sheetName,
        "columns": req.tableStructure.headers,
        "row_count": req.tableStructure.rowCount,
        "sample": req.tableStructure.sampleRows[:3],
    }

    user_prompt = f"""数据结构：
{json.dumps(structure_summary, ensure_ascii=False, indent=2)}

用户需求：{req.query}
"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = response.content[0].text.strip()

    # 去除可能的 markdown fence
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    ai_resp = json.loads(raw)
    code: str = ai_resp.get("code", "")
    result_type: str = ai_resp.get("result_type", "text")
    chart_type: str = ai_resp.get("chart_type", "bar")
    chart_title: str = ai_resp.get("chart_title", req.query)
    summary: str = ai_resp.get("summary", "分析完成")

    if not code:
        return AnalysisResult(type="text", summary=summary, code=code)

    # 构建 DataFrame
    df = pd.DataFrame(req.data, columns=req.tableStructure.headers)

    exec_result = execute_safe(code, df)

    if not exec_result["success"]:
        return AnalysisResult(
            type="error",
            summary=f"计算出错：{exec_result['error']}",
            code=code,
        )

    raw_result = exec_result["result"]

    if result_type == "number" or isinstance(raw_result, (int, float)):
        val = _sanitize_float(float(raw_result)) if isinstance(raw_result, (int, float)) else raw_result
        return AnalysisResult(type="number", summary=summary, number=val, code=code)

    if result_type == "chart":
        chart = _infer_chart_data(raw_result, chart_type, chart_title)
        table: TableResult | None = None
        if isinstance(raw_result, pd.DataFrame):
            table = _df_to_table(raw_result)
        return AnalysisResult(type="chart", summary=summary, chart=chart, table=table, code=code)

    if result_type == "table" or isinstance(raw_result, (pd.DataFrame, pd.Series)):
        if isinstance(raw_result, pd.Series):
            raw_result = raw_result.reset_index()
            raw_result.columns = ["分类", "值"]
        if isinstance(raw_result, pd.DataFrame):
            return AnalysisResult(type="table", summary=summary, table=_df_to_table(raw_result), code=code)

    return AnalysisResult(type="text", summary=str(raw_result) if raw_result is not None else summary, code=code)
