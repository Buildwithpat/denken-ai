from fastapi import APIRouter

from app.schemas.notes import NotesRequest, NotesResponse
from app.services.notes_service import generate_notes

router = APIRouter(prefix="/generate-notes", tags=["Notes"])


@router.post(
    "",
    response_model=NotesResponse,
    summary="Generate structured study notes",
    description=(
        "Returns AI-generated (or mock) structured notes for a given topic. "
        "Sections, formulas, and depth adapt to the `depth` and `mode` fields."
    ),
)
def notes_endpoint(req: NotesRequest) -> NotesResponse:
    return generate_notes(req)
