# ThreatLens – Cyber Threat Intelligence Classification Platform

**An AI-powered Cyber Threat Intelligence (CTI) classification platform using Natural Language Processing (NLP) and Machine Learning.**

ThreatLens analyzes cybersecurity-related text and classifies it into threat intelligence categories using a trained Machine Learning model. It also supports bulk CSV analysis, historical analytics, and visual reporting through an interactive web dashboard.

---

## Overview

ThreatLens is an academic and practical cybersecurity project developed to explore how Machine Learning and NLP can assist in classifying Cyber Threat Intelligence data.

The platform accepts individual threat-related text or CSV files containing multiple records. It processes the text using TF-IDF vectorization and predicts the corresponding CTI category using a trained Random Forest classifier.

## Key Features

- **Threat Classification:** Classifies cybersecurity-related text into CTI categories.
- **Bulk CSV Analysis:** Upload CSV files and classify multiple records.
- **Top Predictions:** Displays the top predicted categories and their model scores.
- **Threat Analytics:** Visualizes category distribution and model-score statistics.
- **Historical CSV Analytics:** Stores and compares previous CSV analysis batches.
- **Analysis History:** Maintains individual analysis records in browser storage.
- **PDF Reports:** Generate downloadable analysis reports.
- **REST API:** FastAPI-powered backend for machine learning predictions.
- **Interactive Dashboard:** Dark-themed cybersecurity intelligence interface.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite |
| Styling | CSS |
| Backend | Python, FastAPI |
| Machine Learning | Scikit-learn |
| NLP | TF-IDF Vectorizer |
| Classification Algorithm | Random Forest |
| Data Processing | Pandas, NumPy |
| API Server | Uvicorn |
| Model Storage | Pickle |
| Version Control | Git, GitHub |

## Machine Learning Workflow

1. Collect and load the cybersecurity text dataset.
2. Preprocess and clean the text data.
3. Convert text into numerical features using TF-IDF.
4. Train the Random Forest classification model.
5. Evaluate model performance.
6. Save the trained model, vectorizer, and label encoder.
7. Load the saved components into the FastAPI backend.
8. Accept text or CSV input and generate predictions.

### Model Evaluation

Previously evaluated test-set results:

| Metric | Result |
|---|---:|
| Accuracy | 88.33% |
| Macro F1-score | 0.80 |
| Weighted F1-score | 0.88 |
| Test samples | 1,988 |

*These are recorded evaluation results from the model's test set, not a guarantee of performance on new data.*

## Project Structure

```text
Cyber-Threat-Intelligence-Analyzer/
│
├── backend/
│   ├── main.py
│   └── test_model.py
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── models/
│   ├── random_forest_model.pkl
│   ├── tfidf_vectorizer.pkl
│   └── label_encoder.pkl
│
├── download_live_threatlens_data.py
├── requirements.txt
└── .gitignore
```

## Installation and Setup

### Prerequisites

- Python 3.10 or later
- Node.js and npm
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/arpitpatel10/ThreatLens.git
```

```bash
cd ThreatLens
```

### 2. Set Up the Backend

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```bash
venv\Scripts\activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
cd backend
uvicorn main:app --reload
```

Backend URL:

`http://127.0.0.1:8000`

API documentation:

`http://127.0.0.1:8000/docs`

### 3. Set Up the Frontend

Open a second terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Frontend URL:

`http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | API welcome endpoint |
| GET | `/health` | Backend health check |
| POST | `/predict` | Classify individual threat text |
| POST | `/predict-csv` | Classify records from a CSV file |

## CSV Input Format

For bulk analysis, upload a CSV file containing a column named `text`.

Example:

```csv
text
"Suspicious login activity detected from an unknown IP address."
"Malware discovered on an infected endpoint."
"Threat actor attempted unauthorized access."
```

The backend supports up to 1,000 records per CSV request.

## Important Notes

- The model predicts categories based on the classes represented in its training dataset.
- Model scores are prediction scores and should not be interpreted as calibrated confidence or confirmed threat severity.
- ThreatLens is an academic machine learning project and is not a replacement for a production Security Operations Center (SOC) platform.
- The frontend analysis history is stored locally in the browser.

## Future Enhancements

- Integration with live threat intelligence feeds and APIs.
- Real-time threat intelligence monitoring.
- Explainable AI using SHAP.
- Advanced threat analytics and interactive visualizations.
- User authentication and role-based access.
- Database integration for persistent analysis history.
- Integration with SIEM platforms.

## Project Information

**Project Name:** ThreatLens – Cyber Threat Intelligence Classification Using NLP and Machine Learning

**Project Type:** M.Tech Academic Project

**Domain:** Cybersecurity, Artificial Intelligence, Machine Learning, and Natural Language Processing.

**Developer:** Arpit Patel

**GitHub:** https://github.com/arpitpatel10

---

*ThreatLens – Turning Cyber Threat Intelligence into Actionable Insights.*
