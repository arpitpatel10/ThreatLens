
import joblib
from pathlib import Path

# Find the models folder
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"

# Load all three saved files
model = joblib.load(MODEL_DIR / "random_forest_model.pkl")
vectorizer = joblib.load(MODEL_DIR / "tfidf_vectorizer.pkl")
encoder = joblib.load(MODEL_DIR / "label_encoder.pkl")

print("All model files loaded successfully!")

# Check whether Random Forest is fitted
print("Expected trees:", model.n_estimators)
print("Available trained trees:", len(model.estimators_))

# Test with sample threat intelligence text
sample_text = [
    "Multiple files were encrypted and a ransom note demanded cryptocurrency payment."
]

# Convert text into TF-IDF features
sample_features = vectorizer.transform(sample_text)

# Predict the threat class
prediction = model.predict(sample_features)

# Convert encoded prediction into original class name
predicted_class = encoder.inverse_transform(prediction)

print("Predicted threat class:", predicted_class[0])
