"""
Orchestrator: 100% Autonomous Synthesis via Gemini.
Coordinates specialized research agents and synthesizes unified outcomes.
"""
import asyncio
import uuid
from typing import Optional

from backend.models import QueryResponse, TokenData
from backend.services.audit_logger import log_event
from backend.services.database import log_query_to_db, add_chat_message, get_chat_history
from backend.agents.chemistry_agent import run as cra_run
from backend.agents.drug_discovery_agent import run as ddra_run
from backend.agents.prescription_agent import run as dpea_run
from backend.agents.pathology_agent import run as pdra_run
from backend.services.shared_utils import refine_query, detect_topic, SCIENTIFIC_DOMAIN_KEYWORDS, GREETINGS
from backend.services.gemini_service import synthesize_narrative

async def orchestrate(
    query: str,
    agent_hint: Optional[str],
    user: TokenData,
) -> QueryResponse:
    """
    Main Brain: Refines query, runs agents, and calls Gemini for ALL natural language.
    """
    # 1. Refinement
    refined_query, clarification, is_on_topic = refine_query(query)
    session_id = user.username or "anonymous"

    # 2. Autonomous Intent Handling via Gemini
    q_low = refined_query.lower().strip("?.! ")
    has_scientific_intent = any(kw in q_low for kw in SCIENTIFIC_DOMAIN_KEYWORDS)
    is_greeting = any(g == q_low for g in GREETINGS) or len(q_low.split()) <= 1
    
    # Strictly enforce scientific domain unless it's a greeting.
    # If agent_hint is provided, we trust the user's intent more and let the planner decide.
    is_actually_on_topic = is_on_topic or (agent_hint is not None and agent_hint != "auto")

    # --- Scenario A: Pure Greeting or Off-Topic ---
    if is_greeting or not is_actually_on_topic:
        topic = detect_topic(query)
        persona = "Scientific AI Assistant"
        
        if agent_hint == "CRA": persona = "Chemistry Research Agent (CRA)"
        elif agent_hint == "DDRA": persona = "Drug Discovery Agent (DDRA)"
        elif agent_hint == "DPEA": persona = "Prescription Evaluation Agent (DPEA)"
        elif agent_hint == "PDRA": persona = "Pathology & Disease Research Agent (PDRA)"
        
        if is_greeting:
            # Simple greeting back
            prompt = f"GREETING: The user said '{query}'. You are the {persona}. Greet them professionally and ask how you can help with their scientific research today. Do not provide a long introduction."
        else:
            # Redirect for off-topic
            prompt = f"REDIRECT: The user said '{query}'. You are the {persona}. Politely explain that this is a {topic} query and you specialize in scientific research. Redirect them to ask about molecules, drugs, or pathology."
            
        response_text = await synthesize_narrative(prompt, {"topic": topic})
        return QueryResponse(
            agent_used=agent_hint or "orchestrator",
            result={
                "agent": agent_hint or "orchestrator",
                "status": "greeting" if is_greeting else "redirect",
                "summary": response_text,
                "is_conversational": is_greeting,
                "is_out_of_domain": not is_greeting
            },
            message="Greeting or Redirect processed."
        )

    # --- Scenario B: Scientific Research (The Multi-Agent Workflow) ---
    
    # 1. Retrieve History Early for Context-Aware Planning
    history = get_chat_history(session_id, limit=6)
    history_context = ""
    if history:
        history_context = "CONTEXT (Last 6 messages):\n" + "\n".join([f"{m['role']}: {m['content']}" for m in history])
    else:
        history_context = "No previous history."

    # 2. Research Planner: Determine needed agents and flow (Sequential vs Parallel)
    # Pass agent_hint to ensure domain-locking if chatting with a specific agent.
    is_auto = agent_hint is None or agent_hint == "auto"
    planner_prompt = f"""
    RESEARCH_PLANNER: You are the brain of a Multi-Agent Scientific Assistant.
    
    {history_context}

    NEW QUERY: "{refined_query}"
    
    AGENT_RESTRICTION: {agent_hint if not is_auto else 'None - Orchestrator Mode'}

    TASK:
    1. Identify the core drug/compound discussed in context or query.
    2. Determine which specialized agents are REQUIRED based on their EXPERTISE:
       - CRA (Structural Expert): Handles chemical properties, molecular stability, and lab synthesis viability.
       - DDRA (Discovery Strategist): Handles biological targets, toxicity prediction, and medical treatment design.
       - DPEA (Clinical Expert): Handles drug safety, dosage verification, and clinical side effects.
       - PDRA (Pathological Analyst): Handles disease mechanisms, tissue changes, and blood samples/compatibility.

    STRICT DOMAIN LOCKING: 
    - If AGENT_RESTRICTION is 'CRA', you MUST ONLY handle chemistry-level questions. If asked about biology/toxicity, return an empty "agents" list.
    - If AGENT_RESTRICTION is 'DDRA', you MUST ONLY handle discovery-level questions. If asked about lab synthesis or basic structure, return an empty "agents" list.
    - If AGENT_RESTRICTION is 'DPEA', you MUST ONLY handle clinical/dosage questions.
    - If AGENT_RESTRICTION is 'PDRA', you MUST ONLY handle pathology, hematology (blood), or disease-related questions.
    - If the user's question belongs to a DIFFERENT domain than AGENT_RESTRICTION, explain exactly which specialist (CRA, DDRA, DPEA, or PDRA) should handle it in the "reasoning" field.

    JSON OUTPUT ONLY:
    {{
        "agents": ["CRA", "DDRA", "DPEA", "PDRA"], // List ONLY the restricted agent if it fits.
        "mode": "sequential" or "parallel",
        "reasoning": "Specify the correct agent referral here if mismatch."
    }}
    """
    import json
    try:
        plan_raw = await synthesize_narrative(planner_prompt, {"task": "PLANNING"})
        plan_clean = plan_raw.strip().replace("```json", "").replace("```", "")
        plan = json.loads(plan_clean)
    except Exception:
        plan = {"agents": ["CRA", "DDRA", "DPEA", "PDRA"] if is_auto else [agent_hint], "mode": "parallel"}

    needed_agents = plan.get("agents", [])
    
    # --- Check for Domain Mismatch Refusal ---
    if not is_auto and agent_hint and agent_hint not in needed_agents:
        reasoning = plan.get('reasoning', 'Domain mismatch.')
        
        # Build High-Fidelity Refusal Narrative (Consice 3-5 lines)
        expert_areas = ""
        if agent_hint == "CRA":
            expert_areas = "* Molecular Stability & Synthetic Pathways\n* Structural Safety & Hazard Prediction\n* Thermodynamics & Bond Energy Analysis"
            refusal_summary = f"I am the specialized **Chemistry (CRA) Agent**. This query falls outside my structural domain. I invite you to focus on my specialized fields:\n\n{expert_areas}\n\nPlease let me know which chemical structure you would like to analyze."
        elif agent_hint == "DDRA":
            # SPECIFIC REFUSAL FOR DDRA (SYNTHESIS MISMATCH) - Already concise
            refusal_summary = f"I am the specialized **Drug Discovery Agent**. I specialize in biological targets and candidate safety (ADMET). Identifying the correct reaction parameters, catalysts, and side products for **A+B → C** is a **Chemistry (CRA)** task. Please consult the Chemistry Agent to ensure a **safe and stable synthesis** before we analyze its medical efficacy."
        elif agent_hint == "DPEA":
            expert_areas = "* Dosage Verification & Drug Compatibility\n* FAERS Safety Signals & Clinical Guidelines\n* Physiological Interactions & Contraindications"
            refusal_summary = f"I am the specialized **Prescription (DPEA) Agent**. This query exceeds my clinical domain. I invite you to focus on my specialized fields:\n\n{expert_areas}\n\nPlease direct your query toward patient safety or dosage verification."
        elif agent_hint == "PDRA":
            expert_areas = "* Disease Mechanisms & Pathophysiology\n* Hematology, Blood Groups & Compatibility\n* Tissue Structural Changes & Diagnostic Sampling"
            refusal_summary = f"I am the specialized **Pathology (PDRA) Agent**. My focus is exclusively on disease impacts, blood hematology, and tissue changes. I invite you to focus on my specialized areas:\n\n{expert_areas}\n\nPlease let me know which disease state, blood group, or tissue sample you would like to analyze."

        return QueryResponse(
            agent_used=agent_hint,
            result={
                "agent": agent_hint,
                "status": "refusal",
                "summary": refusal_summary,
                "reasoning": reasoning
            },
            message="Domain Restriction Active."
        )

    # Fallback for Orchestrator if planner is empty
    if is_auto and not needed_agents:
        needed_agents = ["CRA", "DDRA", "DPEA", "PDRA"]

    mode = plan.get("mode", "parallel")
    cra_res, ddra_res, dpea_res, pdra_res = {}, {}, {}, {}

    # 3. Execution with Data Piping
    if mode == "sequential":
        # Order: CRA -> DDRA -> DPEA -> PDRA (The Scientific Pipeline)
        accumulated_context = ""
        if "CRA" in needed_agents:
            cra_res = await cra_run(refined_query)
            accumulated_context += f"\nCRA_CHEMICAL_DATA: {json.dumps(cra_res.get('raw_data', {}))}"
        if "DDRA" in needed_agents:
            ddra_res = await ddra_run(f"{refined_query}\nCONTEXT: {accumulated_context}")
            accumulated_context += f"\nDDRA_DISCOVERY_DATA: {json.dumps(ddra_res.get('raw_data', {}))}"
        if "DPEA" in needed_agents:
            dpea_res = await dpea_run(f"{refined_query}\nCONTEXT: {accumulated_context}")
        if "PDRA" in needed_agents:
            pdra_res = await pdra_run(f"{refined_query}\nCONTEXT: {accumulated_context}")
    else:
        cra_task  = cra_run(refined_query)  if "CRA"  in needed_agents else asyncio.sleep(0, result={})
        ddra_task = ddra_run(refined_query) if "DDRA" in needed_agents else asyncio.sleep(0, result={})
        dpea_task = dpea_run(refined_query) if "DPEA" in needed_agents else asyncio.sleep(0, result={})
        pdra_task = pdra_run(refined_query) if "PDRA" in needed_agents else asyncio.sleep(0, result={})
        cra_res, ddra_res, dpea_res, pdra_res = await asyncio.gather(cra_task, ddra_task, dpea_task, pdra_task)

    # 4. Combine Data for Final Synthesis
    # Handle PDRA domain_refusal gracefully — pass its message into context
    pdra_data = pdra_res.get("raw_data") if pdra_res else None
    if pdra_data and pdra_data.get("refusal"):
        pdra_data = {"note": pdra_data.get("message", "PDRA: Domain mismatch — redirected.")}

    raw_bundle = {
        "chemistry": cra_res.get("raw_data") if cra_res else None,
        "discovery": ddra_res.get("raw_data") if ddra_res else None,
        "clinical": dpea_res.get("raw_data") if dpea_res else None,
        "pathology": pdra_data,
        "compound_name": cra_res.get("compound_name") or ddra_res.get("compound_name") or dpea_res.get("drug_name") or pdra_res.get("disease_name"),
        "execution_plan": plan
    }

    # 5. Final Autonomous Synthesis
    integrated_report = await synthesize_narrative(refined_query, raw_bundle, history=history)

    # Persistence
    add_chat_message(session_id, "user", refined_query)
    add_chat_message(session_id, "model", integrated_report)
    log_event("QUERY_PROCESSED", user.username, {"agent": "orchestrator", "query": refined_query, "plan": plan})
    log_query_to_db(str(uuid.uuid4()), user.username, "orchestrator", refined_query)

    return QueryResponse(
        agent_used="orchestrator",
        result={
            "agent": "orchestrator",
            "status": "success",
            "summary": integrated_report,
            "raw_data": raw_bundle,
            "compound_name": raw_bundle["compound_name"],
            "plan": plan
        }
    )
