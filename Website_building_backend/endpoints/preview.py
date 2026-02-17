from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
import os

router = APIRouter()

@router.get("/generated/index.html", response_class=HTMLResponse)
async def get_preview():
    html_path = "generated/index.html"
    if not os.path.exists(html_path):
        raise HTTPException(status_code=404, detail="Preview not found")
    with open(html_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@router.get("/download", response_class=FileResponse)
async def download_zip():
    zip_path = "generated.zip"
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="No ZIP found. Generate website first.")
    return FileResponse(zip_path, filename="generated.zip", media_type="application/zip")
