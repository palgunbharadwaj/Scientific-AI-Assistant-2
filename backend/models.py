from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


class UserRole(str, Enum):
    doctor = "doctor"
    researcher = "researcher"
    admin = "admin"


# ─── Auth Models ────────────────────────────────────────────────────────────

class UserLogin(BaseModel):
    username: str
    password: str
    role: UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    username: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[UserRole] = None


# ─── Query Models ────────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="The scientific query from the user")
    agent: Optional[Literal["CRA", "DDRA", "DPEA", "PDRA", "auto"]] = "auto"


class QueryResponse(BaseModel):
    agent_used: str
    result: dict
    flagged_high_risk: bool = False
    pending_admin_approval: bool = False
    message: Optional[str] = None


# ─── Admin Approval Models ───────────────────────────────────────────────────

class PendingApproval(BaseModel):
    approval_id: str
    query: str
    agent: str
    result: dict
    risk_reason: str


class ApprovalDecision(BaseModel):
    approval_id: str
    approved: bool
    admin_note: Optional[str] = None


class ElementInsightRequest(BaseModel):
    atomic_number: int
    element_name: str

