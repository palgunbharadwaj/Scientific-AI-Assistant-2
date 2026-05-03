"""
Chemistry Research Agent (CRA) — Rigid 7-Module Sequential Pipeline.
"""
import re
from typing import Optional, Dict, Any, List
from backend.services.pubchem_api import get_compound_by_name
from backend.services.chembl_api import search_molecule
from backend.services.shared_utils import refine_query
from backend.services.chemistry_modules import (
    task_decomposer,
    normalize_structure, 
    enhanced_safety_analysis, 
    reaction_reasoning,
    environmental_sustainability, 
    conceptual_mixing_outcome,
    evidence_aggregator
)
from backend.services.chem_llm_service import call_chem_llm
from backend.services.reaction_engine_service import call_reaction_engine

async def run(query: str, context: Optional[dict] = None) -> dict:
    """
    CRA Pipeline (7-Module Sequential Logic).
    Returns ONLY raw analysis data. Logic is fully autonomous.
    """
    refined_query, clarification, is_on_topic = refine_query(query)
    
    # Extract molecule name (heuristic) - Remove any CONTEXT block first
    clean_query = refined_query.split("\nCONTEXT:")[0].split("CONTEXT:")[0].strip()
    compound_name = clean_query.split()[-1].strip("?.")
    
    # 2. Data Retrieval
    from backend.services.data_resolver import resolve_scientific_data
    resolution = await resolve_scientific_data(refined_query, compound_name)
    mol_data = resolution.get("pubchem") or resolution.get("chembl") or {}
    smiles = mol_data.get("canonical_smiles") or ""
    
    # 3. Pipeline Modules (7-Module Chain)
    pipeline_state = {"query": refined_query, "compound": compound_name, "mol_data": mol_data}

    # Module 1 & 2
    pipeline_state["decomposer"] = task_decomposer(refined_query, compound_name)
    pipeline_state["normalization"] = normalize_structure(mol_data)
    
    # Module 3 & 4
    safety_obj = enhanced_safety_analysis(mol_data)
    pipeline_state["safety_obj"] = safety_obj
    pipeline_state["reasoning_obj"] = reaction_reasoning(mol_data, safety_obj.get("status"))
    
    # Module 5 & 6
    sustain_obj = environmental_sustainability(mol_data)
    pipeline_state["sustainability_obj"] = sustain_obj
    pipeline_state["mixing"] = conceptual_mixing_outcome(safety_obj.get("status"), sustain_obj.get("score"))
    
    # Module 7: Aggregator
    pipeline_state["evidence"] = evidence_aggregator(pipeline_state)
    
    # Module 8: Chem-CoT Deep Reasoning (Pre-trained Model Integration)
    deep_reasoning = await call_chem_llm(
        property_name="Advanced Analysis & Structural Insights", 
        compound_name=compound_name,
        context=str(pipeline_state.get("normalization", "")) + str(pipeline_state.get("safety_obj", ""))
    )
    pipeline_state["deep_reasoning"] = deep_reasoning

    # Module 9: Reaction Outcome Engine (MoLFormer + ChemLLM)
    reaction_outcomes = await call_reaction_engine(
        query=refined_query,
        compound_name=compound_name
    )
    pipeline_state["reaction_outcomes"] = reaction_outcomes

    return {
        "agent": "CRA",
        "status": "success",
        "raw_data": pipeline_state,
        "compound_name": compound_name
    }
