"""
Deterministic Pandas analysis functions invoked via Claude Tool Use.
Each function receives a DataFrame and structured parameters, returns
a normalized result dict with headers/rows plus chart metadata.
"""
from __future__ import annotations
import pandas as pd
import numpy as np
from typing import Any


# ── helpers ──────────────────────────────────────────────────────────────────

def _to_serializable(value: Any) -> Any:
    """Convert numpy scalars to Python native types for JSON serialization."""
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if pd.isna(value):
        return None
    return value


def _df_to_result(df: pd.DataFrame) -> dict:
    headers = [str(c) for c in df.columns]
    rows = [
        [_to_serializable(v) for v in row]
        for row in df.itertuples(index=False, name=None)
    ]
    return {"headers": headers, "rows": rows}


def _round_floats(rows: list, decimals: int = 2) -> list:
    def _r(v):
        if isinstance(v, float):
            return round(v, decimals)
        return v
    return [[_r(v) for v in row] for row in rows]


# ── tool implementations ──────────────────────────────────────────────────────

def group_aggregate(
    df: pd.DataFrame,
    group_col: str,
    value_col: str,
    agg_func: str,
    chart_type: str = "bar",
) -> dict:
    """Group by group_col and aggregate value_col with agg_func (sum/mean/count/max/min)."""
    ALLOWED = {"sum", "mean", "count", "max", "min", "median"}
    if agg_func not in ALLOWED:
        raise ValueError(f"agg_func 必须是 {ALLOWED} 之一，收到: {agg_func}")
    if group_col not in df.columns:
        raise ValueError(f"列 '{group_col}' 不存在，可用列: {list(df.columns)}")
    if value_col not in df.columns:
        raise ValueError(f"列 '{value_col}' 不存在，可用列: {list(df.columns)}")

    grouped = df.groupby(group_col)[value_col].agg(agg_func).reset_index()
    grouped.columns = [group_col, f"{value_col}_{agg_func}"]
    grouped = grouped.sort_values(grouped.columns[1], ascending=False)

    result = _df_to_result(grouped)
    result["rows"] = _round_floats(result["rows"])

    label_map = {"sum": "总计", "mean": "平均", "count": "数量", "max": "最大值", "min": "最小值", "median": "中位数"}
    title = f"按{group_col}分组的{value_col}{label_map.get(agg_func, agg_func)}"

    x_axis = [str(row[0]) for row in result["rows"]]
    series_data = [row[1] for row in result["rows"]]

    summary_top = result["rows"][0] if result["rows"] else None
    summary = (
        f"共 {len(result['rows'])} 个分组，"
        f"{summary_top[0]} 的{label_map.get(agg_func, agg_func)}最高（{summary_top[1]}）"
        if summary_top else "无数据"
    )

    return {
        "result_type": "chart",
        "data": result,
        "chart_config": {
            "type": chart_type,
            "title": title,
            "x_axis": x_axis,
            "series": [{"name": result["headers"][1], "data": series_data}],
        },
        "summary": summary,
    }


def filter_rows(
    df: pd.DataFrame,
    column: str,
    operator: str,
    value: Any,
) -> dict:
    """Filter rows where column <operator> value. Operators: ==, !=, >, >=, <, <=, contains."""
    if column not in df.columns:
        raise ValueError(f"列 '{column}' 不存在，可用列: {list(df.columns)}")

    col = df[column]
    if operator == "==":
        mask = col == value
    elif operator == "!=":
        mask = col != value
    elif operator == ">":
        mask = pd.to_numeric(col, errors="coerce") > float(value)
    elif operator == ">=":
        mask = pd.to_numeric(col, errors="coerce") >= float(value)
    elif operator == "<":
        mask = pd.to_numeric(col, errors="coerce") < float(value)
    elif operator == "<=":
        mask = pd.to_numeric(col, errors="coerce") <= float(value)
    elif operator == "contains":
        mask = col.astype(str).str.contains(str(value), na=False)
    else:
        raise ValueError(f"不支持的操作符: {operator}")

    filtered = df[mask].reset_index(drop=True)
    result = _df_to_result(filtered)
    result["rows"] = _round_floats(result["rows"])

    summary = f"筛选条件「{column} {operator} {value}」，共找到 {len(filtered)} 行数据"
    return {
        "result_type": "table",
        "data": result,
        "chart_config": None,
        "summary": summary,
    }


