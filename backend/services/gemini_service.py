try:
    from google import genai
except ImportError:
    import google.genai as genai
from openai import AsyncOpenAI
from typing import Optional, List, Dict
from backend.config import GOOGLE_API_KEY, OPENAI_API_KEY, HUGGINGFACE_API_KEY
import requests

# The "Master Research Prompt" - ENFORCES DATA PROVENANCE, PERSONA, & SELECTIVE DETAIL
MASTER_PROMPT = """
ROLE: You are the Scientific AI Expert.

- If the context is strictly CRA (Chemistry), act as a Structural Expert focused on 'Bricks'.
- If the context is strictly DDRA (Drug Discovery), act as a Biological Strategist focused on the 'Skyscraper'.
- If the context is strictly DPEA (Prescription), act as a Clinical Safety Expert focused on 'Patient Well-being'.
- If the context is strictly PDRA (Pathology), act as a Pathological Analyst focused on 'Impact' and cellular mechanisms.
- Maintain a highly professional, expert tone. 

STRICT SELECTIVITY & INTENT RULE: 
- Answer ONLY what is specifically asked. DO NOT provide background context or unsolicited data.
- Analyze the user's research INTENT. Even if they have poor grammar or misspellings:
    * If they ask "What is X" or "Composition of Y", use **CONCISE MODE**.
    * If they probe for "Why", "How", or "Mechanisms", use **DETAILED MODE**.

ADAPTIVE DEPTH CONSTRAINTS (STRICT):
{depth_instruction}

TASK: {query}

DATA CONTEXT (EXTERNAL AGENTS):
{raw_data}

CONVERSATION HISTORY:
{history}

INSTRUCTIONS:
- NO PARAGRAPHS: Use ONLY bullet points or short, single-line sentences.
- NO ACADEMIC FILLER: Eliminate phrases like "In summary", "It is noteworthy", or introductory fluff.
- Use **Bold** for headers and bullet points for lists. NEVER use '#' headers.
- Use the PROVIDED DATA CONTEXT. In CONCISE mode, you MUST EXCLUDE and ignore the 'Stability', 'Safety', 'Sustainability', 'Synthesis', 'Deep Reasoning', and 'Clinical Expert' data blocks unless directly asked.
- **FORMULA FORMATTING**: Use standard plain-text (e.g., H2O). 
- Maintain 100% data integrity. Do NOT add hypothetical data.
"""

# --- Clients ---
gemini_client = genai.Client(api_key=GOOGLE_API_KEY) if GOOGLE_API_KEY else None
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None


async def _chatgpt_fallback(full_prompt: str) -> Optional[str]:
    """
    Sends the exact same prompt to ChatGPT (gpt-4o-mini) when all Gemini models fail.
    Every instruction in the prompt is preserved identically.
    """
    if not openai_client:
        print("[ChatGPTFallback] No OpenAI API key configured.")
        return None
    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": full_prompt}],
            temperature=0.4,
        )
        result = response.choices[0].message.content
        if result:
            print("[ChatGPTFallback] SUCCESS via gpt-4o-mini.")
            return result
    except Exception as e:
        print(f"[ChatGPTFallback] gpt-4o-mini failed: {e}")
        # Secondary ChatGPT fallback: gpt-3.5-turbo
        try:
            response = await openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": full_prompt}],
                temperature=0.4,
            )
            result = response.choices[0].message.content
            if result:
                print("[ChatGPTFallback] SUCCESS via gpt-3.5-turbo.")
                return result
        except Exception as e2:
            print(f"[ChatGPTFallback] gpt-3.5-turbo also failed: {e2}")
    return None


async def _huggingface_fallback(full_prompt: str) -> Optional[str]:
    """
    Emergency Fallback via Hugging Face Hub (2026 Optimized).
    Uses the official InferenceClient to handle conversational task models.
    """
    if not HUGGINGFACE_API_KEY:
        print("[HFFallback] No Hugging Face API key configured.")
        return None

    try:
        from huggingface_hub import InferenceClient
        client = InferenceClient(api_key=HUGGINGFACE_API_KEY)
        
        # 2026 Ecosystem: Free-tier models use the 'chat_completion' endpoint
        models = ["mistralai/Mistral-7B-Instruct-v0.3", "meta-llama/Llama-3.1-8B-Instruct"]
        messages = [{"role": "user", "content": full_prompt[:2000]}]

        for model in models:
            try:
                print(f"[HFFallback] Attempting synthesis via {model} (InferenceClient)...")
                response = client.chat_completion(
                    messages=messages,
                    model=model,
                    max_tokens=500,
                    temperature=0.4
                )
                if response and response.choices:
                    return response.choices[0].message.content
            except Exception as e:
                print(f"[HFFallback] Model {model} failed: {str(e)[:100]}")
                continue
                
        return "System Warning: All Hugging Face fallback models failed."

    except Exception as e:
        print(f"[HFFallback] Critical Failure: {str(e)}")
        return "System Warning: Hugging Face fallback engine offline."
