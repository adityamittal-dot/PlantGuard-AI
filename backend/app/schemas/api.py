from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(APIModel):
    id: str
    email: EmailStr
    full_name: str
    role: str
    is_verified: bool
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None


class ImageOut(APIModel):
    id: str
    filename: str
    mime_type: str
    file_size: int
    width: Optional[int] = None
    height: Optional[int] = None
    quality_score: Optional[float] = None
    url: Optional[str] = None
    created_at: datetime


class PredictionOut(APIModel):
    id: str
    label: str
    probability: float
    rank: int
    disease_id: Optional[str] = None


class RecommendationOut(APIModel):
    id: str
    title: str
    description: str
    priority: str
    category: str
    source_metadata: Optional[dict[str, Any]] = None


class SeverityOut(APIModel):
    severity_score: float
    severity_label: str
    method: str


class ExplanationOut(APIModel):
    method: str
    heatmap_url: Optional[str] = None
    mask_url: Optional[str] = None
    disclaimer: str = (
        "Highlighted areas contributed most strongly to the model prediction. "
        "This does not prove a pathogen is present."
    )


class DiagnosisCreate(BaseModel):
    image_id: str
    crop_id: Optional[str] = None


class DiagnosisOut(APIModel):
    id: str
    status: str
    job_stage: Optional[str] = None
    overall_confidence: Optional[float] = None
    inference_time_ms: Optional[float] = None
    quality_status: Optional[str] = None
    quality_messages: Optional[list[str]] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    image_id: str
    crop_id: Optional[str] = None
    model_version_id: Optional[str] = None
    created_at: datetime
    predictions: list[PredictionOut] = []
    recommendations: list[RecommendationOut] = []
    severity: Optional[SeverityOut] = None
    explanation: Optional[ExplanationOut] = None
    image_url: Optional[str] = None
    scientific_note: str = (
        "Output is a visual pathogen-category assessment "
        "(Bacteria, Fungi, Healthy, Pests, or Virus)—not laboratory-confirmed "
        "species-level pathogen identification."
    )


class DiseaseOut(APIModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    pathogen_type: Optional[str] = None
    pathogen_name: Optional[str] = None
    symptoms: Optional[str] = None
    cause: Optional[str] = None
    prevention: Optional[str] = None
    management_notes: Optional[str] = None
    source_metadata: Optional[dict[str, Any]] = None


class CropOut(APIModel):
    id: str
    name: str
    slug: str
    scientific_name: Optional[str] = None
    description: Optional[str] = None


class AnalyticsOverview(BaseModel):
    total_diagnoses: int
    healthy_detections: int
    diseased_detections: int
    average_confidence: float
    completed_diagnoses: int
    failed_diagnoses: int


class JobOut(BaseModel):
    job_id: str
    diagnosis_id: str
    status: str
    stage: Optional[str] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None


class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
