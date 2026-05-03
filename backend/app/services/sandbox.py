import re
import pandas as pd
import numpy as np
from RestrictedPython import compile_restricted, safe_globals, safe_builtins
from RestrictedPython.Guards import safe_iter_unpack_sequence

FORBIDDEN_PATTERNS = [
    r'\bimport\s+os\b',
    r'\bimport\s+sys\b',
    r'\bimport\s+subprocess\b',
    r'\bimport\s+socket\b',
    r'\bopen\s*\(',
    r'\beval\s*\(',
    r'\bexec\s*\(',
    r'__import__',
]


def _check_forbidden(code: str) -> None:
    for pattern in FORBIDDEN_PATTERNS:
        if re.search(pattern, code):
            raise ValueError(f"禁止使用的操作: {pattern}")


def execute_safe(code: str, df: pd.DataFrame) -> dict:
    """在受限环境中执行 AI 生成的 Pandas 代码"""
    _check_forbidden(code)

    restricted_globals = {
        **safe_globals,
        "__builtins__": {
            **safe_builtins,
            "len": len,
            "range": range,
            "list": list,
            "dict": dict,
            "str": str,
            "int": int,
            "float": float,
            "bool": bool,
            "sum": sum,
            "max": max,
            "min": min,
            "round": round,
            "abs": abs,
            "sorted": sorted,
            "enumerate": enumerate,
            "zip": zip,
            "print": print,
        },
        "_getiter_": iter,
        "_getattr_": getattr,
        "_inplacevar_": lambda op, x, y: x + y if op == "+=" else x,
        "_iter_unpack_sequence_": safe_iter_unpack_sequence,
        "pd": pd,
        "np": np,
    }

    local_vars: dict = {"df": df.copy(), "result": None}

    try:
        byte_code = compile_restricted(code, "<ai_generated>", "exec")
        exec(byte_code, restricted_globals, local_vars)  # noqa: S102
        return {"success": True, "result": local_vars.get("result")}
    except Exception as e:
        return {"success": False, "error": str(e)}