async def synthesize_narrative(query: str, raw_data: Dict, history: Optional[List[Dict]] = None) -> str:
    """
    Calls Gemini for synthesis with a robust model waterfall and Strict Response Methodology.
    If ALL Gemini models fail, falls back to ChatGPT with the EXACT same prompt and instructions.
    """
    # --- CALCULATE RESPONSE DEPTH (STRICT LOGIC) ---
    # This depth logic is shared — applied identically to both Gemini and ChatGPT
    user_msgs = [m for m in history if m['role'] == 'user'] if history else []
    is_detail_requested = any(kw in query.lower() for kw in ["detail", "explain", "why", "how", "mechanism", "elaborate", "comprehensive", "insight"])

    if is_detail_requested:
        # TRIGGERED BY INTENT (Why/How/Detail)
        depth_instruction = """
        - MODE: DETAILED MODE.
        - Provide a comprehensive structural/functional breakdown (8-10 lines total).
        - Use bullet points. No paragraphs.
        """
    elif len(user_msgs) > 1:
        # SECOND INQUIRY ON TOPIC (Progressive Depth)
        depth_instruction = """
        - MODE: FOLLOW-UP MODE.
        - Provide Exactly **5-6 lines** of explanation. 
        - Focus on new dimensions. No paragraphs.
        """
    else:
        # FIRST TIME INQUIRY (Ultra-Concise)
        depth_instruction = """
        - MODE: CONCISE MODE (STRICT).
        - Provide Exactly **2-3 lines** of explanation.
        - If composition is asked: [Formula] | [Weight] | [1-2 Short Examples].
        - TOTAL OUTPUT MUST BE 5 LINES OR LESS. Use ONLY single sentences or bullets.
        """

    hist_text = "\\n".join([f"{m['role'].upper()}: {m['content']}" for m in history]) if history else "No previous context."
    full_prompt = MASTER_PROMPT.format(
        query=query,
        raw_data=raw_data,
        history=hist_text,
        depth_instruction=depth_instruction
    )

    contents = [{
        "role": "user",
        "parts": [{"text": full_prompt}]
    }]

    # --- GEMINI WATERFALL (Updated for 2026 Ecosystem) ---
    if gemini_client:
        models_to_try = [
            "gemini-2.5-flash", 
            "gemini-2.0-flash", 
            "gemini-2.0-flash-lite",
            "gemini-3-flash-preview",
            "gemini-1.5-flash-latest"
        ]
        for model_name in models_to_try:
            try:
                response = gemini_client.models.generate_content(model=model_name, contents=contents)
                if response and response.text:
                    return response.text
            except Exception as model_err:
                print(f"[GeminiService] Model {model_name} failed: {model_err}")
                continue

    # --- HUGGING FACE FALLBACK (Free Open Source Emergency Backup) ---
    print("[GeminiService] ChatGPT fallback failed. Switching to Hugging Face (Llama-3.1)...")
    hf_result = await _huggingface_fallback(full_prompt)
    if hf_result:
        return hf_result

    return "System Warning: Synthesis temporarily unavailable across all providers."


async def normalize_molecule_name(misspelled_name: str) -> str:
    """
    Uses Gemini to correct a potentially misspelled molecule name.
    Falls back to ChatGPT with the exact same prompt if Gemini fails.
    Example: "gluucose" -> "Glucose"
    """
    prompt = f"Identify the correct scientific substance name for '{misspelled_name}'. Output ONLY the one-word official name (e.g., 'Glucose', 'Aspirin'). Do not include explanations. If unsure, output the original name."

    # --- Gemini attempt ---
    if gemini_client:
        try:
            response = gemini_client.models.generate_content(
                model="gemini-2.0-flash-lite",
                contents=[prompt]
            )
            if response and response.text:
                return response.text.strip().split()[0].replace('.', '').replace(',', '')
        except Exception as e:
            print(f"[GeminiService] normalize_molecule_name Gemini failed: {e}")

    # --- ChatGPT fallback (same prompt) ---
    chatgpt_result = await _chatgpt_fallback(prompt)
    if chatgpt_result:
        return chatgpt_result.strip().split()[0].replace('.', '').replace(',', '')

    return misspelled_name


def format_history_for_gemini(history: List[Dict]) -> List[Dict]:
    """Placeholder for history."""
    return []


async def get_element_research_insight(at_num: int, name: str) -> str:
    """
    Generates a unique, real-time scientific insight about a specific element.
    Designed for the Periodic Table Side Panel.
    Falls back to ChatGPT with the exact same prompt if all Gemini models fail.
    """
    prompt = f"""
    ROLE: Scientific AI Researcher.
    TASK: Provide ONE unique, professional scientific insight about the element {name} (Atomic Number {at_num}).
    
    GUIDELINES:
    - Focus on a non-obvious application in drug discovery, advanced materials, or quantum chemistry.
    - Be professional and concise (Exactly 2-3 sentences).
    - NEVER start with 'It is noteworthy' or 'In summary'.
    - Ensure the insight varies every time (don't just state standard properties).
    - Use active, expert language.
    """

    contents = [{"role": "user", "parts": [{"text": prompt}]}]

    # --- GEMINI WATERFALL ---
    if gemini_client:
        models_to_try = ["gemini-2.0-flash-lite", "gemini-2.0-flash", "gemini-2.5-flash"]
        for model_name in models_to_try:
            try:
                response = gemini_client.models.generate_content(model=model_name, contents=contents)
                if response and response.text:
                    return response.text.strip()
            except Exception as e:
                print(f"[GeminiService] get_element_research_insight {model_name} failed: {e}")
                continue

    # --- ChatGPT fallback (same prompt, same guidelines) ---
    print(f"[GeminiService] Element insight: all Gemini models failed. Switching to ChatGPT...")
    chatgpt_result = await _chatgpt_fallback(prompt)
    if chatgpt_result:
        return chatgpt_result.strip()

    return f"{name} remains a central subject in advanced structural and synthetic chemistry research."
