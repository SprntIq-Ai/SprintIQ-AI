from sqlalchemy.orm import Session
from app.models.domain import Notification, ActivityLog, EmailLog
from typing import Optional, Dict, Any

class NotificationService:
    @staticmethod
    def create_notification(db: Session, user_id: str, title: str, message: str, notification_type: str = "INFO", link: Optional[str] = None) -> Notification:
        notif = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            link=link
        )
        db.add(notif)
        db.commit()
        db.refresh(notif)
        return notif

    @staticmethod
    def log_activity(db: Session, user_id: Optional[str], action: str, entity_type: str, entity_id: Optional[str] = None, details: Optional[Dict[str, Any]] = None) -> ActivityLog:
        log = ActivityLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {}
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        return log

    @staticmethod
    def send_email_simulation(db: Session, recipient: str, subject: str, body: str) -> EmailLog:
        email_log = EmailLog(
            recipient=recipient,
            subject=subject,
            body=body,
            status="SENT"
        )
        db.add(email_log)
        db.commit()
        db.refresh(email_log)
        print(f"[Email Dispatcher] Sent email to {recipient} | Subject: {subject}")
        return email_log
