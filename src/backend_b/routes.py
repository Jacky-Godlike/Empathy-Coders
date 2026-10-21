from io import BytesIO
from typing import Literal
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from .schemas import AnalyzeRequest, AnalyzeResponse, MessagesResponse, SuppliersResponse, ExportRequest
from .ai_service import analyze
from .connectors import MESSAGES, SUPPLIERS
from .export_service import generate_excel

router = APIRouter()

@router.get("/health")
def health():
    return {"status": "ok", "service": "backend_b"}

@router.get("/connectors/messages", response_model=MessagesResponse)
def messages(source: Literal["all", "whatsapp", "email"] = "all", limit: int = Query(50, ge=1, le=100)):
    selected = [m for m in MESSAGES if source == "all" or m.source == source]
    return MessagesResponse(messages=selected[:limit], total=len(selected))

@router.get("/connectors/suppliers", response_model=SuppliersResponse)
def suppliers():
    return SuppliersResponse(suppliers=SUPPLIERS, total=len(SUPPLIERS))

@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_route(payload: AnalyzeRequest):
    return await analyze(payload)

@router.post("/export", responses={200: {"content": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {}}}})
def export_route(payload: ExportRequest):
    content = generate_excel(payload.orders)
    return StreamingResponse(BytesIO(content), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="orders.xlsx"'})
