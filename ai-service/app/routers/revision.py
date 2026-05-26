from fastapi import APIRouter

from app.schemas.revision import RevisionRequest, RevisionResponse
from app.services.revision_service import generate_revision

router = APIRouter(prefix="/generate-revision", tags=["Revision"])


@router.post(
    "",
    response_model=RevisionResponse,
    summary="Generate a priority-based revision plan",
    description=(
        "Accepts a list of weak topics with accuracy scores and returns a "
        "day-by-day revision schedule with mode-specific focus points."
    ),
)
def revision_endpoint(req: RevisionRequest) -> RevisionResponse:
    return generate_revision(req)
