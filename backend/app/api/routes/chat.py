"""
Previa App — AI Chat API
Connects to Anthropic Claude for fiscal compliance assistant conversations.
The agent understands CSV/XLS column structures and can manage watchlists.
"""

import logging
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from anthropic import Anthropic

from app.api.deps import get_current_user
from app.config.settings import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Anthropic client (lazy init) ──────────────────────────────────────────────

_anthropic_client: Optional[Anthropic] = None

def get_anthropic_client() -> Anthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = Anthropic(api_key=settings.anthropic_api_key)
    return _anthropic_client

# ── Schemas ───────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    context: Optional[dict] = None   # e.g. {"organization": "Grupo X", "watchlist": "Proveedores"}

class ChatResponse(BaseModel):
    response: str
    suggested_action: Optional[str] = None   # e.g. "upload_csv", "create_watchlist"

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres el asistente de inteligencia fiscal de Previa App — una plataforma SaaS mexicana \
de cumplimiento fiscal regulatorio.

Tu especialidad:
- Monitoreo de proveedores ante el SAT (Artículos 69, 69-B, 69-BIS, 49-BIS del CFF)
- Identificación de EFOS (Empresas que Facturan Operaciones Simuladas) y EDOS
- Gestión de listas de vigilancia (watchlists) por organización
- Interpretación de alertas y resultados de cumplimiento
- Comprensión de archivos CSV/XLS con datos de proveedores

Fuentes de datos para alertas (indexadas y actualizadas periódicamente):
- DOF (Diario Oficial de la Federación): https://dof.gob.mx/ y ediciones por fecha, ej. https://dof.gob.mx/index.php?year=2025&month=11&day=21&edicion=MAT
- SAT Datos Abiertos: http://omawww.sat.gob.mx/cifras_sat/Paginas/DatosAbiertos/ (contribuyentes publicados, controversia, sat_mas_abierto y demás datos públicos SAT/SHCP). Las alertas se generan a partir de estas fuentes.

Estructura del sistema:
- El usuario gestiona Organizaciones (crea/edita manualmente)
- Cada Organización tiene múltiples Watchlists
- Cada Watchlist contiene Empresas (RFCs) para monitorear
- Tú (el agente) puedes sugerir crear watchlists, agrupar empresas y analizar datos

Cuando el usuario quiera cargar datos de proveedores:
- Guíalo a subir un archivo CSV o XLS
- Puedes interpretar cualquier columna que contenga RFC, nombre, relación comercial, etc.
- Columnas estándar esperadas: RFC, Razón Social, Tipo Persona, Relación (proveedor/cliente)
- Si el CSV tiene columnas distintas, infiere el mapeo y preguntas de confirmación

Reglas:
- Responde siempre en español mexicano profesional
- Sé conciso y directo; si el usuario pide análisis, sé detallado
- Para cargar datos, siempre sugiere el flujo: Subir CSV/XLS → Seleccionar Watchlist → Confirmar mapeo
- No inventes datos del SAT ni resultados de screening; solo orienta al usuario en el proceso
- Si detectas que el usuario quiere crear una organización, indícale que debe hacerlo desde el panel lateral
"""

# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """
    Send a message to the Previa App AI assistant.
    Maintains conversation history and returns a response plus optional suggested action.
    """
    try:
        client = get_anthropic_client()

        # Build message history for Claude
        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.history
            if msg.role in ("user", "assistant")
        ]
        messages.append({"role": "user", "content": request.message})

        # Enrich system prompt with context if provided
        system = SYSTEM_PROMPT
        if request.context:
            ctx_parts = []
            if org := request.context.get("organization"):
                ctx_parts.append(f"Organización activa: {org}")
            if wl := request.context.get("watchlist"):
                ctx_parts.append(f"Watchlist activa: {wl}")
            if ctx_parts:
                system += "\n\nContexto actual:\n" + "\n".join(ctx_parts)

        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1500,
            system=system,
            messages=messages,
        )

        reply = response.content[0].text

        # Detect suggested actions based on keywords in the reply
        suggested_action = None
        if any(kw in reply.lower() for kw in ["subir", "cargar", "upload", "csv", "xls", "archivo"]):
            suggested_action = "upload_csv"
        elif any(kw in reply.lower() for kw in ["crear watchlist", "nueva watchlist", "nueva lista"]):
            suggested_action = "create_watchlist"

        return ChatResponse(response=reply, suggested_action=suggested_action)

    except Exception as exc:
        logger.error("Chat error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error al procesar mensaje: {str(exc)}")
