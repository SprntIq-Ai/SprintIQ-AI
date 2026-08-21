from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.domain import Project, Task, Profile, Report, Notification
from app.api.deps import get_current_user

router = APIRouter(prefix="/search", tags=["Global Search"])

@router.get("/global")
def global_search(q: str = Query("", min_length=1), db: Session = Depends(get_db), current_user: Profile = Depends(get_current_user)):
    term = f"%{q}%"
    
    projects = db.query(Project).filter(Project.name.ilike(term) | Project.key.ilike(term)).limit(5).all()
    tasks = db.query(Task).filter(Task.title.ilike(term) | Task.description.ilike(term)).limit(8).all()
    users = db.query(Profile).filter(Profile.full_name.ilike(term) | Profile.email.ilike(term)).limit(5).all()
    reports = db.query(Report).filter(Report.title.ilike(term)).limit(5).all()

    results = []
    
    for p in projects:
        results.append({
            "id": p.id,
            "title": p.name,
            "subtitle": f"Project ({p.key}) • {p.status}",
            "type": "PROJECT",
            "link": "/admin/projects" if current_user.role.name == "admin" else "/manager/projects"
        })
        
    for t in tasks:
        results.append({
            "id": t.id,
            "title": t.title,
            "subtitle": f"Task • Priority: {t.priority} • Progress: {t.progress}%",
            "type": "TASK",
            "link": "/developer/tasks" if current_user.role.name == "developer" else "/manager/tasks"
        })

    for u in users:
        results.append({
            "id": u.id,
            "title": u.full_name,
            "subtitle": f"User • {u.email} • Role: {u.role.name if u.role else 'user'}",
            "type": "DEVELOPER" if (u.role and u.role.name == "developer") else "MANAGER",
            "link": "/admin/users" if current_user.role.name == "admin" else "/manager/developers"
        })

    for r in reports:
        results.append({
            "id": r.id,
            "title": r.title,
            "subtitle": f"Report • {r.format} • {r.report_type}",
            "type": "REPORT",
            "link": "/admin/reports" if current_user.role.name == "admin" else "/manager/reports"
        })

    return {
        "query": q,
        "results": results
    }
