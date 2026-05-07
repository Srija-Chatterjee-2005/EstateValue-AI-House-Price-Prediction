"""EstateValue AI - ML training and export script.
Run: python ml/train_models.py
Creates synthetic housing data, trains regression models, exports dashboard JSON for Next.js.
"""
from __future__ import annotations

import json
from pathlib import Path
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

try:
    from xgboost import XGBRegressor
except Exception:
    XGBRegressor = None  # fallback is used if xgboost is not installed
try:
    from lightgbm import LGBMRegressor
except Exception:
    LGBMRegressor = None  # fallback is used if lightgbm is not installed
try:
    import shap
except Exception:
    shap = None  # dashboard still uses exported feature impact for SHAP-style explainability

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
FRONTEND_DATA_DIR = ROOT / "frontend" / "data"
OUTPUT_DIR = ROOT / "outputs"
for d in (DATA_DIR, FRONTEND_DATA_DIR, OUTPUT_DIR):
    d.mkdir(parents=True, exist_ok=True)

RNG = np.random.default_rng(42)

LOCATIONS = {
    "Budget Zone": 0.85,
    "Developing Zone": 1.00,
    "Family Zone": 1.12,
    "IT Hub": 1.32,
    "Premium Central": 1.58,
}
FURNISHING = {"Unfurnished": 0, "Semi-Furnished": 1, "Fully Furnished": 2}
QUALITY = {"Standard": 0, "Good": 1, "Premium": 2, "Luxury": 3}


def make_synthetic_housing(n: int = 900) -> pd.DataFrame:
    location = RNG.choice(list(LOCATIONS), size=n, p=[.18, .25, .25, .20, .12])
    furnishing = RNG.choice(list(FURNISHING), size=n, p=[.30, .45, .25])
    quality = RNG.choice(list(QUALITY), size=n, p=[.25, .40, .25, .10])
    area = RNG.normal(1450, 520, size=n).clip(450, 4200).round()
    bedrooms = np.clip(np.round(area / 600 + RNG.normal(0.5, .65, n)), 1, 6).astype(int)
    bathrooms = np.clip(np.round(bedrooms - RNG.choice([0,1], size=n, p=[.55,.45]) + RNG.normal(.4,.45,n)), 1, 5).astype(int)
    age = RNG.integers(0, 35, size=n)
    parking = RNG.choice([0, 1, 2], size=n, p=[.25, .55, .20])
    floor = RNG.integers(1, 25, size=n)
    near_metro = RNG.choice([0, 1], size=n, p=[.48, .52])
    balcony = RNG.choice([0, 1, 2, 3], size=n, p=[.18, .45, .28, .09])

    base = area * 4200
    loc_factor = np.array([LOCATIONS[x] for x in location])
    furnish_bonus = np.array([FURNISHING[x] for x in furnishing]) * 450000
    quality_bonus = np.array([QUALITY[x] for x in quality]) * 850000
    metro_bonus = near_metro * 650000
    parking_bonus = parking * 475000
    bath_bonus = bathrooms * 260000
    balcony_bonus = balcony * 180000
    age_penalty = age * 95000
    floor_effect = np.where(floor <= 5, 140000, np.where(floor <= 15, 260000, 110000))
    noise = RNG.normal(0, 900000, n)

    price = (base * loc_factor + furnish_bonus + quality_bonus + metro_bonus + parking_bonus + bath_bonus + balcony_bonus + floor_effect - age_penalty + noise).clip(1800000, None)

    df = pd.DataFrame({
        "area_sqft": area,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "property_age": age,
        "parking_slots": parking,
        "floor_number": floor,
        "near_metro": near_metro,
        "balconies": balcony,
        "location": location,
        "furnishing": furnishing,
        "quality_grade": quality,
        "price_inr": price.round(0),
    })
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["area_per_room"] = out["area_sqft"] / (out["bedrooms"] + out["bathrooms"]).replace(0, 1)
    out["luxury_score"] = out["parking_slots"] + out["balconies"] + out["near_metro"]
    out["age_bucket"] = pd.cut(out["property_age"], bins=[-1, 3, 10, 20, 100], labels=["New", "Recent", "Mature", "Old"])
    return out


def evaluate(y_true, pred):
    return {
        "MAE": round(float(mean_absolute_error(y_true, pred)), 2),
        "RMSE": round(float(np.sqrt(mean_squared_error(y_true, pred))), 2),
        "R2": round(float(r2_score(y_true, pred)), 4),
    }


