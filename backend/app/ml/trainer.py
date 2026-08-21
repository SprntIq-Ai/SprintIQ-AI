import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
from datetime import datetime

class MLTrainer:
    def __init__(self):
        self.delay_pipeline = None
        self.workload_pipeline = None
        self.model_version = "v1.2.0-scikit"
        self.is_trained = False

    def generate_synthetic_training_data(self, samples: int = 500) -> pd.DataFrame:
        """Generates realistic historical project execution data for training Scikit-learn models."""
        np.random.seed(42)

        total_tasks = np.random.randint(5, 50, size=samples)
        completion_rate = np.random.uniform(0.1, 1.0, size=samples)
        completed_tasks = (total_tasks * completion_rate).astype(int)
        remaining_tasks = total_tasks - completed_tasks
        overdue_tasks = (remaining_tasks * np.random.uniform(0.0, 0.6, size=samples)).astype(int)
        
        story_point_completion_rate = np.clip(completion_rate + np.random.normal(0, 0.05, samples), 0, 1)
        avg_completion_days = np.random.uniform(1.0, 10.0, size=samples)
        avg_sprint_velocity = np.random.uniform(10.0, 50.0, size=samples)
        dev_count = np.random.randint(1, 10, size=samples)
        team_capacity_hours = dev_count * 40.0
        workload_ratio = np.random.uniform(0.4, 2.5, size=samples)
        deadline_adherence = np.random.uniform(0.3, 1.0, size=samples)
        high_priority_bugs = np.random.randint(0, 15, size=samples)

        # Decision rule for binary ground truth label (1 = Project Delayed, 0 = On Time)
        delay_score = (
            (1.0 - completion_rate) * 0.35 +
            (overdue_tasks / np.maximum(total_tasks, 1)) * 0.30 +
            (workload_ratio > 1.2).astype(float) * 0.15 +
            (1.0 - deadline_adherence) * 0.20
        )
        is_delayed = (delay_score > 0.42).astype(int)

        df = pd.DataFrame({
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "remaining_tasks": remaining_tasks,
            "overdue_tasks": overdue_tasks,
            "completion_rate": completion_rate,
            "story_point_completion_rate": story_point_completion_rate,
            "avg_completion_days": avg_completion_days,
            "avg_sprint_velocity": avg_sprint_velocity,
            "dev_count": dev_count,
            "team_capacity_hours": team_capacity_hours,
            "workload_ratio": workload_ratio,
            "deadline_adherence": deadline_adherence,
            "high_priority_bugs": high_priority_bugs,
            "is_delayed": is_delayed
        })

        return df

    def train_models(self) -> dict:
        """Trains Scikit-learn pipelines for Project Delay Classification."""
        df = self.generate_synthetic_training_data(samples=600)

        feature_cols = [
            "total_tasks", "completed_tasks", "remaining_tasks", "overdue_tasks",
            "completion_rate", "story_point_completion_rate", "avg_completion_days",
            "avg_sprint_velocity", "dev_count", "team_capacity_hours",
            "workload_ratio", "deadline_adherence", "high_priority_bugs"
        ]

        X = df[feature_cols]
        y = df["is_delayed"]

        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

        # Pipeline: StandardScaler -> RandomForestClassifier
        self.delay_pipeline = Pipeline([
            ("scaler", StandardScaler()),
            ("classifier", RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42))
        ])

        self.delay_pipeline.fit(X_train, y_train)

        y_pred = self.delay_pipeline.predict(X_test)
        acc = float(accuracy_score(y_test, y_pred))
        f1 = float(f1_score(y_test, y_pred, average="weighted"))

        self.is_trained = True

        return {
            "model_version": self.model_version,
            "accuracy": acc,
            "f1_score": f1,
            "trained_samples": len(df),
            "trained_at": datetime.utcnow().isoformat()
        }

# Global Singleton ML Trainer
ml_trainer = MLTrainer()
ml_trainer.train_models()
