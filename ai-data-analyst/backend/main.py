from __future__ import annotations
import os
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from services.ai_service import query as ai_query

load_dotenv()

# ── lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("⚠️  警告：未设置 ANTHROPIC_API_KEY，AI 查询功能将不可用")
    yield


app = FastAPI(title="AI 数据分析大师 API", version="1.0.0", lifespan=lifespan)

# ── CORS ──────────────────────────────────────────────────────────────────────

origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000")
allowed_origins = [o.strip() for o in origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── request / response models ─────────────────────────────────────────────────

class TableData(BaseModel):
    headers: list[str]
    rows: list[list[Any]]
    sheet_name: str = "Sheet1"
    row_count: int
    col_count: int

    @field_validator("headers")
    @classmethod
    def headers_not_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("数据表必须包含列标题")
        return v


class QueryRequest(BaseModel):
    table_data: TableData
    query: str

    @field_validator("query")
    @classmethod
    def query_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("查询内容不能为空")
        return v.strip()


# ── routes ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/api/query")
async def handle_query(req: QueryRequest):
    if not os.getenv("ANTHROPIC_API_KEY"):
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY 未配置，请联系管理员")

    max_rows = int(os.getenv("MAX_ROWS_TO_SEND", "500"))

    table_dict = {
        "headers": req.table_data.headers,
        "rows": req.table_data.rows[:max_rows],
        "sheet_name": req.table_data.sheet_name,
        "row_count": req.table_data.row_count,
        "col_count": req.table_data.col_count,
    }

    try:
        result = ai_query(table_dict, req.query)
        return result
    except Exception as e:
        return {"success": False, "error": f"服务器内部错误：{str(e)}", "error_code": "SERVER_ERROR"}
