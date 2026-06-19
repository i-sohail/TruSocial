from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.models import Company
from app.schemas import CompanySchema

router = APIRouter()


def _row_to_out(row: Company) -> CompanySchema:
    return CompanySchema(
        name=row.name, industry=row.industry, description=row.description,
        website=row.website, products=row.products, services=row.services,
        target_audience=row.target_audience, brand_voice=row.brand_voice,
        brand_colors=row.brand_colors or ["#6C63FF", "#00D1B2"],
        company_size=row.company_size, competitors=row.competitors,
        keywords=row.keywords, tone=row.tone, approval_mode=row.approval_mode,
        brand_guidelines=row.brand_guidelines,
        platforms=row.platforms or {"linkedin": True, "instagram": True, "facebook": False, "x": False},
        schedule=row.schedule or {},
    )


@router.get("", response_model=CompanySchema)
def get_company(db: Session = Depends(get_db)):
    return _row_to_out(db.get(Company, 1))


@router.put("", response_model=CompanySchema)
def update_company(body: CompanySchema, db: Session = Depends(get_db)):
    row = db.get(Company, 1)
    row.name = body.name
    row.industry = body.industry
    row.description = body.description
    row.website = body.website
    row.products = body.products
    row.services = body.services
    row.target_audience = body.target_audience
    row.brand_voice = body.brand_voice
    row.brand_colors = body.brand_colors
    row.company_size = body.company_size
    row.competitors = body.competitors
    row.keywords = body.keywords
    row.tone = body.tone
    row.approval_mode = body.approval_mode
    row.brand_guidelines = body.brand_guidelines
    row.platforms = body.platforms
    row.schedule = body.schedule
    db.commit()
    return _row_to_out(row)
