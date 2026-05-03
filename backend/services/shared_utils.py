"""
Shared Scientific Utilities — Domain Logic & Query Refinement.
Provides strict keyword-based classification and spelling refinement.
NO TEMPLATES - All narratives generated via Gemini.
"""
import re
from difflib import get_close_matches
from typing import Tuple, List, Optional, Dict

# --- Scientific Domain Keywords ---
SCIENTIFIC_DOMAIN_KEYWORDS = [
    "molecule", "atom", "chemical", "drug", "medicine", "prescription", "clinical",
    "pharmacology", "toxicity", "reaction", "compound", "protein", "enzyme", "lab",
    "synthesis", "discovery", "admet", "structure", "smiles", "pubchem", "chembl",
    "health", "disease", "treatment", "virus", "bacteria", "cell", "dna", "rna",
    "chemistry", "biological", "pharma", "dose", "tablet", "molecular", "bio",
    "scientific", "analysis", "assessment", "research", "pathology", "blood", "tissue"
]

GREETINGS = ["hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening", "how are you", "what's up"]

# --- Off-Topic Categories ---
OFF_TOPIC_MATH = ["solve", "equation", "plus", "minus", "divided", "times", "integral", "derivative", "calculate", "x =", "y =", "algebra", "geometry"]
OFF_TOPIC_GK = ["president", "election", "who is", "capital of", "weather", "news", "current affairs", "gk", "history", "geography", "politics", "sports", "film", "movie", "celebrity"]

SCIENTIFIC_TERMS = [
    "Aspirin", "Ibuprofen", "Paracetamol", "Metformin", "Warfarin", 
    "Penicillin", "Insulin", "Atorvastatin", "Amoxicillin", "Lisinopril",
    "Acetylsalicylic Acid", "Acetaminophen", "Ethanol", "Methanol",
    "Glucose", "Fructose", "SMILES", "PubChem", "ChEMBL", "ADMET",
    "Pharmacokinetics", "Toxicity", "Hazard", "Synthesis", "Reaction"
]

def is_scientific_query(query: str) -> bool:
    """Verifies if the query belongs to the Scientific/Medical/Drug domain or is a greeting."""
    q = query.lower()
    if any(g == q.strip("?.!") for g in GREETINGS) or len(q.split()) <= 1:
        return True
    return any(kw in q for kw in SCIENTIFIC_DOMAIN_KEYWORDS)

def detect_topic(query: str) -> str:
    """Classifies the query topic for redirection messages."""
    q = query.lower()
    if any(m in q for m in OFF_TOPIC_MATH):
        return "Mathematics"
    if any(g in q for g in OFF_TOPIC_GK):
        return "General Knowledge/Current Affairs"
    return "General Topics"

def refine_query(query: str) -> Tuple[str, Optional[str], bool]:
    """
    Refines the user's query and checks for domain compliance.
    """
    q = query.strip()
    is_on_topic = is_scientific_query(q)
    
    words = re.findall(r'\b\w+\b', q)
    refined_words = []

    for word in words:
        if len(word) < 4:
            refined_words.append(word)
            continue
            
        matches = get_close_matches(word.capitalize(), SCIENTIFIC_TERMS, n=1, cutoff=0.75)
        if matches and matches[0].lower() != word.lower():
            refined_words.append(matches[0])
        else:
            refined_words.append(word)

    refined_query = q
    for orig, refined in zip(words, refined_words):
        if orig.lower() != refined.lower():
            refined_query = refined_query.replace(orig, refined)
            
    return refined_query, None, is_on_topic
