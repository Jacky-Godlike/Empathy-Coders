from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from .routes import router

app = FastAPI(title="SDC Hackathon Backend B", version="1.0.0", description="Synthetic SME message analysis, connectors and Excel export")
app.include_router(router)

@app.exception_handler(RequestValidationError)
async def validation_error_handler(request, exc):
    return JSONResponse(status_code=422, content={"detail": "Invalid request", "error_code": "VALIDATION_ERROR"})
