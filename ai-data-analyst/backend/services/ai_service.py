"""
Claude Tool Use orchestration.
Sends table metadata + user query to Claude, receives a tool_use response,
dispatches to analysis_tools, and returns a normalized result.
"""
from __future__ import annotations
import json
import os
from typing import Any

import anthropic
import pandas as pd

from .analysis_tools import dispatch

# ── Claude tool schemas ───────────────────────────────────────────────────────

CLAUDE_TOOLS: list[dict] = [
    {
        "name": "group_aggregate",
        "description": "按某列分组，对另一列做聚合统计（求和/平均/计数/最大/最小/中位数），适合"按X统计Y"类问题",
        "input_schema": {
            "type": "object",
            "properties": {
                "group_col": {"type": "string", "description": "用于分组的列名"},
                "value_col": {"type": "string", "description": "用于聚合的数值列名"},
                "agg_func": {
                    "type": "string",
                    "enum": ["sum", "mean", "count", "max", "min", "median"],
                    "description": "聚合函数：sum=求和, mean=平均, count=计数, max=最大, min=最小, median=中位数",
                },
                "chart_type": {
                    "type": "string",
                    "enum": ["bar", "line", "pie"],
                    "description": "图表类型，默认bar柱状图",
                },
            },
            "required": ["group_col", "value_col", "agg_func"],
        },
    },
    {
        "name": "filter_rows",
        "description": "按条件筛选数据行，返回满足条件的记录列表",
        "input_schema": {
            "type": "object",
            "properties": {
                "column": {"type": "string", "description": "筛选条件所在列名"},
                "operator": {
                    "type": "string",
                    "enum": ["==", "!=", ">", ">=", "<", "<=", "contains"],
                    "description": "比较运算符，contains表示字符串包含",
                },
                "value": {"description": "比较的目标值"},
            },
            "required": ["column", "operator", "value"],
        },
    },
    {
        "name": "rank_top_n",
        "description": "按某数值列排序，返回最大或最小的前N条记录",
        "input_schema": {
            "type": "object",
            "properties": {
                "column": {"type": "string", "description": "用于排序的数值列名"},
                "n": {"type": "integer", "description": "返回记录数，默认10", "default": 10},
                "ascending": {
                    "type": "boolean",
                    "description": "true=从小到大（最小N条），false=从大到小（最大N条），默认false",
                    "default": False,
                },
            },
            "required": ["column"],
        },
    },
    {
        "name": "calculate_statistics",
        "description": "计算数值列的描述性统计（数量、均值、标准差、最小值、中位数、最大值）",
        "input_schema": {
            "type": "object",
            "properties": {
                "columns": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "要统计的列名列表，不填则统计所有数值列",
                }
            },
            "required": [],
        },
    },
    {
        "name": "count_distribution",
        "description": "统计某列各个值出现的频次/比例分布，适合分析分类数据",
        "input_schema": {
            "type": "object",
            "properties": {
                "column": {"type": "string", "description": "要统计分布的列名"},
                "chart_type": {
                    "type": "string",
                    "enum": ["pie", "bar"],
                    "description": "图表类型：pie=饼图（默认），bar=柱状图",
                    "default": "pie",
                },
            },
            "required": ["column"],
        },
    },
    {
        "name": "cross_tabulation",
        "description": "生成两个分类列的交叉分析表（透视表），展示两个维度的交叉统计",
        "input_schema": {
            "type": "object",
            "properties": {
                "row_col": {"type": "string", "description": "行维度列名"},
                "col_col": {"type": "string", "description": "列维度列名"},
                "value_col": {
                    "type": "string",
                    "description": "值列名（可选，不填则计数）",
                },
                "agg_func": {
                    "type": "string",
                    "enum": ["sum", "mean", "count"],
                    "description": "聚合函数，默认count",
                    "default": "count",
                },
            },
            "required": ["row_col", "col_col"],
        },
    },
]


# ── DataFrame builder ─────────────────────────────────────────────────────────

def build_dataframe(table_data: dict) -> pd.DataFrame:
    """Reconstruct a DataFrame from the JSON table_data payload."""
    df = pd.DataFrame(table_data["rows"], columns=table_data["headers"])
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="ignore")
    return df


def _infer_dtypes(df: pd.DataFrame) -> dict[str, str]:
    result = {}
    for col in df.columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            result[col] = "数值"
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            result[col] = "日期"
        else:
            result[col] = "文本"
    return result


# ── system prompt ─────────────────────────────────────────────────────────────

def _build_system_prompt(table_data: dict, df: pd.DataFrame) -> str:
    dtypes = _infer_dtypes(df)
    preview_rows = df.head(5).fillna("").to_string(index=False)

    dtype_str = "\n".join(f"  - {col}: {dtype}" for col, dtype in dtypes.items())

    return f"""你是一个专业的Excel数据分析助手，使用中文回复用户。

当前数据表信息：
- 表名: {table_data.get('sheet_name', 'Sheet1')}
- 总行数: {table_data.get('row_count', len(df))}
- 总列数: {table_data.get('col_count', len(df.columns))}
- 列名与类型:
{dtype_str}

前5行数据预览:
{preview_rows}

重要规则：
1. 列名严格区分大小写，必须使用上述列表中完全一致的列名
2. 你必须调用提供的工具函数来完成分析，不要直接回答数字
3. 如果用户的问题无法用现有工具处理，请用文字解释原因，不要强行调用工具
4. 参数中的列名必须完全匹配上面列出的列名"""


# ── main query function ───────────────────────────────────────────────────────

def query(table_data: dict, user_query: str) -> dict:
    """
    Send user_query + table metadata to Claude, execute the selected tool,
    and return the normalized result dict.
    """
    model = os.getenv("MODEL_NAME", "claude-sonnet-4-6")
    df = build_dataframe(table_data)
    system_prompt = _build_system_prompt(table_data, df)

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=system_prompt,
        tools=CLAUDE_TOOLS,
        messages=[{"role": "user", "content": user_query}],
    )

    # Case 1: Claude chose a tool
    if response.stop_reason == "tool_use":
        tool_block = next(b for b in response.content if b.type == "tool_use")
        tool_name = tool_block.name
        tool_input = tool_block.input

        try:
            result = dispatch(tool_name, df, tool_input)
            result["success"] = True
            return result
        except ValueError as e:
            return {"success": False, "error": str(e), "error_code": "TOOL_PARAM_ERROR"}
        except Exception as e:
            return {"success": False, "error": f"计算出错：{str(e)}", "error_code": "EXEC_ERROR"}

    # Case 2: Claude replied with text (query out of scope or clarification needed)
    text_content = next(
        (b.text for b in response.content if hasattr(b, "text")), "无法处理该查询"
    )
    return {
        "success": True,
        "result_type": "text",
        "data": None,
        "chart_config": None,
        "summary": text_content,
    }
