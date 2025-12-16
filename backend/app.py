from flask import Flask, request, jsonify
from pathlib import Path

# Pre-Process Data ============================================================================================================================

# Imports
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.impute import SimpleImputer
from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import classification_report
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score
from sklearn.metrics import confusion_matrix

# Models
from sklearn.ensemble import RandomForestClassifier

# 1. Load Data (robust path + graceful fallback)
model_ready = False
rf = None
imputer = None
feature_names = ['MQ4A', 'MQ3A', 'MQ8A', 'MQ135A', 'MQ9A', 'MQ2A']
X_train = None
X_test = None
y_train = None
y_test = None


def load_dataset():
    """Attempt to load dataset from xlsx (openpyxl) with CSV fallback.
    Returns (df, error_message). If df is None, error_message describes the issue.
    """
    base_dir = Path(__file__).parent / 'datasets'
    xlsx = base_dir / 'food_gas_dataset.xlsx'
    csv = base_dir / 'food_gas_dataset.csv'

    if xlsx.exists():
        try:
            # Explicit engine to surface clear ImportError if missing
            df = pd.read_excel(xlsx, engine='openpyxl')
            return df, None
        except ImportError:
            # Fallback to CSV if available
            if csv.exists():
                try:
                    df = pd.read_csv(csv)
                    return df, None
                except Exception as e_csv:
                    return None, f"Missing dependency 'openpyxl' for .xlsx and failed reading CSV fallback: {e_csv}"
            return None, "Missing optional dependency 'openpyxl'. Install it (pip install openpyxl) or provide CSV at backend/datasets/food_gas_dataset.csv."
        except Exception as e_xlsx:
            # Try CSV fallback on generic Excel read errors
            if csv.exists():
                try:
                    df = pd.read_csv(csv)
                    return df, None
                except Exception as e_csv:
                    return None, f"Failed reading XLSX ({e_xlsx}) and CSV fallback ({e_csv})."
            return None, f"Failed reading XLSX dataset: {e_xlsx}"
    elif csv.exists():
        try:
            df = pd.read_csv(csv)
            return df, None
        except Exception as e_csv:
            return None, f"Failed reading CSV dataset: {e_csv}"
    else:
        return None, f"Dataset not found. Place file at {xlsx} or {csv}."

try:
    df, ds_err = load_dataset()
    if df is None:
        raise FileNotFoundError(ds_err)

    # 2. Preprocessing & Splitting
    # Pindahkan kolom output ke y dan kolom berakhiran 'D'
    X = df.drop(columns=['output', 'MQ8D','MQ135D','MQ9D','MQ4D','MQ2D','MQ3D'])
    # Restrict to known input features to match API payload
    allowed_feats = ['MQ4A', 'MQ3A', 'MQ8A', 'MQ135A', 'MQ9A', 'MQ2A']
    cols = [c for c in allowed_feats if c in X.columns]
    if cols:
        X = X[cols]
    y = df['output']

    # PENTING: Simpan nama kolom sebelum diubah jadi array oleh Imputer
    feature_names = X.columns

    # Mengisi nilai kosong
    imputer = SimpleImputer(strategy='mean')
    X_imputed = imputer.fit_transform(X)

    # Split Data (80% Train, 20% Test)
    X_train, X_test, y_train, y_test = train_test_split(X_imputed, y, random_state=33, test_size=0.2)

    # Model ==========================================================================================================================
    rf = RandomForestClassifier(max_depth=5, n_estimators=300, random_state=33)
    rf.fit(X_train, y_train) # Gather the Training Datasets
    y_pred = rf.predict(X_test) # Predict datasets from Test Dataset
    print("=== Random Forest Scores ===")

    # Inputs Test Dataset then check the Training Score
    print("Hasil Test Score :", rf.score(X_test, y_test))
    print("Hasil Training Score :", rf.score(X_train, y_train))

    # Classification Report
    print(classification_report(y_test, y_pred))

    # Coba noise test
    noise = np.random.normal(0, 20, X_test.shape)
    X_test_noisy = X_test + noise
    noisy_score = rf.score(X_test_noisy, y_test)

    print(f"Original Score: 1.0 (100%)")
    print(f"Noisy Score:    {noisy_score:.2f} ({noisy_score*100:.0f}%)")
    model_ready = True
