import os
from dotenv import load_dotenv

load_dotenv()

# JWT Settings
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# Database
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./scientific_assistant.db")

# External APIs
PUBCHEM_BASE_URL = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"
CHEMBL_BASE_URL = "https://www.ebi.ac.uk/chembl/api/data"
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Vector DB
CHROMA_PERSIST_DIR = "./chroma_store"

# App Settings
APP_NAME = "Agentic Scientific Assistant"
APP_VERSION = "1.0.0"
