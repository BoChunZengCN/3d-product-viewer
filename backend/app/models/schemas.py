from pydantic import BaseModel
from typing import Any, Optional, Literal


class TableStructure(BaseModel):
    headers: list[str]
    sampleRows: list[list[Any]]
    rowCount: int
    sheetName: str


class QueryRequest(BaseModel):
    query: str
    tableStructure: TableStructure
    data: list[list[Any]]


class TableResult(BaseModel):
    columns: list[str]
    rows: list[list[Any]]


class ChartDataPoint(BaseModel):
    name: str
    value: float


class ChartResult(BaseModel):
    type: Literal["bar", "pie", "line"]
    title: str
    data: list[ChartDataPoint]
    xAxis: Optional[list[str]] = None
    series: Optional[list[dict]] = None


class AnalysisResult(BaseModel):
    type: Literal["table", "chart", "number", "text", "error"]
    summary: str
    table: Optional[TableResult] = None
    chart: Optional[ChartResult] = None
    number: Optional[Any] = None
    code: Optional[str] = None
