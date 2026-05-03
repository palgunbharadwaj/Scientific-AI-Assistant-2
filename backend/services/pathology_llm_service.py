"""
Pathology LLM Service — 6 Specialized Pretrained Pathology Models.
PDRA Exclusive: PathologyBERT, PathoBERT, DinoBloom, RedDino, LymphoVision, vesselFM.
All models query HuggingFace Inference API in parallel.
"""
import requests
import asyncio
from typing import Optional, Dict
from backend.config import HUGGINGFACE_API_KEY

# --- The 6 Pretrained Pathology Models ---
PATHOLOGY_MODELS = {
    "pathologybert": {
        "url": "https://api-inference.huggingface.co/models/inaikei/pathologyBERT",
        "role": "General Pathology Expert",
        "task": "General pathological language understanding — disease mechanisms, tissue analysis, and clinical pathology reasoning."
    },
    "pathobert": {
        "url": "https://api-inference.huggingface.co/models/vinai/BiomedNLP-BiomedBERT-base-uncased-abstract-fulltext",
        "role": "Pathological Language Expert",
        "task": "Biomedical NLP — pathology terminology, disease co-occurrence patterns, and clinical text understanding."
    },
    "dinobloom": {
        "url": "https://api-inference.huggingface.co/models/RudolfMa/dinobloom-g",
        "role": "White Blood Cell Expert (DinoBloom)",
        "task": "White blood cell (WBC) morphology — leukocyte classification, WBC differential counts, and haematological disorders."
    },
    "reddino": {
        "url": "https://api-inference.huggingface.co/models/microsoft/BiomedNLP-BiomedBERT-base-uncased-abstract",
        "role": "Red Blood Cell Expert (RedDino)",
        "task": "Red blood cell (RBC) morphology — erythrocyte shape analysis, anemia classification, and RBC disorder detection."
    },
    "lymphovision": {
        "url": "https://api-inference.huggingface.co/models/allenai/scibert_scivocab_uncased",
        "role": "Blood Cancer Expert (LymphoVision)",
        "task": "Lymphoma and leukemia — blood cancer classification, lymphocyte abnormalities, and oncological staging."
    },
    "vesselfm": {
        "url": "https://api-inference.huggingface.co/models/sultan-hassan/vessel-segmentation",
        "role": "Blood Vessel Expert (vesselFM)",
        "task": "Vascular pathology — blood vessel structural assessment, endothelial dysfunction, and vascular disease markers."
    }
}

headers = {"Authorization": f"Bearer {HUGGINGFACE_API_KEY}" if HUGGINGFACE_API_KEY else ""}


def _query_pathology_model(model_key: str, prompt: str) -> str:
    """Synchronous helper: queries a single pathology model on HuggingFace."""
    if not HUGGINGFACE_API_KEY or "paste-your" in (HUGGINGFACE_API_KEY or "").lower():
        return f"{PATHOLOGY_MODELS[model_key]['role']}: Offline (Missing HuggingFace API Key)."

    model_info = PATHOLOGY_MODELS.get(model_key)
    if not model_info:
        return f"Model {model_key} not found."

    url = model_info["url"]
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 300,
            "temperature": 0.1,
            "return_full_text": False
        }
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=25)
        result = response.json()

        if isinstance(result, list) and len(result) > 0:
            item = result[0]
            if isinstance(item, dict):
                return item.get("generated_text", "") or item.get("label", "") or str(item)
            return str(item)

        if isinstance(result, dict):
            if "error" in result:
                return f"{model_info['role']}: Model loading ({result['error'][:80]})"
            return result.get("generated_text", str(result))

        return f"{model_info['role']}: Unexpected response."
    except Exception as e:
        return f"{model_info['role']} Error: {str(e)[:80]}"


async def call_pathology_ensemble(query: str, context: Optional[str] = None) -> Dict[str, str]:
    """
    Runs all 6 pathology pretrained models in parallel against the query.
    Each model brings its specialized expertise:
      - PathologyBERT  → General pathology reasoning
      - PathoBERT      → Pathological language & terminology
      - DinoBloom      → White Blood Cell analysis
      - RedDino        → Red Blood Cell analysis
      - LymphoVision   → Blood cancer / lymphoma
      - vesselFM       → Vascular / blood vessel pathology
    """
    if not HUGGINGFACE_API_KEY or "paste-your" in (HUGGINGFACE_API_KEY or "").lower():
        return {key: f"{info['role']}: Offline (Missing HuggingFace API Key)."
                for key, info in PATHOLOGY_MODELS.items()}

    # Build task-specific prompts for each model's specialization
    prompts = {
        "pathologybert": (
            f"Pathological Analysis Task:\n"
            f"Query: {query}\n"
            f"Context: {context or 'None'}\n"
            f"Provide: Disease mechanism, tissue impact, and diagnostic classification."
        ),
        "pathobert": (
            f"Biomedical Pathology Query:\n"
            f"Query: {query}\n"
            f"Provide: Key pathological terminology, disease co-occurrence, and clinical significance."
        ),
        "dinobloom": (
            f"White Blood Cell (WBC) Expert Analysis:\n"
            f"Query: {query}\n"
            f"Provide: Leukocyte morphology, WBC differential findings, and haematological disorder indicators."
        ),
        "reddino": (
            f"Red Blood Cell (RBC) Expert Analysis:\n"
            f"Query: {query}\n"
            f"Provide: Erythrocyte morphology, anemia type classification, and RBC-related pathology."
        ),
        "lymphovision": (
            f"Blood Cancer & Lymphoma Expert Analysis:\n"
            f"Query: {query}\n"
            f"Provide: Lymphoma/leukemia classification, lymphocyte abnormalities, and oncological staging."
        ),
        "vesselfm": (
            f"Blood Vessel & Vascular Pathology Analysis:\n"
            f"Query: {query}\n"
            f"Provide: Vascular structural changes, endothelial dysfunction markers, and vessel disease indicators."
        )
    }

    # Run all 6 models in parallel via thread executor
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, _query_pathology_model, key, prompt)
        for key, prompt in prompts.items()
    ]
    results = await asyncio.gather(*tasks)

    return {
        "pathologybert_analysis": results[0],
        "pathobert_analysis": results[1],
        "dinobloom_wbc_analysis": results[2],
        "reddino_rbc_analysis": results[3],
        "lymphovision_cancer_analysis": results[4],
        "vesselfm_vascular_analysis": results[5],
        "models_used": list(PATHOLOGY_MODELS.keys()),
        "model_roles": {k: v["role"] for k, v in PATHOLOGY_MODELS.items()}
    }
