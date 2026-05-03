"""
Drug Discovery Research Agent (DDRA) — Focus: Lead Opt, ADMET, Discovery.
"""
from typing import Optional, Dict, Any, List
from backend.services.shared_utils import refine_query
from backend.services.discovery_modules import (
    task_decomposer,
    conceptual_molecular_generator,
    admet_predictor,
    feasibility_scorer,
    retrosynthesis_insight_engine,
    sustainability_toxicity_filters,
    candidate_evaluation_module
)
from backend.services.discovery_llm_service import call_discovery_ensemble

async def run(query: str, context: Optional[dict] = None) -> dict:
    """
    DDRA Research Pipeline.
    Returns ONLY raw analysis data.
    """
    refined_query, clarification, is_on_topic = refine_query(query)
    
    # Extract molecule name (heuristic) - Remove any CONTEXT block first
    clean_query = refined_query.split("\nCONTEXT:")[0].split("CONTEXT:")[0].strip()
    compound_name = clean_query.split()[-1].strip("?.")
    
    from backend.services.data_resolver import resolve_scientific_data
    resolution = await resolve_scientific_data(refined_query, compound_name)
    molecule = resolution.get("pubchem") or resolution.get("chembl") or {}
    smiles = molecule.get("canonical_smiles") or ""
    mw = molecule.get("molecular_weight") or 0
    if isinstance(mw, str) and mw.replace('.','',1).isdigit(): mw = float(mw)
    elif not isinstance(mw, (int, float)): mw = 0

    pipeline_state = {
        "query": refined_query,
        "molecule": molecule,
        "agent": "DDRA"
    }

    # Discovery Modules
    pipeline_state["decomposer_text"] = task_decomposer(refined_query, compound_name)
    pipeline_state["generator_text"] = conceptual_molecular_generator(smiles)
    pipeline_state["admet_text"] = admet_predictor(molecule, mw)
    pipeline_state["feasibility_obj"] = feasibility_scorer(mw, smiles)
    pipeline_state["retrosynth_text"] = retrosynthesis_insight_engine(smiles)
    pipeline_state["sustainability_text"] = sustainability_toxicity_filters(molecule)
    
    # Final Evaluation
    pipeline_state["candidate_summary"] = candidate_evaluation_module(pipeline_state)
    
    # Module 8: Discovery Deep Reasoning (Pre-trained Model Integration)
    discovery_deep_reasoning = await call_discovery_ensemble(
        query=refined_query,
        context=str(pipeline_state.get("generator_text", "")) + f" | SMILES: {smiles}"
    )
    pipeline_state["discovery_deep_reasoning"] = discovery_deep_reasoning

    return {
        "agent": "DDRA",
        "status": "success",
        "raw_data": pipeline_state,
        "molecule": molecule,
        "compound_name": compound_name
    }
