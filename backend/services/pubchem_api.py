"""
External API Layer — PubChem Integration.
Fetches compound data by name or CID.
"""
import aiohttp
from typing import Optional

PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug"


async def get_compound_by_name(name: str) -> dict:
    """Fetch basic compound info from PubChem by compound name."""
    url = f"{PUBCHEM_BASE}/compound/name/{name}/JSON"
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return {"error": f"PubChem returned status {resp.status} for '{name}'"}
                data = await resp.json()
                compound = data["PC_Compounds"][0]
                cid = compound["id"]["id"]["cid"]
                props = {p["urn"]["label"]: p.get("value", {}) for p in compound.get("props", [])}
                
                # Extract official display name (IUPAC or Preferred)
                official_name = props.get("IUPAC Name", {}).get("sval") or \
                                props.get("Preferred Name", {}).get("sval") or \
                                name.capitalize()

                return {
                    "source": "PubChem",
                    "cid": cid,
                    "name": official_name,
                    "molecular_formula": props.get("Molecular Formula", {}).get("sval", "N/A"),
                    "molecular_weight": props.get("Molecular Weight", {}).get("fval", "N/A"),
                    "iupac_name": props.get("IUPAC Name", {}).get("sval", "N/A"),
                    "canonical_smiles": props.get("SMILES", {}).get("sval", "N/A"),
                    "pubchem_url": f"https://pubchem.ncbi.nlm.nih.gov/compound/{cid}",
                }
        except aiohttp.ClientConnectorError:
            return {"error": "PubChem API unreachable. Check network."}
        except Exception as e:
            return {"error": str(e)}


async def get_compound_safety(cid: int) -> dict:
    """Fetch GHS hazard data for a compound by CID."""
    url = f"{PUBCHEM_BASE}/compound/cid/{cid}/property/IUPACName,MolecularFormula,MolecularWeight/JSON"
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                if resp.status != 200:
                    return {"error": f"Safety data fetch failed: status {resp.status}"}
                data = await resp.json()
                return {
                    "source": "PubChem",
                    "cid": cid,
                    "properties": data.get("PropertyTable", {}).get("Properties", [{}])[0],
                }
        except Exception as e:
            return {"error": str(e)}
