import requests
import asyncio
from typing import Optional, Dict
from backend.config import HUGGINGFACE_API_KEY

# Drug Discovery Model Endpoints (HuggingFace Inference API)
MODELS = {
    "esmfold": "https://api-inference.huggingface.co/models/facebook/esmfold_v1",
    "esm2": "https://api-inference.huggingface.co/models/facebook/esm2_t33_650M_UR50D",
    "admet": "https://api-inference.huggingface.co/models/GanjinZero/bio-roberta-base-admet"
}

headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}" if HUGGINGFACE_API_KEY else ""}

def query_model(model_key: str, prompt: str) -> str:
    """Synchronous helper for HF Inference API."""
    if not HUGGINGFACE_API_KEY or "PASTE_YOUR" in HUGGINGFACE_API_KEY:
        return f"Discovery Model {model_key} is offline: Missing API Key."
        
    url = MODELS.get(model_key)
    payload = {"inputs": prompt}
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=25)
        result = response.json()
        
        if isinstance(result, list) and len(result) > 0:
            if isinstance(result[0], dict) and "generated_text" in result[0]:
                return result[0]["generated_text"]
            return str(result[0])
        return str(result)
    except Exception as e:
        return f"Discovery {model_key} Error: {str(e)}"

async def call_discovery_ensemble(query: str, context: Optional[str] = None) -> Dict[str, str]:
    """
    Calls the Discovery Ensemble: 
    - ESMFold (Protein Geometry)
    - ESM-2 (Binding Affinities)
    - Bio-RoBERTa-ADMET (Toxicity Risk)
    """
    if not HUGGINGFACE_API_KEY or "PASTE_YOUR" in HUGGINGFACE_API_KEY:
        return {"error": "Discovery Ensemble requires a Hugging Face API Key."}

    # Specialized Scientific Prompts
    prompts = {
        "esmfold": f"Predict protein geometry and structural stability for potential binder: {query}. Target Context: {context}",
        "esm2": f"Analyze binding affinity and pharmacological embeddings for: {query}. Scaffold: {context}",
        "admet": f"Predict ADMET profile (Absorption, Distribution, Metabolism, Excretion, Toxicity) for: {query}"
    }

    # Parallel Execution
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, query_model, k, v) 
        for k, v in prompts.items()
    ]
    
    results = await asyncio.gather(*tasks)
    
    return {
        "structural_geometry": results[0],
        "binding_affinity": results[1],
        "predictive_admet": results[2]
    }
