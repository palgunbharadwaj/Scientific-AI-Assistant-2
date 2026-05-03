from fastapi import APIRouter, HTTPException
from backend.services.pubchem_api import get_compound_by_name
from backend.services.gemini_service import normalize_molecule_name
import aiohttp

router = APIRouter(prefix="/chem", tags=["Chemistry"])

@router.get("/search/{name}")
async def search_molecule(name: str):
    """Search for a molecule by name and return basic data including SMILES."""
    # Attempt 1: Direct Lookup
    data = await get_compound_by_name(name)
    
    # Attempt 2: Smart Healing (Fallback for typos like "gluucose")
    if "error" in data:
        healed_name = await normalize_molecule_name(name)
        if healed_name.lower() != name.lower():
            data = await get_compound_by_name(healed_name)
    
    if "error" in data:
        raise HTTPException(status_code=404, detail=data["error"])
    return data

@router.get("/3d/{cid}")
async def get_3d_coordinates(cid: int):
    """Fetch 3D SDF data from PubChem for visualization."""
    url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/SDF?record_type=3d"
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(url, timeout=10) as resp:
                if resp.status != 200:
                    # Fallback to 2D if 3D is not available
                    url_2d = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{cid}/SDF"
                    async with session.get(url_2d, timeout=10) as resp2:
                        if resp2.status != 200:
                            raise HTTPException(status_code=404, detail="SDF data not found")
                        return {"sdf": await resp2.text(), "dim": "2d"}
                return {"sdf": await resp.text(), "dim": "3d"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
