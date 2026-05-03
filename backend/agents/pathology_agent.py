"""
Pathology & Disease Research Agent (PDRA) — Dynamic Pipeline.
Handles: Diseases, Blood Types, Tissue Morphology, and Samples.
NO STATIC KEYWORD BLOCKS: Relies on Gemini for domain routing.
"""
from typing import Optional, Dict
from backend.services.shared_utils import refine_query
from backend.services.pathology_modules import (
    task_decomposer,
    entity_classification,
    hematological_typing_logic,
    diagnostic_sampling_protocol,
    cellular_impact_analysis,
    diagnostic_evidence_aggregator
)
from backend.services.pathology_llm_service import call_pathology_ensemble

async def run(query: str, context: Optional[dict] = None) -> dict:
    """
    PDRA Pipeline (Dynamic Entity Analysis).
    Works for Diseases, Blood Groups, Tissues, and Samples.
    """
    refined_query, _, _ = refine_query(query)

    # Extract target entity (Disease, Blood Group, or Sample name)
    clean_query = refined_query.split("\nCONTEXT:")[0].split("CONTEXT:")[0].strip()
    target_entity = clean_query.split()[-1].strip("?.")

    pipeline_state: Dict = {
        "query": refined_query,
        "target_entity": target_entity,
        "agent": "PDRA"
    }

    # Module 1: Task Decomposition
    pipeline_state["decomposer"] = task_decomposer(refined_query, target_entity)

    # Module 2: Entity Classification (Disease/Blood/Tissue)
    pipeline_state["classification"] = entity_classification(refined_query, target_entity)

    # Module 3: Hematological Typing (Blood group logic)
    pipeline_state["hematology"] = hematological_typing_logic(refined_query, target_entity)

    # Module 4: Diagnostic Sampling (Tests/Samples needed)
    pipeline_state["sampling"] = diagnostic_sampling_protocol(refined_query, target_entity)

    # Module 5: Cellular Impact
    pipeline_state["cellular"] = cellular_impact_analysis(refined_query)

    # Module 6: Aggregator
    pipeline_state["evidence"] = diagnostic_evidence_aggregator(pipeline_state)

    # --- 6-MODEL ENSEMBLE (PathologyBERT, DinoBloom, etc.) ---
    # These models handle the deep scientific analysis of the retrieved data.
    context_str = f"Target: {target_entity}. Classification: {pipeline_state['classification']}. Hematology: {pipeline_state['hematology']}"
    pathology_model_data = await call_pathology_ensemble(
        query=refined_query,
        context=context_str
    )
    pipeline_state["pathology_models"] = pathology_model_data

    return {
        "agent": "PDRA",
        "status": "success",
        "raw_data": pipeline_state,
        "disease_name": target_entity  # Kept key name for orchestrator compatibility
    }
