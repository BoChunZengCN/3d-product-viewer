from fastapi import APIRouter, HTTPException
from ..models.schemas import QueryRequest, AnalysisResult
from ..services.ai_service import analyze

router = APIRouter(prefix="/api")


@router.post("/query", response_model=AnalysisResult)
async def query_endpoint(req: QueryRequest) -> AnalysisResult:
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="查询内容不能为空")
    if not req.tableStructure.headers:
        raise HTTPException(status_code=400, detail="表格结构不能为空")

    try:
        return await analyze(req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "DataMaster API"}
