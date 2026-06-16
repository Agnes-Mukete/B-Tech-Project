from fastapi import FastAPI, HTTPException # type: ignore
from pydantic import BaseModel # pyright: ignore[reportMissingImports]
import joblib # type: ignore
import numpy as np # type: ignore
import os

app = FastAPI(title="MoveSmart ML Microservice")

# Placeholder for loaded models
# In production, you'd train these and save via joblib.dump()
demand_model = None
eta_model = None

@app.on_event("startup")
def load_models():
    global demand_model, eta_model
    # Safe loading fallback if models aren't trained yet
    if os.path.exists("models/demand_model.pkl"):
        demand_model = joblib.load("models/demand_model.pkl")
    if os.path.exists("models/eta_model.pkl"):
        eta_model = joblib.load("models/eta_model.pkl")

# Input validation schemas
class DemandRequest(BaseModel):
    agency_id: int
    route_id: int
    day_of_week: int  # 0-6
    hour_of_day: int  # 0-23

class ETARequest(BaseModel):
    route_id: int
    distance_km: float
    hour_of_day: int
    weather_condition: int # 0: Clear, 1: Rain, etc.

@app.get("/")
def read_root():
    return {"status": "healthy", "service": "MoveSmart-ML"}

@app.post("/predict/demand")
def predict_demand(data: DemandRequest):
    # Dummy logic if model file doesn't exist yet for demo purposes
    if not demand_model:
        # Simulate high demand during rush hours (7-9 AM, 4-6 PM)
        is_rush_hour = 1 if data.hour_of_day in [7,8,9,16,17,18] else 0
        base_demand = 15 if is_rush_hour else 3
        predicted_passengers = base_demand + np.random.randint(1, 5)
        return {"route_id": data.route_id, "predicted_passenger_demand": predicted_passengers, "status": "mocked"}
    
    # Real inference
    features = np.array([[data.agency_id, data.route_id, data.day_of_week, data.hour_of_day]])
    prediction = demand_model.predict(features)[0]
    return {"route_id": data.route_id, "predicted_passenger_demand": int(prediction), "status": "computed"}

@app.post("/predict/eta")
def predict_eta(data: ETARequest):
    if not eta_model:
        # Base speed 40 km/h, slowed down by rain or rush hour
        average_speed = 30 if data.weather_condition == 1 else 45
        estimated_minutes = (data.distance_km / average_speed) * 60
        return {"estimated_time_minutes": round(estimated_minutes, 2), "status": "mocked"}

    features = np.array([[data.route_id, data.distance_km, data.hour_of_day, data.weather_condition]])
    prediction = eta_model.predict(features)[0]
    return {"estimated_time_minutes": round(prediction, 2), "status": "computed"}