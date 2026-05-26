from fastapi import APIRouter

from app.schemas.performance import PerformanceRequest, PerformanceResponse
from app.services.performance_service import analyze_performance

router = APIRouter(prefix="/analyze-performance", tags=["Performance"])


@router.post(
    "",
    response_model=PerformanceResponse,
    summary="Analyze student performance and generate recommendations",
    description=(
        "Takes subject-wise accuracy, weak topics, and question-type breakdown, "
        "then returns strengths, weaknesses, prioritised recommendations, and a study focus."
    ),
)
def performance_endpoint(req: PerformanceRequest) -> PerformanceResponse:
    return analyze_performance(req)
