"""
Previa App — AI Chat API
Connects to Anthropic Claude for fiscal compliance assistant conversations.
The agent can search indexed PublicNotice (SAT/DOF compliance data) and CompanyNews
(controversial news) on-demand via Claude tool-use — by RFC and/or company name.
"""

import logging
from typing import Annotated, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from anthropic import Anthropic
from sqlalchemy import select, or_

from app.api.deps import get_current_user
from app.config.settings import settings
from app.data.db.session import get_db
from app.data.db.models import CompanyNews, PublicNotice
from sqlalchemy.ext.asyncio import AsyncSession

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
    context: Optional[dict] = None

class ChatResponse(BaseModel):
    response: str
    suggested_action: Optional[str] = None

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
- Gaceta Parlamentaria: https://gaceta.diputados.gob.mx/ — iniciativas, dictámenes y reformas legislativas en materia fiscal/tributaria aprobadas o en proceso en la Cámara de Diputados.
- Leyes Federales de México: https://www.diputados.gob.mx/LeyesBiblio/index.htm — seguimiento de reformas recientes al CFF, ISR, LIVA, LIEPS, LFPIORPI y demás leyes fiscales vigentes.

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

Herramientas disponibles:
- Usa la herramienta "search_company" para buscar un RFC o nombre de empresa en los datos \
indexados del SAT, DOF y noticias. Siempre úsala cuando el usuario pregunte sobre una empresa \
específica, un RFC, noticias, cumplimiento fiscal, o riesgo de un proveedor. Puedes buscar \
por RFC, por nombre (razón social), o ambos. Cita las fuentes y URLs en tu respuesta.

