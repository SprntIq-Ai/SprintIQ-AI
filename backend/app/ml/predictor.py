import pandas as pd
import numpy as np
from datetime import datetime
from sqlalchemy.orm import Session
from app.ml.features import extract_project_features, convert_features_to_dataframe
from app.ml.trainer import ml_trainer
from app.models.domain import MLPrediction, Project

class MLPredictor:
    def __init__(self):
        self.trainer = ml_trainer

    def predict_project_delay(self, db: Session, project_id: str) -> dict:
        """
        Runs Scikit-learn prediction for project delay risk using real project execution features.
        Stores the output prediction record in PostgreSQL.
        """
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return {"error": "Project not found"}

        raw_features = extract_project_features(db, project_id)

        # Handle Insufficient Data condition
        total_tasks = raw_features.get("total_tasks", 0.0)
        if total_tasks == 0:
            return {
                "project_id": project_id,
                "prediction_type": "PROJECT_DELAY",
                "status": "INSUFFICIENT_DATA",
                "message": "Insufficient historical data for reliable prediction.",
                "probability": 0.0,
                "risk_level": "UNKNOWN",
                "prediction_label": "NOT_AVAILABLE",
                "expected_delay_days": "0 Days",
                "model_version": self.trainer.model_version,
                "contributing_factors": []
            }

        df = convert_features_to_dataframe(raw_features)

        # Scikit-learn Model Prediction
        proba_array = self.trainer.delay_pipeline.predict_proba(df)[0]
        # Class 1 is Delay
        delay_prob = float(proba_array[1]) if len(proba_array) > 1 else float(proba_array[0])

        # Categorize Risk Level
        if delay_prob >= 0.75:
            risk_level = "CRITICAL" if delay_prob >= 0.88 else "HIGH"
            prediction_label = "HIGH_DELAY_RISK"
        elif delay_prob >= 0.45:
            risk_level = "MEDIUM"
            prediction_label = "MODERATE_DELAY_RISK"
        else:
            risk_level = "LOW"
            prediction_label = "ON_TRACK"

        # Expected Delay Calculation (empirical heuristic based on remaining work and velocity)
        remaining_tasks = raw_features.get("remaining_tasks", 0.0)
        overdue_tasks = raw_features.get("overdue_tasks", 0.0)
        workload_ratio = raw_features.get("workload_ratio", 1.0)
        
        delay_days_est = int(np.ceil(overdue_tasks * 1.5 + (remaining_tasks * max(workload_ratio - 1.0, 0.0) * 0.8)))
        if delay_prob < 0.35:
            expected_delay_text = "0 Days"
        elif delay_days_est <= 2:
            expected_delay_text = "1–3 Days"
        elif delay_days_est <= 6:
            expected_delay_text = "4–6 Days"
        else:
            expected_delay_text = f"{delay_days_est}–{delay_days_est + 4} Days"

        # Contributing Factors
        factors = []
        if raw_features.get("overdue_tasks", 0.0) > 0:
            factors.append({
                "factor": "Overdue Tasks",
                "value": f"{int(raw_features['overdue_tasks'])} tasks past due",
                "impact": "HIGH"
            })
        if raw_features.get("workload_ratio", 1.0) > 1.1:
            factors.append({
                "factor": "Developer Workload",
                "value": f"{int(raw_features['workload_ratio'] * 100)}% capacity",
                "impact": "HIGH"
            })
        if raw_features.get("completion_rate", 1.0) < 0.5:
            factors.append({
                "factor": "Task Completion Rate",
                "value": f"{int(raw_features['completion_rate'] * 100)}%",
                "impact": "MEDIUM"
            })
        if raw_features.get("deadline_adherence", 1.0) < 0.8:
            factors.append({
                "factor": "Deadline Adherence",
                "value": f"{int(raw_features['deadline_adherence'] * 100)}%",
                "impact": "MEDIUM"
            })
        if not factors:
            factors.append({"factor": "Sprint Velocity", "value": "Normal Range", "impact": "LOW"})

        # Save prediction record into database
        db_prediction = MLPrediction(
            project_id=project_id,
            model_name="ScikitRandomForestDelayClassifier",
            model_version=self.trainer.model_version,
            prediction_type="PROJECT_DELAY",
            input_feature_summary=raw_features,
            prediction_label=prediction_label,
            probability=round(delay_prob, 4),
            risk_level=risk_level,
            created_at=datetime.utcnow()
        )
        db.add(db_prediction)
        
        # Also update project ai_risk_score
        project.ai_risk_score = round(delay_prob * 100, 1)
        project.health_status = "CRITICAL" if risk_level in ("HIGH", "CRITICAL") else ("NEEDS_ATTENTION" if risk_level == "MEDIUM" else "HEALTHY")
        db.commit()

        return {
            "project_id": project_id,
            "prediction_type": "PROJECT_DELAY",
            "status": "SUCCESS",
            "probability": round(delay_prob, 4),
            "probability_percentage": int(round(delay_prob * 100)),
            "risk_level": risk_level,
            "prediction_label": prediction_label,
            "expected_delay_days": expected_delay_text,
            "model_version": self.trainer.model_version,
            "contributing_factors": factors,
            "created_at": datetime.utcnow().isoformat()
        }

# Global ML Predictor Instance
ml_predictor = MLPredictor()
