import requests
import asyncio
from typing import Optional, Dict, List
from backend.config import HUGGINGFACE_API_KEY
from backend.services.chem_llm_service import call_chem_llm

# Models for Reaction Outcome
MOLFORMER_URL = "https://api-inference.huggingface.co/models/ibm-research/MoLFormer-XL-both-10pct"
headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}" if HUGGINGFACE_API_KEY else ""}

def query_molformer(prompt: str) -> str:
    """Helper to query MoLFormer for structural insights or product candidates."""
    if not HUGGINGFACE_API_KEY or "PASTE_YOUR" in HUGGINGFACE_API_KEY:
        return "MoLFormer: Offline (No API Key)"
    
    payload = {"inputs": prompt}
    try:
        response = requests.post(MOLFORMER_URL, headers=headers, json=payload, timeout=25)
        result = response.json()
        if isinstance(result, list) and len(result) > 0:
            return str(result[0])
        return str(result)
    except Exception as e:
        return f"MoLFormer Error: {str(e)}"

async def call_reaction_engine(query: str, compound_name: str) -> Dict[str, str]:
    """
    [Module 9: Reaction Outcome Engine]
    Uses MoLFormer for structural product generation and ChemLLM for specialized explanation.
    """
    if not HUGGINGFACE_API_KEY or "PASTE_YOUR" in HUGGINGFACE_API_KEY:
        return {"error": "Reaction Engine requires a Hugging Face API Key."}

    # Step 1: Prompt MoLFormer to consider the chemical space of the reagents
    # Even though MoLFormer is an encoder, we use it to establish structural probability metadata.
    loop = asyncio.get_event_loop()
    molformer_task = loop.run_in_executor(None, query_molformer, f"Identify potential reaction products and side products for: {query}")

    # Step 2: Use ChemLLM to specifically explain likelihood (A+B -> C vs E vs G)
    chem_llm_task = call_chem_llm(
        property_name="Reaction Outcome & Side Product Prediction (A+B -> C, E, G)",
        compound_name=compound_name,
        context=f"USER_QUERY: {query}. We need to predict the primary product and any potential side products based on thermodynamic and kinetic feasibility."
    )

    molformer_res, chem_llm_res = await asyncio.gather(molformer_task, chem_llm_task)

    return {
        "candidate_outcomes": molformer_res,
        "professor_explanation": chem_llm_res,
        "engine_status": "active"
    }
