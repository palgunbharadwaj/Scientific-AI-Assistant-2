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

    # 2. Dynamic Intent Handling
    q_low = refined_query.lower().strip("?.! ")
    is_greeting = any(g == q_low for g in GREETINGS) or len(q_low.split()) <= 1

    # --- Scenario A: Pure Greeting ---
    if is_greeting:
        persona = "Scientific AI Assistant"
        if agent_hint == "CRA": persona = "Chemistry Research Agent (CRA)"
        elif agent_hint == "DDRA": persona = "Drug Discovery Agent (DDRA)"
        elif agent_hint == "DPEA": persona = "Prescription Evaluation Agent (DPEA)"
        elif agent_hint == "PDRA": persona = "Pathology & Disease Research Agent (PDRA)"
        
        prompt = f"GREETING: The user said '{query}'. You are the {persona}. Greet them professionally and ask how you can help with their scientific research today. Do not provide a long introduction."
        response_text = await synthesize_narrative(prompt, {"task": "GREETING"})
        return QueryResponse(
            agent_used=agent_hint or "orchestrator",
            result={
                "agent": agent_hint or "orchestrator",
                "status": "greeting",
                "summary": response_text,
                "is_conversational": True,
                "is_out_of_domain": False
            },
            message="Greeting processed."
        )

    # --- Scenario B: Dynamic Research Planning (Scientific or Redirect) ---
    
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
    1. Determine if the query is SCIENTIFIC (Chemistry, Biology, Drugs, Pathology, Clinical).
    2. If NOT scientific (e.g., general knowledge, math, news), return "agents": [] and "reasoning": "OFF_TOPIC: [Topic Name]".
    3. If scientific:
       - Identify the core drug/compound.
       - Determine required specialized agents:
         - CRA (Structural Expert): Chemistry, molecular stability, synthesis.
         - DDRA (Discovery Strategist): Biological targets, toxicity, medical treatment design.
         - DPEA (Clinical Expert): Drug safety, dosage, clinical interactions.
         - PDRA (Pathological Analyst): Disease mechanisms, blood, tissue, cellular impact.

    STRICT DOMAIN LOCKING: 
    - If AGENT_RESTRICTION is NOT 'None', and the query belongs to a DIFFERENT domain, return "agents": [] and "reasoning": "REFUSAL: [Detailed Reason]".

    JSON OUTPUT ONLY:
    {{
        "agents": ["CRA", "DDRA", "DPEA", "PDRA"], // Empty if off-topic or domain mismatch.
        "mode": "sequential" or "parallel",
        "reasoning": "Explain classification or refusal logic."
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
    
    # --- Check for Off-Topic or Domain Mismatch Refusal ---
    if not needed_agents:
        reasoning = plan.get('reasoning', '')
        persona = "Scientific AI Assistant"
        if agent_hint == "CRA": persona = "Chemistry Research Agent (CRA)"
        elif agent_hint == "DDRA": persona = "Drug Discovery Agent (DDRA)"
        elif agent_hint == "DPEA": persona = "Prescription Evaluation Agent (DPEA)"
        elif agent_hint == "PDRA": persona = "Pathology & Disease Research Agent (PDRA)"

        if "OFF_TOPIC" in reasoning:
            topic = reasoning.split("OFF_TOPIC:")[-1].strip()
            prompt = f"REDIRECT: The user said '{query}'. You are the {persona}. Politely explain that this is a {topic} query and you specialize in scientific research. Redirect them to ask about molecules, drugs, or pathology."
            status = "redirect"
        else:
            # Domain Refusal
            prompt = f"REFUSE: The user said '{query}'. You are the {persona}. {reasoning}. Explain that you cannot handle this specific domain and invite them to ask about your specialized scientific fields."
            status = "refusal"

        response_text = await synthesize_narrative(prompt, {"task": "REJECTION"})
        return QueryResponse(
            agent_used=agent_hint or "orchestrator",
            result={
                "agent": agent_hint or "orchestrator",
                "status": status,
                "summary": response_text,
                "reasoning": reasoning,
                "is_out_of_domain": True
            },
            message="Dynamic domain restriction active."
        )

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