def main():
    df = make_synthetic_housing()
    df = engineer_features(df)
    df.to_csv(DATA_DIR / "synthetic_housing_data.csv", index=False)

    target = "price_inr"
    X = df.drop(columns=[target])
    y = df[target]
    cat_cols = X.select_dtypes(include=["object", "category"]).columns.tolist()
    num_cols = [c for c in X.columns if c not in cat_cols]

    preprocess = ColumnTransformer([
        ("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), num_cols),
        ("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("ohe", OneHotEncoder(handle_unknown="ignore"))]), cat_cols),
    ])

    models = {
        "Linear Regression": LinearRegression(),
        "Ridge Regression": Ridge(alpha=2.0),
        "Random Forest": RandomForestRegressor(n_estimators=120, random_state=42, max_depth=14),
        "Gradient Boosting": GradientBoostingRegressor(random_state=42),
    }
    if XGBRegressor:
        models["XGBoost"] = XGBRegressor(n_estimators=100, learning_rate=0.06, max_depth=4, random_state=42, objective="reg:squarederror")
    else:
        models["XGBoost (simulated fallback)"] = GradientBoostingRegressor(random_state=7)
    if LGBMRegressor:
        models["LightGBM"] = LGBMRegressor(n_estimators=120, learning_rate=0.06, random_state=42, verbose=-1)
    else:
        models["LightGBM (simulated fallback)"] = RandomForestRegressor(n_estimators=100, random_state=9, max_depth=12)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=.2, random_state=42)
    leaderboard = []
    fitted = {}
    for name, model in models.items():
        pipe = Pipeline([("preprocess", preprocess), ("model", model)])
        pipe.fit(X_train, y_train)
        pred = pipe.predict(X_test)
        metrics = evaluate(y_test, pred)
        leaderboard.append({"model": name, **metrics})
        fitted[name] = (pipe, pred)

    leaderboard = sorted(leaderboard, key=lambda r: r["RMSE"])
    best_name = leaderboard[0]["model"]
    best_pipe, best_pred = fitted[best_name]

    # Feature importance via permutation-like sensitivity for dashboard-friendly JSON
    sample = X_test.sample(120, random_state=42).copy()
    base_pred = best_pipe.predict(sample).mean()
    feature_impact = []
    for col in X.columns:
        changed = sample.copy()
        if col in num_cols:
            changed[col] = changed[col].sample(frac=1, random_state=42).values
        else:
            changed[col] = changed[col].sample(frac=1, random_state=42).values
        impact = abs(best_pipe.predict(changed).mean() - base_pred)
        feature_impact.append({"feature": col, "impact": round(float(impact), 2)})
    feature_impact = sorted(feature_impact, key=lambda x: x["impact"], reverse=True)[:10]

    # Trend and category summaries
    location_summary = df.groupby("location")["price_inr"].mean().sort_values().reset_index()
    quality_summary = df.groupby("quality_grade")["price_inr"].mean().sort_values().reset_index()
    actual_vs_pred = pd.DataFrame({"actual": y_test.values[:80].round(0), "predicted": best_pred[:80].round(0)})

    dashboard = {
        "project": "EstateValue AI",
        "subtitle": "ML-Powered Real Estate Valuation & Market Intelligence Platform",
        "bestModel": best_name,
        "leaderboard": leaderboard,
        "featureImpact": feature_impact,
        "locationSummary": location_summary.to_dict(orient="records"),
        "qualitySummary": quality_summary.to_dict(orient="records"),
        "actualVsPredicted": actual_vs_pred.to_dict(orient="records"),
        "businessRecommendations": [
            "Premium location and larger carpet area are the strongest valuation drivers.",
            "Properties near metro access show better pricing potential and buyer appeal.",
            "Parking, furnishing, and quality upgrades improve resale value noticeably.",
            "Older properties need renovation positioning to reduce age-based price discount.",
            "Use what-if analysis to estimate ROI before investing in upgrades."
        ],
        "defaultInput": {
            "area_sqft": 1650,
            "bedrooms": 3,
            "bathrooms": 2,
            "property_age": 6,
            "parking_slots": 1,
            "floor_number": 8,
            "near_metro": 1,
            "balconies": 2,
            "location": "IT Hub",
            "furnishing": "Semi-Furnished",
            "quality_grade": "Good"
        },
        "pricingRules": {
            "baseRatePerSqft": 4200,
            "locationMultiplier": LOCATIONS,
            "furnishingBonus": {"Unfurnished": 0, "Semi-Furnished": 450000, "Fully Furnished": 900000},
            "qualityBonus": {"Standard": 0, "Good": 850000, "Premium": 1700000, "Luxury": 2550000},
            "metroBonus": 650000,
            "parkingBonus": 475000,
            "bathroomBonus": 260000,
            "balconyBonus": 180000,
            "agePenalty": 95000,
            "floorPremium": 220000
        }
    }
    (FRONTEND_DATA_DIR / "model-report.json").write_text(json.dumps(dashboard, indent=2), encoding="utf-8")
    print("Saved dataset:", DATA_DIR / "synthetic_housing_data.csv")
    print("Saved dashboard export:", FRONTEND_DATA_DIR / "model-report.json")
    print("Best model:", best_name)
    print(json.dumps(leaderboard, indent=2))

if __name__ == "__main__":
    main()
