"""
Pathology Modules — PDRA 6-Module Logic.
Purger: No hardcoded sentences. Returns raw attributes for Gemini.
Handles Entities: Diseases, Blood Types, Tissues, and Diagnostic Samples.
"""
from typing import Optional, List, Dict

def task_decomposer(query: str, target: str) -> Dict:
    """[Module 1: TaskDecomposer] Pathological breakdown for any entity."""
    return {
        "subtasks": [
            "entity_classification", "biological_impact",
            "biomarker_identification", "sampling_protocols",
            "diagnostic_mapping", "compatibility_logic"
        ],
        "target": target,
        "domain": "PDRA"
    }

def entity_classification(query: str, target: str) -> Dict:
    """[Module 2: EntityClassifier] Identifies if target is a Disease, Blood Type, or Tissue."""
    q = query.lower()
    t = target.lower()
    
    # Blood Group Detection
    blood_groups = ["a+", "a-", "b+", "b-", "ab+", "ab-", "o+", "o-", "blood type", "blood group"]
    is_blood = any(bg in t or bg in q for bg in blood_groups)
    
    # Disease Detection
    diseases = ["cancer", "leukemia", "malaria", "tumor", "infection", "disorder", "syndrome"]
    is_disease = any(d in t or d in q for d in diseases)
    
    # Tissue/Sample Detection
    samples = ["biopsy", "plasma", "serum", "tissue", "slide", "vessel", "bone marrow"]
    is_sample = any(s in t or s in q for s in samples)

    category = "Pathological Entity"
    if is_blood: category = "Hematological (Blood Group)"
    elif is_disease: category = "Clinical Disease / Condition"
    elif is_sample: category = "Diagnostic Sample / Tissue"

    return {
        "entity_type": category,
        "is_blood_related": is_blood,
        "is_disease_related": is_disease
    }

def hematological_typing_logic(query: str, target: str) -> Dict:
    """[Module 3: BloodLogic] Handles blood group compatibility and sampling."""
    q = query.lower()
    
    # Compatibility mapping (simplified for raw data)
    compatibility = {
        "o-": {"can_give_to": "All (Universal Donor)", "can_receive_from": "O-"},
        "o+": {"can_give_to": "O+, A+, B+, AB+", "can_receive_from": "O+, O-"},
        "a-": {"can_give_to": "A-, A+, AB-, AB+", "can_receive_from": "A-, O-"},
        "a+": {"can_give_to": "A+, AB+", "can_receive_from": "A+, A-, O+, O-"},
        "b-": {"can_give_to": "B-, B+, AB-, AB+", "can_receive_from": "B-, O-"},
        "b+": {"can_give_to": "B+, AB+", "can_receive_from": "B+, B-, O+, O-"},
        "ab-": {"can_give_to": "AB-, AB+", "can_receive_from": "AB-, A-, B-, O-"},
        "ab+": {"can_give_to": "AB+", "can_receive_from": "All (Universal Recipient)"}
    }

    detected_group = None
    for group in compatibility.keys():
        if group in q or group in target.lower():
            detected_group = group
            break

    return {
        "detected_group": detected_group.upper() if detected_group else "None",
        "compatibility_data": compatibility.get(detected_group, {}) if detected_group else "General hematology query",
        "needs_cross_match": True if detected_group else False
    }

def diagnostic_sampling_protocol(query: str, target: str) -> Dict:
    """[Module 4: SamplingProtocol] Identifies required samples and tests."""
    q = query.lower()
    
    protocols = []
    if "blood" in q or "anemia" in q or "leukemia" in q:
        protocols.append({"sample": "Whole Blood (EDTA)", "test": "Complete Blood Count (CBC)"})
    if "cancer" in q or "tumor" in q or "biopsy" in q:
        protocols.append({"sample": "Tissue Core / Fine Needle Aspirate", "test": "Histopathology / IHC"})
    if "virus" in q or "infection" in q:
        protocols.append({"sample": "Serum / Plasma", "test": "Serology / PCR"})
    
    return {
        "required_samples": protocols if protocols else ["Standard Diagnostic Panel"],
        "is_urgent": any(k in q for k in ["acute", "severe", "emergency", "crisis"])
    }

def cellular_impact_analysis(query: str) -> Dict:
    """[Module 5: CellularImpact] Raw cellular-level change markers."""
    q = query.lower()
    cell_types = []
    if any(k in q for k in ["wbc", "white blood cell", "leukocyte", "neutrophil", "lymphocyte"]):
        cell_types.append("WBC (Immune System)")
    if any(k in q for k in ["rbc", "red blood cell", "erythrocyte", "hemoglobin"]):
        cell_types.append("RBC (Oxygen Transport)")
    if any(k in q for k in ["platelet", "thrombocyte"]):
        cell_types.append("Platelets (Clotting)")

    return {
        "primary_cells_affected": cell_types if cell_types else ["Systemic / Multicellular"],
        "morphology_alerts": ["Abnormal" if any(k in q for k in ["sickle", "blast", "clump"]) else "Normal"]
    }

def diagnostic_evidence_aggregator(pipeline_state: Dict) -> Dict:
    """[Module 6: Aggregator] Core decision data for Gemini synthesis."""
    classification = pipeline_state.get("classification", {})
    hematology = pipeline_state.get("hematology", {})
    sampling = pipeline_state.get("sampling", {})
    
    return {
        "entity_category": classification.get("entity_type"),
        "blood_compatibility": hematology.get("compatibility_data"),
        "sampling_needs": sampling.get("required_samples"),
        "is_blood_query": classification.get("is_blood_related"),
        "consensus_status": "Pathological Review Required"
    }