def rank_top_n(
    df: pd.DataFrame,
    column: str,
    n: int = 10,
    ascending: bool = False,
) -> dict:
    """Return top/bottom N rows sorted by column."""
    if column not in df.columns:
        raise ValueError(f"列 '{column}' 不存在，可用列: {list(df.columns)}")

    numeric_col = pd.to_numeric(df[column], errors="coerce")
    sorted_df = df.copy()
    sorted_df[column] = numeric_col
    sorted_df = sorted_df.dropna(subset=[column]).sort_values(column, ascending=ascending).head(n).reset_index(drop=True)

    result = _df_to_result(sorted_df)
    result["rows"] = _round_floats(result["rows"])

    direction = "最小" if ascending else "最大"
    summary = f"{column} {direction} 的前 {len(sorted_df)} 条数据"

    col_idx = list(sorted_df.columns).index(column)
    x_axis = [str(row[0]) for row in result["rows"]]
    series_data = [row[col_idx] for row in result["rows"]]

    return {
        "result_type": "chart",
        "data": result,
        "chart_config": {
            "type": "bar",
            "title": summary,
            "x_axis": x_axis,
            "series": [{"name": column, "data": series_data}],
        },
        "summary": summary,
    }


def calculate_statistics(
    df: pd.DataFrame,
    columns: list[str] | None = None,
) -> dict:
    """Compute descriptive statistics (count, mean, std, min, max, median) for numeric columns."""
    target_cols = columns if columns else df.select_dtypes(include="number").columns.tolist()
    invalid = [c for c in target_cols if c not in df.columns]
    if invalid:
        raise ValueError(f"列不存在: {invalid}，可用列: {list(df.columns)}")

    stats = df[target_cols].describe().T[["count", "mean", "std", "min", "50%", "max"]]
    stats = stats.rename(columns={"50%": "中位数", "mean": "平均值", "std": "标准差", "min": "最小值", "max": "最大值", "count": "数量"})
    stats = stats.reset_index().rename(columns={"index": "列名"})
    stats = stats.round(2)

    result = _df_to_result(stats)
    summary = f"对 {len(target_cols)} 个数值列进行描述性统计"
    return {
        "result_type": "table",
        "data": result,
        "chart_config": None,
        "summary": summary,
    }


def count_distribution(
    df: pd.DataFrame,
    column: str,
    chart_type: str = "pie",
) -> dict:
    """Count frequency distribution of a categorical column."""
    if column not in df.columns:
        raise ValueError(f"列 '{column}' 不存在，可用列: {list(df.columns)}")

    counts = df[column].value_counts().reset_index()
    counts.columns = [column, "频次"]

    result = _df_to_result(counts)
    total = counts["频次"].sum()
    summary = f"'{column}' 共有 {len(counts)} 个不同值，总计 {total} 条记录"

    if chart_type == "pie":
        series = [{"name": str(row[0]), "value": int(row[1])} for row in result["rows"]]
        chart_config = {"type": "pie", "title": f"{column}分布", "series": series}
    else:
        x_axis = [str(row[0]) for row in result["rows"]]
        series_data = [row[1] for row in result["rows"]]
        chart_config = {
            "type": chart_type,
            "title": f"{column}频次分布",
            "x_axis": x_axis,
            "series": [{"name": "频次", "data": series_data}],
        }

    return {
        "result_type": "chart",
        "data": result,
        "chart_config": chart_config,
        "summary": summary,
    }


def cross_tabulation(
    df: pd.DataFrame,
    row_col: str,
    col_col: str,
    value_col: str | None = None,
    agg_func: str = "count",
) -> dict:
    """Create a cross-tabulation (pivot table) between two categorical columns."""
    for c in [row_col, col_col]:
        if c not in df.columns:
            raise ValueError(f"列 '{c}' 不存在，可用列: {list(df.columns)}")

    if value_col and value_col not in df.columns:
        raise ValueError(f"值列 '{value_col}' 不存在，可用列: {list(df.columns)}")

    if value_col:
        pivot = pd.pivot_table(
            df, values=value_col, index=row_col, columns=col_col,
            aggfunc=agg_func, fill_value=0
        )
    else:
        pivot = pd.crosstab(df[row_col], df[col_col])

    pivot = pivot.reset_index()
    pivot.columns = [str(c) for c in pivot.columns]

    result = _df_to_result(pivot)
    result["rows"] = _round_floats(result["rows"])
    summary = f"'{row_col}' × '{col_col}' 交叉分析表，共 {len(pivot)} 行"
    return {
        "result_type": "table",
        "data": result,
        "chart_config": None,
        "summary": summary,
    }


# ── dispatcher ────────────────────────────────────────────────────────────────

TOOL_REGISTRY = {
    "group_aggregate": group_aggregate,
    "filter_rows": filter_rows,
    "rank_top_n": rank_top_n,
    "calculate_statistics": calculate_statistics,
    "count_distribution": count_distribution,
    "cross_tabulation": cross_tabulation,
}


def dispatch(tool_name: str, df: pd.DataFrame, tool_input: dict) -> dict:
    """Dispatch a tool call from Claude to the appropriate analysis function."""
    if tool_name not in TOOL_REGISTRY:
        raise ValueError(f"未知工具: {tool_name}")
    return TOOL_REGISTRY[tool_name](df, **tool_input)
