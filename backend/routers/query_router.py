from fastapi import APIRouter, Depends

from typing import Optional
from backend.auth import get_optional_user, require_role
from backend.models import QueryRequest, QueryResponse, TokenData, UserRole
from backend.services.orchestrator import orchestrate

router = APIRouter(prefix="/query", tags=["Query"])


@router.post("/", response_model=QueryResponse)
async def submit_query(
    request: QueryRequest,
    current_user: Optional[TokenData] = Depends(get_optional_user),
):
    """Submit a scientific query. Routes to CRA, DDRA, or DPEA automatically."""
    from fastapi import HTTPException
    if current_user and current_user.role == UserRole.admin:
        raise HTTPException(status_code=403, detail="Admins cannot submit queries.")
        
    user_for_orch = current_user or TokenData(username="guest", role=UserRole.researcher)
    
    try:
        response = await orchestrate(
            query=request.query,
            agent_hint=request.agent,
            user=user_for_orch,
        )
        return response
    except Exception as e:
        import traceback
        print(f"Query Error: {traceback.format_exc()}")
        return QueryResponse(
            agent_used="orchestrator",
            result={"summary": f"A system error occurred during synthesis: {str(e)}", "status": "error"},
            message="Internal Server Error"
        )


@router.post("/element-insight")
async def get_element_insight(request: QueryRequest):
    """
    Dedicated endpoint for the periodic table side panel.
    Returns a dynamic AI insight for a specific element.
    """
    from backend.services.gemini_service import get_element_research_insight
    import re
    
    # Extract name and number from query string if needed, 
    # but the frontend will send it in a specific format for this route.
    # Pattern expected: "Analyze element [NAME] with atomic number [NUM]"
    try:
        match = re.search(r"Analyze element (\w+) with atomic number (\d+)", request.query)
        if match:
            name = match.group(1)
            at_num = int(match.group(2))
        else:
            return {"insight": "Scientific context resolution failed."}

        insight = await get_element_research_insight(at_num, name)
        return {"insight": insight}
    except Exception:
        return {"insight": "Research synthesis unavailable."}