Reglas:
- Responde siempre en español mexicano profesional
- Sé conciso y directo; si el usuario pide análisis, sé detallado
- Para cargar datos, siempre sugiere el flujo: Subir CSV/XLS → Seleccionar Watchlist → Confirmar mapeo
- No inventes datos del SAT ni resultados de screening; usa la herramienta search_company para obtener datos reales
- Si detectas que el usuario quiere crear una organización, indícale que debe hacerlo desde el panel lateral
"""

# ── Claude tool definition ────────────────────────────────────────────────────

SEARCH_COMPANY_TOOL = {
    "name": "search_company",
    "description": (
        "Search indexed SAT/DOF/Gaceta/Leyes compliance data (PublicNotice) and controversial news "
        "(CompanyNews) by RFC and/or company name (razón social). Returns compliance "
        "findings (Art 69, 69-B, 69-B Bis, 49 BIS), legislative context from Gaceta Parlamentaria, "
        "law reform tracking from Leyes Federales, and recent news articles. "
        "Use this whenever the user asks about a company, RFC, compliance status, "
        "legislative changes, or controversial news."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "rfc": {
                "type": "string",
                "description": "RFC to search for (e.g. CAL080328S18). Optional if company_name is provided.",
            },
            "company_name": {
                "type": "string",
                "description": "Company name / razón social to search (partial match). Optional if rfc is provided.",
            },
        },
        "required": [],
    },
}

MAX_TOOL_ROUNDS = 3

# ── Tool execution ────────────────────────────────────────────────────────────

async def _execute_search_company(
    db: AsyncSession,
    rfc: Optional[str],
    company_name: Optional[str],
    watchlist_id: Optional[int] = None,
) -> str:
    """Run the search_company tool against DB and return formatted text."""
    results_parts: List[str] = []

    # Build PublicNotice query
    pn_filters = []
    if rfc:
        pn_filters.append(PublicNotice.rfc == rfc.strip().upper())
    if company_name:
        pn_filters.append(PublicNotice.razon_social.ilike(f"%{company_name.strip()}%"))

    if pn_filters:
        q = (
            select(PublicNotice)
            .where(or_(*pn_filters))
            .order_by(PublicNotice.indexed_at.desc())
            .limit(30)
        )
        rows = (await db.execute(q)).scalars().all()
        if rows:
            results_parts.append(f"## Hallazgos en datos SAT/DOF ({len(rows)} registros)")
            for r in rows:
                line = (
                    f"- [{r.article_type}] RFC={r.rfc or 'N/A'} | "
                    f"{r.razon_social or 'N/A'} | status={r.status or 'N/A'} | "
                    f"fuente={r.source} | url={r.source_url or 'N/A'}"
                )
                if r.motivo:
                    line += f" | motivo={r.motivo[:150]}"
                if r.published_at:
                    line += f" | fecha={r.published_at.strftime('%Y-%m-%d')}"
                results_parts.append(line)
        else:
            results_parts.append("No se encontraron hallazgos en datos SAT/DOF para esta búsqueda.")

    # Build CompanyNews query
    cn_filters = []
    if rfc:
        cn_filters.append(CompanyNews.rfc == rfc.strip().upper())
    if company_name:
        cn_filters.append(CompanyNews.razon_social.ilike(f"%{company_name.strip()}%"))
    if watchlist_id is not None:
        cn_filters.append(CompanyNews.watchlist_id == watchlist_id)

    if cn_filters:
        q = (
            select(CompanyNews)
            .where(or_(*cn_filters))
            .order_by(CompanyNews.published_at.desc().nullslast(), CompanyNews.indexed_at.desc())
            .limit(15)
        )
        news_rows = (await db.execute(q)).scalars().all()
        if news_rows:
            results_parts.append(f"\n## Noticias controversiales ({len(news_rows)} artículos)")
            for n in news_rows:
                company = (n.razon_social or n.rfc or "N/A").strip()
                date_str = n.published_at.strftime("%Y-%m-%d") if n.published_at else "s/f"
                results_parts.append(f"- [{company}] {n.title} — {n.url} ({date_str})")
                if n.summary:
                    results_parts.append(f"  Resumen: {n.summary[:200]}")
        else:
            results_parts.append("No se encontraron noticias controversiales para esta búsqueda.")

    if not pn_filters and not cn_filters:
        return "No se proporcionó RFC ni nombre de empresa para la búsqueda."

    return "\n".join(results_parts) or "Sin resultados."


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Send a message to the Previa App AI assistant.
    Uses Claude tool-use for on-demand search of SAT/DOF compliance data and news.
    """
    try:
        client = get_anthropic_client()

        messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.history
            if msg.role in ("user", "assistant")
        ]
        messages.append({"role": "user", "content": request.message})

        system = SYSTEM_PROMPT
        if request.context:
            ctx_parts = []
            if org := request.context.get("organization"):
                ctx_parts.append(f"Organización activa: {org}")
            if wl := request.context.get("watchlist"):
                ctx_parts.append(f"Watchlist activa: {wl}")
            if ctx_parts:
                system += "\n\nContexto actual:\n" + "\n".join(ctx_parts)

        watchlist_id = None
        if request.context and isinstance(request.context.get("watchlist_id"), (int, float)):
            watchlist_id = int(request.context["watchlist_id"])

        tools = [SEARCH_COMPANY_TOOL]

        # Tool-use loop: let Claude call search_company, then continue
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2000,
            system=system,
            messages=messages,
            tools=tools,
        )

        for _ in range(MAX_TOOL_ROUNDS):
            if response.stop_reason != "tool_use":
                break

            tool_results = []
            for block in response.content:
                if block.type == "tool_use" and block.name == "search_company":
                    inp = block.input or {}
                    result_text = await _execute_search_company(
                        db,
                        rfc=inp.get("rfc"),
                        company_name=inp.get("company_name"),
                        watchlist_id=watchlist_id,
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_text,
                    })

            if not tool_results:
                break

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

            response = client.messages.create(
                model=settings.anthropic_model,
                max_tokens=2000,
                system=system,
                messages=messages,
                tools=tools,
            )

        # Extract final text
        reply = ""
        for block in response.content:
            if hasattr(block, "text"):
                reply += block.text

        if not reply:
            reply = "No pude generar una respuesta. Intenta reformular tu pregunta."

        suggested_action = None
        if any(kw in reply.lower() for kw in ["subir", "cargar", "upload", "csv", "xls", "archivo"]):
            suggested_action = "upload_csv"
        elif any(kw in reply.lower() for kw in ["crear watchlist", "nueva watchlist", "nueva lista"]):
            suggested_action = "create_watchlist"

        return ChatResponse(response=reply, suggested_action=suggested_action)

    except Exception as exc:
        logger.error("Chat error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Error al procesar mensaje: {str(exc)}")
