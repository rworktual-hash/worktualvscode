# backend/endpoints/generate.py
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from ..models.request_models import FigmaGenerateRequest
from ..utils.ai_client import generate_figma_design

router = APIRouter()

@router.post("/generate-figma", response_class=JSONResponse)
async def generate_figma(request: FigmaGenerateRequest):
    try:
        # 👇 This is your prompt part
        prompt = request.prompt  
        print("Received prompt:", prompt)

        # Send prompt to AI model
        figma_json = await generate_figma_design(prompt)

        return {"success": True, "figma_json": figma_json}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