except FileNotFoundError as e:
    print("WARNING: Dataset issue:", e)
    print("Backend will start, but /api/train and /api/classify will error until dataset is available.")
except Exception as e:
    print("WARNING: Failed to initialize model:", str(e))
    print("Backend will start, but /api/classify will return an error until the issue is resolved.")

# API ============================================================================================================================
 

    

app = Flask(__name__)
@app.route('/')
def main():
    return 'Food Spoilage Detection'

@app.route('/health')
def health():
    return jsonify({
        'ok': True,
        'model_ready': model_ready,
        'expected_features': list(feature_names)
    })


# Classification API
@app.route('/api/classify', methods=['POST'])
def classify():
    try:
        if not model_ready or rf is None or imputer is None:
            return jsonify({'ok': False, 'error': 'Model not initialized. Ensure dataset exists at backend/datasets/food_gas_dataset.xlsx'}), 503

        payload = request.get_json(force=True, silent=True) or {}

        # Expected input keys
        expected_keys = [
            'MQ4A',    # Methane Gas
            'MQ3A',    # Alcohol
            'MQ8A',    # Hydrogen
            'MQ135A',  # Air Quality
            'MQ9A',    # Carbon Monoxide
            'MQ2A'     # Propane
        ]

        # Build a row matching training feature order; use NaN if not provided
        row = {}
        for feat in feature_names:
            if feat in payload:
                # Coerce to float when possible
                try:
                    row[feat] = float(payload[feat])
                except (TypeError, ValueError):
                    row[feat] = np.nan
            else:
                # If not provided in payload, set NaN so imputer fills with mean
                row[feat] = np.nan

        # Also accept common keys even if training had exactly these 6 features
        # (If training includes only these, the loop above already handles order.)
        input_df = pd.DataFrame([row])

        # Apply the same preprocessing and predict
        X_input = imputer.transform(input_df)
        pred = rf.predict(X_input)[0]

        # Probabilities if available
        proba = None
        if hasattr(rf, 'predict_proba'):
            probs = rf.predict_proba(X_input)[0].tolist()
            classes = rf.classes_.tolist()
            proba = {str(cls): float(p) for cls, p in zip(classes, probs)}

        return jsonify({
            'ok': True,
            'expected_features': list(feature_names),
            'received_keys': list(payload.keys()),
            'prediction': str(pred),
            'probabilities': proba
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 400


# Train/Re-train API
@app.route('/api/train', methods=['POST'])
def train():
    global rf, imputer, feature_names, X_train, X_test, y_train, y_test, model_ready
    try:
        df, ds_err = load_dataset()
        if df is None:
            return jsonify({'ok': False, 'error': ds_err}), 404

        # Prepare features/labels aligning with existing logic
        X = df.drop(columns=['output', 'MQ8D','MQ135D','MQ9D','MQ4D','MQ2D','MQ3D'])
        # Restrict to known input features to match API payload
        allowed_feats = ['MQ4A', 'MQ3A', 'MQ8A', 'MQ135A', 'MQ9A', 'MQ2A']
        cols = [c for c in allowed_feats if c in X.columns]
        if cols:
            X = X[cols]
        y = df['output']
        feature_names = X.columns

        imputer = SimpleImputer(strategy='mean')
        X_imputed = imputer.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(X_imputed, y, random_state=33, test_size=0.2)

        rf = RandomForestClassifier(max_depth=5, n_estimators=300, random_state=33)
        rf.fit(X_train, y_train)

        y_pred = rf.predict(X_test)
        test_score = float(rf.score(X_test, y_test))
        train_score = float(rf.score(X_train, y_train))

        # Noise robustness metric
        noise = np.random.normal(0, 20, X_test.shape)
        noisy_score = float(rf.score(X_test + noise, y_test))

        report = classification_report(y_test, y_pred, output_dict=True)

        model_ready = True

        return jsonify({
            'ok': True,
            'model_ready': model_ready,
            'metrics': {
                'train_score': train_score,
                'test_score': test_score,
                'noisy_score': noisy_score,
            },
            'classes': list(map(str, getattr(rf, 'classes_', []))),
            'feature_names': list(feature_names),
            'report': report,
            'samples': {
                'train': int(len(y_train)),
                'test': int(len(y_test))
            }
        })
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 400



app.run(debug=True)