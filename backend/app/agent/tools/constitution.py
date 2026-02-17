import httpx
import logging
import os
from io import BytesIO
from pypdf import PdfReader
from datetime import datetime

logger = logging.getLogger(__name__)

class ConstitutionIngester:
    CPEUM_URL = "https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf"
    DATA_DIR = "data"
    OUTPUT_FILE = "cpeum.txt"

    @classmethod
    async def process(cls):
        """
        Main entry point: Fetch PDF, extract text, and save to file.
        """
        logger.info("Starting Constitution (CPEUM) ingestion process...")
        
        try:
            # 1. Fetch PDF
            pdf_bytes = await cls.fetch_pdf()
            if not pdf_bytes:
                logger.error("Failed to fetch PDF")
                return

            # 2. Extract Text
            text = cls.extract_text(pdf_bytes)
            logger.info(f"Extracted {len(text)} characters from CPEUM PDF")

            # 3. Save to File
            cls.save_text(text)
            logger.info("Constitution ingestion completed successfully")

        except Exception as e:
            logger.error(f"Error during Constitution ingestion: {str(e)}")

    @classmethod
    async def fetch_pdf(cls) -> bytes:
        """Fetch the PDF from the official URL."""
        async with httpx.AsyncClient() as client:
            logger.info(f"Fetching CPEUM from {cls.CPEUM_URL}...")
            response = await client.get(cls.CPEUM_URL, follow_redirects=True, timeout=30.0)
            
            if response.status_code == 200:
                return response.content
            else:
                logger.error(f"Failed to fetch PDF. Status: {response.status_code}")
                return None

    @classmethod
    def extract_text(cls, pdf_bytes: bytes) -> str:
        """Extract text from PDF bytes using pypdf."""
        logger.info("Extracting text from PDF...")
        reader = PdfReader(BytesIO(pdf_bytes))
        text = []
        
        for i, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text()
                if page_text:
                    text.append(page_text)
            except Exception as e:
                logger.warning(f"Could not extract text from page {i}: {e}")
        
        return "\n\n".join(text)

    @classmethod
    def save_text(cls, text: str):
        """Save extracted text to a local file with timestamp."""
        # Ensure data dir exists
        os.makedirs(cls.DATA_DIR, exist_ok=True)
        
        filepath = os.path.join(cls.DATA_DIR, cls.OUTPUT_FILE)
        
        header = f"--- MEXICAN CONSTITUTION (CPEUM) ---\n"
        header += f"Updated: {datetime.now().isoformat()}\n"
        header += f"Source: {cls.CPEUM_URL}\n"
        header += "-" * 50 + "\n\n"
        
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(header + text)
            
        logger.info(f"Saved Constitution text to {filepath}")
