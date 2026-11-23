
from pathlib import Path
import io
import pandas as pd

import joblib
import numpy as np

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# ==========================================
# 1. PROJECT PATHS
# ==========================================

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"


# ==========================================
# 2. LOAD TRAINED MACHINE LEARNING FILES
# ==========================================

rf_model = joblib.load(MODEL_DIR / "random_forest_model.pkl")
vectorizer = joblib.load(MODEL_DIR / "tfidf_vectorizer.pkl")
encoder = joblib.load(MODEL_DIR / "label_encoder.pkl")


# ==========================================
# 3. INITIALIZE FASTAPI
# ==========================================

app = FastAPI(
    title="Cyber Threat Intelligence Analyzer",
    description="Cyber threat classification using NLP and Machine Learning",
    version="1.0.0"
)


# ==========================================
# 4. CORS CONFIGURATION
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# 5. REQUEST MODEL
# ==========================================

class ThreatRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Threat intelligence text for classification"
    )


# ==========================================
# 6. HOME ENDPOINT
# ==========================================

@app.get("/")
def home():
    return {
        "message": "Cyber Threat Intelligence Analyzer API is running",
        "status": "online"
    }


# ==========================================
# 7. HEALTH CHECK ENDPOINT
# ==========================================

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model": "Random Forest",
        "model_loaded": True,
        "classes": len(encoder.classes_)
    }


# ==========================================
# 8. THREAT PREDICTION ENDPOINT
# ==========================================

@app.post("/predict")
def predict_threat(request: ThreatRequest):

    # Clean input
    input_text = request.text.strip()

    if not input_text:
        raise HTTPException(
            status_code=400,
            detail="Please enter threat intelligence text."
        )

    # Convert text into TF-IDF features
    features = vectorizer.transform([input_text])

    # Get prediction probabilities
    probabilities = rf_model.predict_proba(features)[0]

    # Get indices of the top 3 predictions
    top_indices = np.argsort(probabilities)[::-1][:3]

    top_predictions = []

    for index in top_indices:

        # Get encoded class from Random Forest
        encoded_class = int(rf_model.classes_[index])

        # Convert encoded class into original label
        class_name = encoder.inverse_transform(
            [encoded_class]
        )[0]

        top_predictions.append({
            "class": str(class_name),
            "model_score_percent": round(
                float(probabilities[index]) * 100, 2
            )
        })

    # Get highest prediction
    predicted_class = top_predictions[0]["class"]
    confidence = top_predictions[0]["model_score_percent"]

    # Low-confidence warning
    warning = None

    if confidence < 50:
        warning = (
            "Prediction is uncertain: the highest class probability "
            "is below 50%. Treat this result as low-confidence and "
            "verify it with additional security evidence and analyst review."
        )

    # Return results
    return {
        "input_text": input_text,
        "predicted_class": predicted_class,
        "model_score_percent": confidence,
        "top_predictions": top_predictions,
        "warning": warning
    }



# ==========================================
# 9. BULK CSV THREAT PREDICTION ENDPOINT
# ==========================================

@app.post("/predict-csv")
async def predict_csv(file: UploadFile = File(...)):

    # Validate uploaded file
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid CSV file."
        )

    # Read uploaded CSV
    try:
        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="The uploaded CSV file is empty."
            )

        df = pd.read_csv(io.BytesIO(contents))

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read CSV. Please check the file format."
        )

    # Validate CSV columns
    if "text" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="CSV must contain a column named 'text'."
        )

    if len(df) == 0:
        raise HTTPException(
            status_code=400,
            detail="CSV contains no records."
        )

    if len(df) > 1000:
        raise HTTPException(
            status_code=400,
            detail="Maximum 1000 records are allowed per upload."
        )

    # Clean input records
    texts = df["text"].fillna("").astype(str).str.strip()

    valid_mask = texts != ""

    if not valid_mask.any():
        raise HTTPException(
            status_code=400,
            detail="No valid text records found in the CSV."
        )

    # Transform all valid text records
    valid_texts = texts[valid_mask].tolist()
    features = vectorizer.transform(valid_texts)

    # Generate predictions
    predictions = rf_model.predict(features)
    probabilities = rf_model.predict_proba(features)

    results = []
    prediction_index = 0

    # Preserve original row order
    for row_index, text_value in enumerate(texts):

        if not valid_mask.iloc[row_index]:
            results.append({
                "row": row_index + 1,
                "input_text": "",
                "predicted_class": None,
                "model_score_percent": None,
                "status": "Skipped: empty text"
            })
            continue

        predicted_encoded = int(predictions[prediction_index])

        predicted_class = str(
            encoder.inverse_transform([predicted_encoded])[0]
        )

        model_score = round(
            float(np.max(probabilities[prediction_index])) * 100,
            2
        )

        results.append({
            "row": row_index + 1,
            "input_text": text_value,
            "predicted_class": predicted_class,
            "model_score_percent": model_score,
            "status": "Completed"
        })

        prediction_index += 1

    return {
        "filename": file.filename,
        "total_records": len(df),
        "processed_records": len(valid_texts),
        "skipped_records": len(df) - len(valid_texts),
        "results": results
    }
