# Scientific AI Assistant (CRA, DDRA, DPEA, PDRA)

A high-fidelity, multi-agent scientific research platform powered by Gemini and a 6-model ensemble. This assistant specializes in Chemistry, Drug Discovery, Prescription Evaluation, and Pathology.

## 🚀 Quick Start (VS Code)

### 1. Clone the Repository
Open your terminal and run:
```powershell
git clone https://github.com/palgunbharadwaj/Scientific-AI-Assistant-2.git
cd Scientific-AI-Assistant-2
```

### 2. Prerequisites
- **Python 3.9+** installed on your system.
- **VS Code Extensions**: Install the 'Python' extension.

### 3. Environment Setup
Create a file named `.env` in the root directory and add your API keys:
```env
SECRET_KEY=any-random-string-for-security
DATABASE_URL=sqlite:///./scientific_assistant.db
GOOGLE_API_KEY="YOUR_GEMINI_KEY"
HUGGINGFACE_API_KEY="YOUR_HF_KEY"
OPENAI_API_KEY="YOUR_OPENAI_KEY"
```
*Note: The Login/Register system will NOT work without the `SECRET_KEY`.*

### 4. Installation
Open the VS Code terminal and run:
```powershell
# Create virtual environment
python -m venv venv

# Activate it (Windows)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 5. Running the Project
```powershell
uvicorn backend.main:app --reload
```
Once running, open your browser to `http://127.0.0.1:8000/app/`.

## 🛠 Features
- **Discovery Engine**: Dynamic 3D molecular visualization (Ball and Stick model).
- **Periodic Table**: Real-time AI insights for every element.
- **Multi-Agent Orchestrator**: Automatically routes queries to specialized scientists.
- **Pathology Research**: Advanced hematology and diagnostic analysis.

## 📂 Project Structure
- `/backend`: FastAPI routers and logic.
- `/frontend`: HTML/JS/CSS (Three.js for 3D).
- `scientific_assistant.db`: Automatically generated SQLite database.