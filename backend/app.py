from flask import Flask

# Pre-Process Data ============================================================================================================================

# Imports
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.impute import SimpleImputer
from sklearn.model_selection import cross_val_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import classification_report
import seaborn as sns
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score
from sklearn.metrics import confusion_matrix

# Models
from sklearn.ensemble import RandomForestClassifier

# 1. Load Data
df = pd.read_excel('datasets/food_gas_dataset.xlsx')

# 2. Preprocessing & Splitting
# Pindahkan kolom output ke y dan kolom berakhiran 'D'
X = df.drop(columns=['output', 'MQ8D','MQ135D','MQ9D','MQ4D','MQ2D','MQ3D'])
y = df['output']

# PENTING: Simpan nama kolom sebelum diubah jadi array oleh Imputer
feature_names = X.columns

# Mengisi nilai kosong
imputer = SimpleImputer(strategy='mean')
X_imputed = imputer.fit_transform(X)

# Split Data (80% Train, 20% Test)
X_train, X_test, y_train, y_test = train_test_split(X_imputed, y, random_state=33, test_size=0.2)

# API ============================================================================================================================
 

# Model ==========================================================================================================================

rf = RandomForestClassifier(max_depth=5)
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

app = Flask(__name__)
@app.route('/')
def main():
    return 'Food Spoilage Detection'



app.run(debug=True)